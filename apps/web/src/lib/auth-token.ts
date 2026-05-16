export const AUTH_TOKEN_STORAGE_KEY = "console_me_token";

export const getStoredAuthToken = () => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
};

export const setStoredAuthToken = (token: string) => {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    document.cookie = `${AUTH_TOKEN_STORAGE_KEY}=${token}; path=/; max-age=31536000; SameSite=Lax`;
};

export const clearStoredAuthToken = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    document.cookie = `${AUTH_TOKEN_STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
};
