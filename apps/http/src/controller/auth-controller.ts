import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { client } from "@repo/db";
import { server_env as env } from "@repo/env";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "../utils/jwt-auth.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req: Request, res: Response) => {
    const { credential } = req.body as { credential?: string };

    if (!credential) {
        return res.status(400).json({ success: false, message: "Google credential is required" });
    }

    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();

    if (!payload?.sub || !email) {
        return res.status(401).json({ success: false, message: "Invalid Google account" });
    }

    const user = await client.user.upsert({
        where: { email },
        update: {
            name: payload.name ?? email,
            image: payload.picture,
            emailVerified: payload.email_verified ?? true,
        },
        create: {
            id: randomUUID(),
            name: payload.name ?? email,
            email,
            emailVerified: payload.email_verified ?? true,
            image: payload.picture,
        },
        include: {
            creatorProfile: {
                select: {
                    id: true,
                    username: true,
                },
            },
        },
    });

    const token = signAuthToken({ userId: user.id, email: user.email });
    setAuthCookie(res, token);

    return res.status(200).json({
        success: true,
        data: {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                role: user.role,
                bio: user.bio,
                createdAt: user.createdAt,
                creatorId: user.creatorProfile?.id ?? null,
                username: user.creatorProfile?.username ?? null,
            },
        },
    });
};

export const logout = (_req: Request, res: Response) => {
    clearAuthCookie(res);
    return res.status(200).json({ success: true });
};
