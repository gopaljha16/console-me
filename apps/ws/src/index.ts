import { Server as NetServer } from "http";
import { Server as ServerIO } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { getSessionManager } from "@repo/cache";
import { kafka, TOPICS } from "@repo/kafka";
import type { Consumer } from "@repo/kafka";

const PORT = parseInt(process.env.SOCKET_PORT || "8080", 10);
const NODE_ID = crypto.randomUUID();

// Redis clients for Socket.IO adapter (pub/sub)
const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    username: process.env.REDIS_USERNAME || "default",
    password: process.env.REDIS_PASSWORD || undefined,
};

const pubClient = new Redis(redisConfig);
const subClient = pubClient.duplicate();

const httpServer = new NetServer((req, res) => {
    if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", nodeId: NODE_ID }));
        return;
    }
    res.writeHead(404);
    res.end();
});

const io = new ServerIO(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: {
        origin: [
            process.env.WEB_APP_URL || "http://localhost:3000",
            process.env.APP_URL || "http://localhost:3001",
        ],
        methods: ["GET", "POST"],
        credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
    pingTimeout: 60_000,
    pingInterval: 25_000,
});

declare module "socket.io" {
    interface Socket {
        userId?: string;
    }
}

const sessionManager = getSessionManager();

// ─── Socket Connection Handler ───

io.on("connection", (socket) => {
    console.log(`[WS] Connected: ${socket.id} (node: ${NODE_ID})`);

    // Client identifies itself after connecting
    socket.on("identify", async (data: { userId: string; serverId?: string }) => {
        socket.userId = data.userId;

        try {
            await sessionManager.setUserSession(data.userId, {
                userId: data.userId,
                serverId: data.serverId,
                nodeId: NODE_ID,
                socketId: socket.id,
                connectedAt: Date.now(),
                lastSeen: Date.now(),
            });

            socket.join(`user:${data.userId}`);
            console.log(`[WS] Identified: ${data.userId} → ${socket.id}`);
        } catch (err) {
            console.error("[WS] Failed to set session:", err);
        }
    });

    // Join a room (channel, conversation, etc.)
    socket.on("join-room", (roomKey: string) => {
        socket.join(roomKey);
        console.log(`[WS] ${socket.userId ?? socket.id} joined room: ${roomKey}`);
    });

    socket.on("leave-room", (roomKey: string) => {
        socket.leave(roomKey);
        console.log(`[WS] ${socket.userId ?? socket.id} left room: ${roomKey}`);
    });

    // ─── Omegle Events ───

    // When a user leaves or skips in omegle, notify their partner
    socket.on("omegle:leave", (data: { partnerId: string }) => {
        if (data.partnerId) {
            io.to(`user:${data.partnerId}`).emit("omegle:partner-left");
            console.log(`[WS] Omegle: ${socket.userId} left, notified ${data.partnerId}`);
        }
    });

    socket.on("omegle:skip", (data: { partnerId: string }) => {
        if (data.partnerId) {
            io.to(`user:${data.partnerId}`).emit("omegle:partner-left");
            console.log(`[WS] Omegle: ${socket.userId} skipped, notified ${data.partnerId}`);
        }
    });

    // ─── Friend & Call Events ───
    socket.on("friend:request", (data: { targetUserId: string }) => {
        if (data.targetUserId) {
            io.to(`user:${data.targetUserId}`).emit("friend:request:incoming", { fromUserId: socket.userId });
        }
    });

    socket.on("friend:accept", (data: { targetUserId: string }) => {
        if (data.targetUserId) {
            io.to(`user:${data.targetUserId}`).emit("friend:accept:incoming", { fromUserId: socket.userId });
        }
    });

    socket.on("call:ring", (data: { targetUserId: string, roomName: string, fromUserName?: string }) => {
        if (data.targetUserId) {
            io.to(`user:${data.targetUserId}`).emit("call:incoming", { fromUserId: socket.userId, roomName: data.roomName, fromUserName: data.fromUserName || "Friend" });
        }
    });

    socket.on("call:decline", (data: { targetUserId: string }) => {
        if (data.targetUserId) {
            io.to(`user:${data.targetUserId}`).emit("call:declined", { fromUserId: socket.userId });
        }
    });

    socket.on("disconnect", async () => {
        const userId = socket.userId;
        console.log(`[WS] Disconnected: ${socket.id} (user: ${userId ?? "unknown"})`);

        if (!userId) return;

        try {
            const session = await sessionManager.getUserSession(userId);
            // Only remove if this socket still owns the session (prevents
            // clearing a newer connection from another tab/device)
            if (session?.socketId === socket.id) {
                await sessionManager.removeUserSession(userId);
            }
        } catch (err) {
            console.error("[WS] Failed to clean session:", err);
        }
    });
});

// ─── Kafka Consumer — broadcast messages to socket rooms ───

let consumer: Consumer | null = null;

async function startBroadcastConsumer() {
    consumer = kafka.consumer({
        groupId: `socket-broadcaster`,
    });

    await consumer.connect();
    await consumer.subscribe({
        topics: [TOPICS.DM_MESSAGES, TOPICS.NOTIFICATION, TOPICS.POST],
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            try {
                const raw = message.value?.toString();
                if (!raw) return;

                const data = JSON.parse(raw);

                switch (topic) {
                    case TOPICS.DM_MESSAGES: {
                        io.to(`user:${data.senderId}`).emit("dm-message", data);
                        io.to(`user:${data.receiverId}`).emit("dm-message", data);
                        break;
                    }
                    case TOPICS.NOTIFICATION: {
                        // Route to the specific user
                        if (data.userId) {
                            io.to(`user:${data.userId}`).emit("notification:new", data);
                        }
                        break;
                    }
                    case TOPICS.POST: {
                        // Route to the specific user
                        if (data.creatorId) {
                            io.to(`user:${data.creatorId}`).emit("posts:new", data);
                        }
                        break;
                    }
                }
            } catch (err) {
                console.error("[WS] Kafka broadcast error:", err);
            }
        },
    });

    console.log("[WS] Kafka broadcast consumer started");
}

// ─── Graceful Shutdown ───

async function shutdown() {
    console.log("[WS] Shutting down...");

    if (consumer) {
        await consumer.disconnect().catch(() => { });
    }

    io.close(() => {
        httpServer.close(() => {
            pubClient.quit();
            subClient.quit();
            console.log("[WS] Shutdown complete");
            process.exit(0);
        });
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Start ───

httpServer.listen(PORT, async () => {
    console.log(`[WS] Socket server running on port ${PORT} (node: ${NODE_ID})`);

    try {
        await startBroadcastConsumer();
    } catch (err) {
        console.error("[WS] Failed to start Kafka consumer — running without broadcast:", err);
    }
});
