import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { client } from "@repo/db";
import { server_env as env } from "@repo/env";
import postRoutes from "./routes/post-routes";
import creatorRoutes from "./routes/creator-routes";
import userRoutes from "./routes/user-routes";
import notificationRoutes from "./routes/notification-routes";
import subscriptionRoutes from "./routes/subscription-routes";
import messageRoutes from "./routes/message-routes";
import likeRoutes from "./routes/like-routes";
import followRoutes from "./routes/follow-routes";
import omegleRoutes from "./routes/omegle-routes";
import friendRoutes from "./routes/friend-routes";
import authRoutes from "./routes/auth-routes";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "./utils/jwt-auth";

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [env.WEB_URL,].filter(
    (origin): origin is string => Boolean(origin),
);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
    }),
);

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.use("/api/auth", authRoutes);

app.get("/api/me", async (req, res) => {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
        return res.json(null);
    }

    let payload: ReturnType<typeof verifyAuthToken>;
    try {
        payload = verifyAuthToken(token);
    } catch {
        return res.json(null);
    }

    const user = await client.user.findUnique({
        where: { id: payload.userId },
        select: {
            id: true,
            email: true,
            name: true,
            image: true,
            bio: true,
            role: true,
            createdAt: true,
            creatorProfile: {
                select: {
                    id: true,
                    username: true,
                },
            },
        },
    });

    if (!user) {
        return res.json(null);
    }

    return res.json({
        session: {
            id: payload.userId,
            userId: payload.userId,
            expiresAt: null,
        },
        user: {
            ...user,
            creatorId: user.creatorProfile?.id ?? null,
            username: user.creatorProfile?.username ?? null,
            creatorProfile: undefined,
        },
    });
});

app.get('/health', (_req, res) => {
    res.send("All Good!")
})

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/post", postRoutes);
app.use('/api/v1/creator', creatorRoutes);
app.use('/api/v1/notification', notificationRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/message', messageRoutes);
app.use('/api/v1/like', likeRoutes);
app.use('/api/v1/follow', followRoutes);
app.use('/api/v1/omegle', omegleRoutes);
app.use('/api/v1/friends', friendRoutes);

app.listen(5000, async () => {
    await client.$connect();
    console.log("Database connected successfully");
    console.log("Server is running on port 5000");
    console.log(`Allowed CORS origins: ${allowedOrigins.join(", ")}`);
});
