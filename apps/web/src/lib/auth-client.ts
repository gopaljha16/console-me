import { API_BASE } from "@/utils/constants";

export const signOut = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
    });
};
