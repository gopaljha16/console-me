import { Redis } from "ioredis";
import { env } from "./config/env";

export interface OmegleUser {
    userId: string;
    displayName: string;
    email: string;
    myGender: "any" | "male" | "female";
    preference: "any" | "male" | "female";
    joinedAt: number;
}

export interface OmegleMatch {
    partnerUserId: string;
    partnerName: string;
    roomName: string;
    matchedAt: number;
}

export class OmegleMatchmaker {
    private redis: Redis;
    private readonly ONLINE_TTL = 300; // 5 min heartbeat
    private readonly MATCH_TTL = 1800; // 30 min max call
    private readonly QUEUE_KEY = "omegle:queue";

    constructor() {
        this.redis = new Redis({
            host: env.HOST,
            port: env.PORT,
            username: env.USERNAME,
            password: env.PASSWORD,
        });

        this.redis.on("error", (err) => {
            console.error("[OmegleMatchmaker] Redis error:", err);
        });
    }

    // ─── Online Status ───

    async setOnline(user: OmegleUser): Promise<void> {
        const key = `omegle:online:${user.userId}`;
        await this.redis.setex(key, this.ONLINE_TTL, JSON.stringify(user));
    }

    async isOnline(userId: string): Promise<boolean> {
        const exists = await this.redis.exists(`omegle:online:${userId}`);
        return exists === 1;
    }

    async setOffline(userId: string): Promise<void> {
        await this.redis.del(`omegle:online:${userId}`);
    }

    async getOnlineUser(userId: string): Promise<OmegleUser | null> {
        const data = await this.redis.get(`omegle:online:${userId}`);
        return data ? JSON.parse(data) : null;
    }

    // Refresh TTL (heartbeat)
    async refreshOnline(userId: string): Promise<void> {
        await this.redis.expire(`omegle:online:${userId}`, this.ONLINE_TTL);
    }

    // ─── Queue Management ───

    async joinQueue(userId: string, preference: string, myGender: string): Promise<void> {
        // Remove first to avoid duplicates
        await this.leaveQueue(userId);

        // Push to the general queue
        await this.redis.lpush(this.QUEUE_KEY, JSON.stringify({ userId, preference, myGender }));
    }

    async leaveQueue(userId: string): Promise<void> {
        // Get all items in the queue
        const items = await this.redis.lrange(this.QUEUE_KEY, 0, -1);

        for (const item of items) {
            try {
                const parsed = JSON.parse(item);
                if (parsed.userId === userId) {
                    await this.redis.lrem(this.QUEUE_KEY, 0, item);
                }
            } catch {
                // skip malformed entries
            }
        }
    }

    async findMatch(userId: string, preference: string, myGender: string): Promise<{ matchedUserId: string; roomName: string } | null> {
        const items = await this.redis.lrange(this.QUEUE_KEY, 0, -1);

        for (const item of items) {
            try {
                const parsed = JSON.parse(item);

                // Don't match with self
                if (parsed.userId === userId) continue;

                // Check if the queued user is still online
                const isStillOnline = await this.isOnline(parsed.userId);
                if (!isStillOnline) {
                    // Clean up stale entry
                    await this.redis.lrem(this.QUEUE_KEY, 0, item);
                    continue;
                }

                const queuedUserData = await this.getOnlineUser(parsed.userId);
                if (!queuedUserData) continue;

                const userB_gender = queuedUserData.myGender || parsed.myGender || "any";
                const userA_gender = myGender || "any";

                const A_likes_B = preference === "any" || preference === userB_gender;
                const B_likes_A = parsed.preference === "any" || parsed.preference === userA_gender;

                if (!(A_likes_B && B_likes_A)) continue;

                // Found a match! Remove both users from queue
                await this.redis.lrem(this.QUEUE_KEY, 0, item);
                await this.leaveQueue(userId);

                // Generate room name
                const roomName = `omegle-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

                // Store match for both users
                await this.setMatch(userId, parsed.userId, roomName, queuedUserData.displayName);

                return { matchedUserId: parsed.userId, roomName };
            } catch {
                continue;
            }
        }

        return null;
    }

    // ─── Match Storage ───

    async setMatch(userId1: string, userId2: string, roomName: string, partnerName: string): Promise<void> {
        const match1: OmegleMatch = {
            partnerUserId: userId2,
            partnerName,
            roomName,
            matchedAt: Date.now(),
        };

        // We need the name of user1 for user2's match record
        const user1Data = await this.getOnlineUser(userId1);
        const match2: OmegleMatch = {
            partnerUserId: userId1,
            partnerName: user1Data?.displayName || "Stranger",
            roomName,
            matchedAt: Date.now(),
        };

        await this.redis.setex(`omegle:match:${userId1}`, this.MATCH_TTL, JSON.stringify(match1));
        await this.redis.setex(`omegle:match:${userId2}`, this.MATCH_TTL, JSON.stringify(match2));
    }

    async getMatch(userId: string): Promise<OmegleMatch | null> {
        const data = await this.redis.get(`omegle:match:${userId}`);
        return data ? JSON.parse(data) : null;
    }

    async clearMatch(userId: string): Promise<void> {
        const match = await this.getMatch(userId);
        if (match) {
            await this.redis.del(`omegle:match:${userId}`);
            await this.redis.del(`omegle:match:${match.partnerUserId}`);
        }
    }

    // ─── Cleanup ───

    async fullCleanup(userId: string): Promise<void> {
        await this.leaveQueue(userId);
        await this.clearMatch(userId);
        await this.setOffline(userId);
    }
}

// Singleton
let matchmakerInstance: OmegleMatchmaker | null = null;

export function getOmegleMatchmaker(): OmegleMatchmaker {
    if (!matchmakerInstance) {
        matchmakerInstance = new OmegleMatchmaker();
    }
    return matchmakerInstance;
}
