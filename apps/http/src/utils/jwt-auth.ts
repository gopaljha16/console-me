import type { Response } from "express";
import jwt from "jsonwebtoken";
import { server_env as env } from "@repo/env";

export const AUTH_COOKIE_NAME = "console_me_token";

export type AuthJwtPayload = {
    userId: string;
    email: string;
};

const jwtSecret = env.JWT_SECRET;
const isProduction = env.NODE_ENV === "production";

export const signAuthToken = (payload: AuthJwtPayload) => {
    return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
};

export const verifyAuthToken = (token: string) => {
    return jwt.verify(token, jwtSecret) as AuthJwtPayload;
};

export const setAuthCookie = (res: Response, token: string) => {
    res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
    });
};

export const clearAuthCookie = (res: Response) => {
    res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/",
    });
};
