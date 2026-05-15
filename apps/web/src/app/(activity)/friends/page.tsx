"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { API_BASE } from "@/utils/constants";
import { UserRound, Phone, MessageCircle, Check } from "lucide-react";
import { useMeQuery } from "@/hooks/use-me-query";
import { useCallStore } from "@/store/call-store";

interface Friend {
    friendshipId: string;
    id: string;
    name: string;
    image: string | null;
    email: string;
}

interface FriendRequest {
    id: string;
    user1: { id: string; name: string; image: string | null; };
}

export default function FriendsPage() {
    const { socket } = useSocket();
    const { data: meData } = useMeQuery(true);
    const { setActiveCallParams } = useCallStore();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/friends`, { credentials: "include" });
            const data = await res.json();
            if (data.success) {
                setFriends(data.friends);
                setRequests(data.requests);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const acceptRequest = async (friendshipId: string) => {
        try {
            await fetch(`${API_BASE}/api/v1/friends/accept`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ friendshipId })
            });
            fetchFriends();
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (!socket) return;

        const handleFriendRequest = () => {
            fetchFriends();
        };

        socket.on("friend:request:incoming", handleFriendRequest);
        socket.on("friend:accept:incoming", handleFriendRequest);

        return () => {
            socket.off("friend:request:incoming", handleFriendRequest);
            socket.off("friend:accept:incoming", handleFriendRequest);
        };
    }, [socket]);

    const startCall = async (friend: Friend) => {
        if (!socket) return;
        
        // Generate a random room ID and get a token for ourselves
        const roomName = `call-${Date.now()}-${Math.random().toString(36).substring(2,8)}`;
        
        // Ring the friend
        socket.emit("call:ring", { targetUserId: friend.id, roomName, fromUserName: meData?.user?.name || "Friend" });
        
        // Initialize our video room via global state
        setActiveCallParams({ roomName, partnerName: friend.name });
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-8 pt-24">
            <h1 className="text-3xl font-bold uppercase mb-8">Connections</h1>

            {loading ? (
                <div className="animate-pulse flex gap-8">
                    <div className="w-full flex-1 h-32 bg-zinc-900 rounded-2xl" />
                    <div className="w-full flex-1 h-32 bg-zinc-900 rounded-2xl" />
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-8 max-w-5xl">
                    {/* Friends List */}
                    <div className="space-y-6">
                        <h2 className="text-zinc-500 uppercase font-bold text-sm tracking-widest border-b border-white/5 pb-2">My Friends ({friends.length})</h2>
                        {friends.map(friend => (
                            <div key={friend.id} className="flex items-center justify-between p-4 bg-zinc-900/40 border border-white/5 rounded-2xl">
                                <div className="flex items-center gap-4">
                                    {friend.image ? (
                                        <img src={friend.image} alt={friend.name} className="w-12 h-12 rounded-[1rem] object-cover border border-white/10 shadow-lg" />
                                    ) : (
                                        <div className="w-12 h-12 bg-zinc-800 rounded-[1rem] flex items-center justify-center border border-white/5">
                                            <UserRound className="h-5 w-5 text-zinc-500" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-white tracking-wide">{friend.name}</p>
                                        <div className="flex flex-row items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Online</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-800/80 hover:bg-zinc-700 transition">
                                        <MessageCircle className="h-4 w-4 text-zinc-300" />
                                    </button>
                                    <button onClick={() => startCall(friend)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition">
                                        <Phone className="h-4 w-4 fill-white text-white" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {friends.length === 0 && (
                            <div className="p-8 text-center text-zinc-500 text-sm font-semibold uppercase tracking-widest border border-dashed border-white/10 rounded-2xl bg-zinc-900/20">
                                No friends yet. Connect with people!
                            </div>
                        )}
                    </div>

                    {/* Requests List */}
                    <div className="space-y-6">
                        <h2 className="text-zinc-500 uppercase font-bold text-sm tracking-widest border-b border-white/5 pb-2">Pending Requests ({requests.length})</h2>
                        {requests.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-4 bg-zinc-900/40 border border-white/5 rounded-2xl transition hover:bg-zinc-900/80">
                                <div className="flex items-center gap-4">
                                    {req.user1.image ? (
                                        <img src={req.user1.image} alt={req.user1.name} className="w-12 h-12 rounded-[1rem] object-cover border border-white/10" />
                                    ) : (
                                        <div className="w-12 h-12 bg-zinc-800 rounded-[1rem] flex items-center justify-center border border-white/5">
                                            <UserRound className="h-5 w-5 text-zinc-500" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-white tracking-wide">{req.user1.name}</p>
                                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Wants to connect</p>
                                    </div>
                                </div>
                                <button onClick={() => acceptRequest(req.id)} className="px-4 py-2.5 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-zinc-200 transition shadow-lg shadow-white/5">
                                    <Check className="h-3.5 w-3.5" /> Accept
                                </button>
                            </div>
                        ))}
                        {requests.length === 0 && (
                            <div className="p-8 text-center text-zinc-500 text-sm font-semibold uppercase tracking-widest border border-dashed border-white/10 rounded-2xl bg-zinc-900/20">
                                No pending requests.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
