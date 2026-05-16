"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ReactNode, useState } from "react";
import { Toaster } from "sonner";
import { GlobalSocketListener } from "@/components/chat/global-socket-listener";
import { web_env as env } from "@/lib/env";

type Props = {
    children: ReactNode;
};

export function AppProviders({ children }: Props) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            }),
    );

    return (
        <GoogleOAuthProvider clientId={env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
            <QueryClientProvider client={queryClient}>
                {children}
                <GlobalSocketListener />
                <Toaster position="top-center" richColors />
            </QueryClientProvider>
        </GoogleOAuthProvider>
    );
}
