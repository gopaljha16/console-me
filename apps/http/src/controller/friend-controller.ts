import type { Response } from "express";
import { client } from "@repo/db";
import { catchAsync } from "../utils/catch-async.js";
import { AppError } from "../utils/app-error.js";
import type { AuthRequest } from "../middleware/user-middleware.js";

// POST /api/v1/friends/request
export const sendFriendRequest = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { targetUserId } = req.body;

    if (!targetUserId) throw new AppError("Target User ID required", 400);
    if (userId === targetUserId) throw new AppError("Cannot friend yourself", 400);

    // Check if friendship already exists
    const existing = await client.friendship.findFirst({
        where: {
            OR: [
                { user1Id: userId, user2Id: targetUserId },
                { user1Id: targetUserId, user2Id: userId }
            ]
        }
    });

    if (existing) {
        if (existing.status === "ACCEPTED") {
            return res.status(200).json({ success: true, message: "Already friends" });
        }
        return res.status(200).json({ success: true, message: "Request already pending" });
    }

    const friendship = await client.friendship.create({
        data: {
            user1Id: userId,
            user2Id: targetUserId,
            status: "PENDING"
        }
    });

    res.status(200).json({ success: true, data: friendship });
});

// POST /api/v1/friends/accept
export const acceptFriendRequest = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { friendshipId } = req.body;

    const friendship = await client.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) throw new AppError("Request not found", 404);
    if (friendship.user2Id !== userId) throw new AppError("Not authorized to accept", 403);

    const updated = await client.friendship.update({
        where: { id: friendshipId },
        data: { status: "ACCEPTED" }
    });

    res.status(200).json({ success: true, data: updated });
});

// GET /api/v1/friends
export const listFriends = catchAsync(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    
    // Get all accepted friendships
    const friendships = await client.friendship.findMany({
        where: {
            status: "ACCEPTED",
            OR: [
                { user1Id: userId },
                { user2Id: userId }
            ]
        },
        include: {
            user1: { select: { id: true, name: true, image: true, email: true } },
            user2: { select: { id: true, name: true, image: true, email: true } }
        }
    });

    // Map to normalized friend list
    const friends = friendships.map((f: any) => {
        const isUser1 = f.user1Id === userId;
        const friend = isUser1 ? f.user2 : f.user1;
        return {
            friendshipId: f.id,
            id: friend.id,
            name: friend.name,
            image: friend.image,
            email: friend.email,
        };
    });

    // Handle pending requests
    const pendingReceived = await client.friendship.findMany({
        where: { user2Id: userId, status: "PENDING" },
        include: { user1: { select: { id: true, name: true, image: true } } }
    });

    res.status(200).json({ 
        success: true, 
        friends,
        requests: pendingReceived 
    });
});
