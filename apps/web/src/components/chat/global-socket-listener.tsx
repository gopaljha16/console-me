"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useQueryClient } from "@tanstack/react-query";
import { useMeQuery } from "@/hooks/use-me-query";
import type { ChatMessage } from "@/hooks/use-chat";
import { useCallStore } from "@/store/call-store";
import { Phone, X, PhoneCall } from "lucide-react";
import { VideoRoom } from "@/components/omegle/video-room";
import { API_BASE } from "@/utils/constants";

export function GlobalSocketListener() {
    const { socket } = useSocket();
    const queryClient = useQueryClient();
    const { data: meData } = useMeQuery(true);
    const { activeCallParams, incomingCall, setActiveCallParams, setIncomingCall } = useCallStore();

    useEffect(() => {
        if (!socket || !meData?.user?.id) return;

        const currentUserId = meData.user.id;

        const handleNewMessage = (msg: any) => {
            console.log("[GlobalSocketListener] dm-message received:", msg);
            const otherUserId = msg.senderId === currentUserId ? msg.receiverId : msg.senderId;
            queryClient.setQueryData<ChatMessage[]>(
                ["chat", "history", otherUserId],
                (oldMessages) => {
                    if (!oldMessages) return oldMessages;
                    if (oldMessages.some((m) => m.id === msg.id)) return oldMessages;
                    const newMessage: ChatMessage = {
                        id: msg.id, senderId: msg.senderId, receiverId: msg.receiverId,
                        content: msg.content, isLocked: msg.isLocked ?? false, price: msg.price ?? null,
                        isRead: msg.isRead ?? false, createdAt: msg.createdAt,
                    };
                    return [...oldMessages, newMessage];
                }
            );
            queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
        };

        const handleIncomingCall = (data: { fromUserId: string; roomName: string; fromUserName: string }) => {
            setIncomingCall(data);
        };

        const handleCallDeclined = () => {
            alert("Call declined.");
            setActiveCallParams(null);
        };

        socket.on("dm-message", handleNewMessage);
        socket.on("call:incoming", handleIncomingCall);
        socket.on("call:declined", handleCallDeclined);

        return () => {
            socket.off("dm-message", handleNewMessage);
            socket.off("call:incoming", handleIncomingCall);
            socket.off("call:declined", handleCallDeclined);
        };
    }, [socket, queryClient, meData?.user?.id, setIncomingCall, setActiveCallParams]);

    const acceptCall = () => {
        if (!incomingCall) return;
        setActiveCallParams({ roomName: incomingCall.roomName, partnerName: incomingCall.fromUserName });
        setIncomingCall(null);
    };

    const declineCall = () => {
        if (incomingCall && socket) {
            socket.emit("call:decline", { targetUserId: incomingCall.fromUserId });
        }
        setIncomingCall(null);
    };

    if (activeCallParams) {
        return (
            <div className="fixed inset-0 z-[100] bg-black">
                <CallWrapper 
                    roomName={activeCallParams.roomName} 
                    partnerName={activeCallParams.partnerName} 
                    onLeave={() => setActiveCallParams(null)} 
                    displayName={meData?.user?.name || "User"}
                />
            </div>
        );
    }

    if (incomingCall) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl text-center shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <div className="absolute inset-0 border-2 border-blue-500 rounded-full animate-ping opacity-50"></div>
                        <PhoneCall className="h-8 w-8 text-blue-500 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>
                    <p className="text-sm text-zinc-400 mb-8">{incomingCall.fromUserName}</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={declineCall} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-red-500 hover:bg-red-500/20">
                            <X className="h-6 w-6" />
                        </button>
                        <button onClick={acceptCall} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-white hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                            <Phone className="h-6 w-6 fill-current" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

function CallWrapper({ roomName, partnerName, displayName, onLeave }: { roomName: string; partnerName: string; displayName: string; onLeave: () => void }) {
    const [token, setToken] = useState<string>("");

    useEffect(() => {
        fetch(`${API_BASE}/api/v1/omegle/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ roomName, displayName })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) setToken(data.data.token);
        });
    }, [roomName, displayName]);

    return (
        <VideoRoom roomName={roomName} token={token} partnerName={partnerName} onSkip={onLeave} onLeave={onLeave} />
    );
}
