"use client";

import { ReactNode } from "react";
import { API_BASE } from "@/utils/constants";
import { AUTH_TOKEN_STORAGE_KEY, getStoredAuthToken } from "@/lib/auth-token";

type Props = {
    children: ReactNode;
};

let originalFetch: typeof window.fetch | null = null;

const installAuthFetchPatch = () => {
    if (typeof window === "undefined" || originalFetch) return;

    const token = getStoredAuthToken();
    if (token && typeof document !== "undefined") {
        const hasCookie = document.cookie.includes(`${AUTH_TOKEN_STORAGE_KEY}=`);

        if (!hasCookie) {
            document.cookie = `${AUTH_TOKEN_STORAGE_KEY}=${token}; path=/; max-age=31536000; SameSite=Lax`;
        }
    }

    originalFetch = window.fetch.bind(window);

    window.fetch = (input, init = {}) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const currentToken = getStoredAuthToken();

        if (!currentToken || !url.startsWith(API_BASE)) {
            return originalFetch!(input, init);
        }

        const headers = new Headers(init.headers);
        if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${currentToken}`);
        }

        return originalFetch!(input, {
            ...init,
            headers,
        });
    };
};

export function AuthFetchProvider({ children }: Props) {
    installAuthFetchPatch();

    return <>{children}</>;
}
