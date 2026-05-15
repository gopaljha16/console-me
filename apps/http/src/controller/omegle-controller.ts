import type { Response } from "express";
import { catchAsync } from "../utils/catch-async.js";
import { AppError } from "../utils/app-error.js";
import type { AuthRequest } from "../middleware/user-middleware.js";
import { getOmegleMatchmaker } from "@repo/cache";
import { AccessToken } from "livekit-server-sdk";
import { env } from "../config/env.js";

// Helper: generate a LiveKit access token for a user + room
async function createLiveKitToken(roomName: string, participantIdentity: string, participantName: string): Promise<string> {
    const apiKey = env.LIVEKIT_API_KEY;
    const apiSecret = env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new AppError("LiveKit API credentials not configured", 500);
    }

    const token = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity,
        name: participantName,
        ttl: "2h",
    });

    token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
    });

    return await token.toJwt();
}

// POST /api/v1/omegle/join
// Register user and attempt to find a match
export const joinOmegle = catchAsync(
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.userId!;
            const { displayName, email, preference = "any", myGender = "any" } = req.body;

            if (!displayName) {
                throw new AppError("Display name is required", 400);
            }

            const matchmaker = getOmegleMatchmaker();

            // Register user as online
            await matchmaker.setOnline({
                userId,
                displayName,
                email: email || req.user?.email || "",
                myGender,
                preference,
                joinedAt: Date.now(),
            });

            // Add to queue
            await matchmaker.joinQueue(userId, preference, myGender);

            // Try to find a match immediately
            const match = await matchmaker.findMatch(userId, preference, myGender);

            if (match) {
                // Generate tokens for both users
                const partnerData = await matchmaker.getOnlineUser(match.matchedUserId);
                console.log("[OmegleController] Match found! Generating token for:", match.roomName);
                const token = await createLiveKitToken(match.roomName, userId, displayName);
                console.log("[OmegleController] Token generated starting with:", token.substring(0, 10));

                res.status(200).json({
                    success: true,
                    status: "matched",
                    data: {
                        roomName: match.roomName,
                        token,
                        partnerId: match.matchedUserId,
                        partnerName: partnerData?.displayName || "Stranger",
                        matchedAt: Date.now(),
                    },
                });
            } else {
                res.status(200).json({
                    success: true,
                    status: "searching",
                    message: "Added to queue. Waiting for a match...",
                });
            }
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message || "Failed to join Omegle", error: e });
        }
    }
);

// POST /api/v1/omegle/poll
// Poll for a match (called periodically by frontend while searching)
export const pollMatch = catchAsync(
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.userId!;
            const { preference = "any", myGender = "any", displayName = "Stranger" } = req.body;

            const matchmaker = getOmegleMatchmaker();

            // Check if already matched (partner found us)
            const existingMatch = await matchmaker.getMatch(userId);
            if (existingMatch) {
                const token = await createLiveKitToken(existingMatch.roomName, userId, displayName);

                res.status(200).json({
                    success: true,
                    status: "matched",
                    data: {
                        roomName: existingMatch.roomName,
                        token,
                        partnerId: existingMatch.partnerUserId,
                        partnerName: existingMatch.partnerName,
                        matchedAt: existingMatch.matchedAt,
                    },
                });
                return;
            }

            // Try to find a match
            const match = await matchmaker.findMatch(userId, preference, myGender);

            if (match) {
                const partnerData = await matchmaker.getOnlineUser(match.matchedUserId);
                const token = await createLiveKitToken(match.roomName, userId, displayName);

                res.status(200).json({
                    success: true,
                    status: "matched",
                    data: {
                        roomName: match.roomName,
                        token,
                        partnerId: match.matchedUserId,
                        partnerName: partnerData?.displayName || "Stranger",
                        matchedAt: Date.now(),
                    },
                });
            } else {
                // Refresh online status (heartbeat)
                await matchmaker.refreshOnline(userId);

                res.status(200).json({
                    success: true,
                    status: "searching",
                });
            }
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message || "Failed to poll", error: e });
        }
    }
);

// POST /api/v1/omegle/token
// Generate a token for a specific room (reconnection / late join)
export const getToken = catchAsync(
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.userId!;
            const { roomName, displayName = "User" } = req.body;

            if (!roomName) {
                throw new AppError("Room name is required", 400);
            }

            const token = await createLiveKitToken(roomName, userId, displayName);

            res.status(200).json({
                success: true,
                data: { token, roomName },
            });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message || "Failed to generate token", error: e });
        }
    }
);

// POST /api/v1/omegle/skip
// Leave current match, re-queue
export const skipMatch = catchAsync(
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.userId!;
            const { displayName = "User", preference = "any", myGender = "any" } = req.body;

            const matchmaker = getOmegleMatchmaker();

            // Clear current match
            await matchmaker.clearMatch(userId);

            // Re-join queue
            await matchmaker.joinQueue(userId, preference, myGender);

            // Try to find a new match
            const match = await matchmaker.findMatch(userId, preference, myGender);

            if (match) {
                const partnerData = await matchmaker.getOnlineUser(match.matchedUserId);
                const token = await createLiveKitToken(match.roomName, userId, displayName);

                res.status(200).json({
                    success: true,
                    status: "matched",
                    data: {
                        roomName: match.roomName,
                        token,
                        partnerId: match.matchedUserId,
                        partnerName: partnerData?.displayName || "Stranger",
                        matchedAt: Date.now(),
                    },
                });
            } else {
                res.status(200).json({
                    success: true,
                    status: "searching",
                    message: "Skipped. Looking for a new match...",
                });
            }
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message || "Failed to skip", error: e });
        }
    }
);

// POST /api/v1/omegle/leave
// Full cleanup — leave queue, clear match, go offline
export const leaveOmegle = catchAsync(
    async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.userId!;
            const matchmaker = getOmegleMatchmaker();

            await matchmaker.fullCleanup(userId);

            res.status(200).json({
                success: true,
                message: "Left Omegle successfully.",
            });
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message || "Failed to leave", error: e });
        }
    }
);
