import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useMeQuery } from "./use-me-query";
import { web_env as env } from "@/lib/env";

let socketInstance: Socket | null = null;

export const useSocket = () => {
    const { data: meData } = useMeQuery(true);
    const [socket, setSocket] = useState<Socket | null>(socketInstance);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!meData?.user?.id) return;

        if (!socketInstance) {
            // Socket IO URL from environment or using API_BASE directly
            const socketUrl = env.NEXT_PUBLIC_WS_URL || "http://localhost:8080";

            socketInstance = io(socketUrl, {
                path: "/api/socket/io",
                withCredentials: true,
                autoConnect: true,
            });

            socketInstance.on("connect", () => {
                console.log("Socket connected:", socketInstance?.id);
                setIsConnected(true);
                // Identify the user (server auto-joins user:${id} room)
                socketInstance?.emit("identify", { userId: meData.user.id });
            });

            socketInstance.on("disconnect", () => {
                console.log("Socket disconnected");
                setIsConnected(false);
            });

            setSocket(socketInstance);
        }

        return () => {
            // We might not want to disconnect on unmount if it's a global hook, 
            // but just remove listeners if needed.
            // Leaving connection open for background notifications.
        };
    }, [meData?.user?.id]);

    return { socket, isConnected };
};
