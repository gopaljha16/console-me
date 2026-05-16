"use client";

import { ReactNode, useEffect } from "react";
import { API_BASE } from "@/utils/constants";
import { getStoredAuthToken, AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth-token";

type Props = {
    children: ReactNode;
};

export function AuthFetchProvider({ children }: Props) {
    useEffect(() => {
        const token = getStoredAuthToken();
        if (token && typeof document !== "undefined") {
            const hasCookie = document.cookie.includes(`${AUTH_TOKEN_STORAGE_KEY}=`);
            if (!hasCookie) {
                document.cookie = `${AUTH_TOKEN_STORAGE_KEY}=${token}; path=/; max-age=31536000; SameSite=Lax`;
            }
        }

        const originalFetch = window.fetch.bind(window);

        window.fetch = (input, init = {}) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            const currentToken = getStoredAuthToken();

            if (!currentToken || !url.startsWith(API_BASE)) {
                return originalFetch(input, init);
            }

            const headers = new Headers(init.headers);
            if (!headers.has("Authorization")) {
                headers.set("Authorization", `Bearer ${currentToken}`);
            }

            return originalFetch(input, {
                ...init,
                headers,
            });
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    return <>{children}</>;
}
