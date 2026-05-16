import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE } from "./constants";

type SessionResponse = {
    user: {
        id: string;
        name: string;
        email: string;
        emailVerified?: boolean;
        image?: string | null;
        createdAt?: string | Date;
        updatedAt?: string | Date;
        role?: string;
        bio?: string | null;
    };
    session: {
        id: string;
        userId: string;
        expiresAt: string | Date;
        token?: string;
    };
} | null;

type CreatorProfile = {
    id: string;
    username?: string | null;
    subscriptionPrice?: number | null;
    createdAt?: string;
};

type ApiResponse<T> = {
    success: boolean;
    message?: string;
    data?: T;
};

const getCookieHeader = async () => {
    const headerList = await headers();
    return headerList.get("cookie") ?? "";
};

const fetchFromHttpApi = async <T>(path: string, init?: RequestInit): Promise<T | null> => {
    const cookie = await getCookieHeader();
    try {
        const response = await fetch(`${API_BASE}${path}`, {
            ...init,
            headers: {
                ...(cookie ? { cookie } : {}),
                ...init?.headers,
            },
            cache: "no-store",
        });

        if (!response.ok) {
            return null;
        }

        return response.json() as Promise<T>;
    } catch (error) {
        console.error(`Failed to fetch ${path} from HTTP API:`, error);
        return null;
    }
};

const getSession = () => fetchFromHttpApi<SessionResponse>("/api/me");

export const requireAuth = async () => {
    const session = await getSession();

    if (!session) {
        redirect("/sign-in");
    }

    return session;
};

export const requireUnAuth = async () => {
    const session = await getSession();

    if (session) {
        redirect("/");
    }

    return session;
};

export const redirectToHomeIfSession = async () => {
    const session = await getSession();

    if (session) {
        redirect("/home");
    }

    return session;
};

export const currentUser = async () => {
    const session = await getSession();
    return session?.user ?? null;
};

export const checkCreatorProfile = async (_userId?: string) => {
    const result = await fetchFromHttpApi<ApiResponse<CreatorProfile[]>>("/api/v1/creator/fetch-profile");
    const [profile] = result?.data ?? [];

    return profile ?? null;
};

export const requireOnboardingComplete = async () => {
    const session = await requireAuth();

    const profile = await checkCreatorProfile(session.user.id);

    if (!profile) {
        redirect("/onboarding");
    }

    return { session, profile };
};
