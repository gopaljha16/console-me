import { API_BASE } from "./constants";

export const loginWithGoogleCredential = async (credential: string) => {
    const response = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || "Google sign-in failed");
    }

    return response.json();
};
