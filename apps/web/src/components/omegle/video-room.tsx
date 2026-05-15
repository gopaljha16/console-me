"use client";

import { useCallback, useState, useEffect } from "react";
import {
    LiveKitRoom,
    VideoTrack,
    useTracks,
    useDataChannel,
    useRoomContext,
    useParticipants,
    RoomAudioRenderer,
    useConnectionState,
    useLocalParticipant,
} from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import {
    Mic,
    MicOff,
    VideoIcon,
    VideoOff,
    SkipForward,
    PhoneOff,
    Send,
    UserRound,
    MessageCircle,
    Loader2,
    X,
    Shield,
    UserPlus,
} from "lucide-react";
import { API_BASE } from "@/utils/constants";
import { useMutation } from "@tanstack/react-query";

interface VideoRoomProps {
    roomName: string;
    token: string;
    partnerName: string;
    onSkip: () => void;
    onLeave: () => void;
    matchedAt?: number;
}

export function VideoRoom({
    roomName,
    token,
    partnerName,
    onSkip,
    onLeave,
    matchedAt,
}: VideoRoomProps) {
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

    useEffect(() => {
        console.log("[VideoRoom] Initializing with:", {
            livekitUrl,
            roomName,
            hasToken: !!token,
        });
    }, [livekitUrl, roomName, token]);

    if (!livekitUrl) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-white p-8 text-center">
                <div className="max-w-md space-y-6">
                    <div className="mx-auto w-16 h-16 rounded-3xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                        <VideoOff className="h-6 w-6 text-zinc-500" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold tracking-tight uppercase">Configuration Error</h3>
                        <p className="text-zinc-500 text-sm font-medium">
                            The LiveKit service is not configured correctly.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-white">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="h-12 w-12 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                        <Shield className="absolute inset-0 m-auto h-4 w-4 text-zinc-500" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 animate-pulse">Requesting Clearance...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500 h-full w-full bg-black">
            <LiveKitRoom
                serverUrl={livekitUrl}
                token={token}
                connect={true}
                audio={true}
                video={true}
                className="h-full w-full"
                onConnected={() => console.log("[LiveKit] Successfully connected to room:", roomName)}
                onDisconnected={() => console.log("[LiveKit] Disconnected from room:", roomName)}
                onError={(err) => console.error("[LiveKit] Room error:", err)}
            >
                <VideoCallUI
                    partnerName={partnerName}
                    onSkip={onSkip}
                    onLeave={onLeave}
                    matchedAt={matchedAt}
                />
                <RoomAudioRenderer />
            </LiveKitRoom>
        </div>
    );
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function VideoCallUI({
    partnerName,
    onSkip,
    onLeave,
    matchedAt,
}: {
    partnerName: string;
    onSkip: () => void;
    onLeave: () => void;
    matchedAt?: number;
}) {
    const room = useRoomContext();
    const connectionState = useConnectionState();
    const { localParticipant } = useLocalParticipant();
    const participants = useParticipants();
    
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: false },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<{ sender: string; text: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [timeConnected, setTimeConnected] = useState(0);
    const [friendStatus, setFriendStatus] = useState<"idle" | "sent">("idle");

    useEffect(() => {
        if (connectionState === ConnectionState.Connected && localParticipant) {
            localParticipant.setCameraEnabled(true).catch(e => console.error("Failed to enable camera:", e));
            localParticipant.setMicrophoneEnabled(true).catch(e => console.error("Failed to enable mic:", e));
        }
    }, [connectionState, localParticipant]);

    const onDataReceived = useCallback(
        (msg: any) => {
            try {
                const payload = msg.payload || msg;
                const text = decoder.decode(payload);
                setChatMessages((prev) => [...prev, { sender: partnerName, text }]);
            } catch (e) {
                console.error("[Chat] Error decoding message:", e);
            }
        },
        [partnerName]
    );

    const { send } = useDataChannel("chat", onDataReceived);

    const sendMessage = (): void => {
        if (!chatInput.trim() || !send) return;
        const msg = chatInput.trim();
        send(encoder.encode(msg), { reliable: true });
        setChatMessages((prev) => [...prev, { sender: "You", text: msg }]);
        setChatInput("");
    };

    const toggleMic = () => {
        const nextState = !isMuted;
        localParticipant.setMicrophoneEnabled(!nextState);
        setIsMuted(nextState);
    };

    const toggleVideo = () => {
        const nextState = !isVideoOff;
        localParticipant.setCameraEnabled(!nextState);
        setIsVideoOff(nextState);
    };

    const localVideoTrack = tracks.find(
        (t) => t.participant.isLocal && t.source === Track.Source.Camera
    );

    const remoteVideoTrack = tracks.find(
        (t) => !t.participant.isLocal && t.source === Track.Source.Camera
    );

    const remoteParticipant = participants.find((p) => !p.isLocal);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (connectionState === ConnectionState.Connected && remoteParticipant) {
            timer = setInterval(() => {
                if (matchedAt) {
                    const elapsed = Math.floor((Date.now() - matchedAt) / 1000);
                    setTimeConnected(elapsed > 0 ? elapsed : 0);
                } else {
                    setTimeConnected((prev) => prev + 1);
                }
            }, 1000);
        } else {
            setTimeConnected(0);
        }
        return () => clearInterval(timer);
    }, [connectionState, remoteParticipant, matchedAt]);

    const sendFriendRequest = useMutation({
        mutationFn: async () => {
            if (!remoteParticipant?.identity) throw new Error("No partner identity");
            const res = await fetch(`${API_BASE}/api/v1/friends/request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ targetUserId: remoteParticipant.identity }),
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => setFriendStatus("sent"),
    });

    return (
        <div className="relative flex h-full w-full flex-col md:flex-row gap-0 overflow-hidden bg-zinc-950">
            {/* Left: Your camera */}
            <div className="relative flex-1 bg-black overflow-hidden border-r border-white/5 group">
                {localVideoTrack && (localVideoTrack.publication?.isSubscribed || localVideoTrack.participant.isLocal) ? (
                    <VideoTrack
                        trackRef={localVideoTrack as any}
                        className="h-full w-full object-cover mirror transition-all duration-700"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-900/10 backdrop-blur-3xl">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-3xl bg-zinc-800/50 border border-white/5 flex items-center justify-center">
                                <VideoOff className="h-6 w-6 text-zinc-600" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase text-zinc-600 tracking-widest">
                                {connectionState === ConnectionState.Connecting ? "Initializing..." : "Feed Offline"}
                            </span>
                        </div>
                    </div>
                )}

                <div className="absolute top-6 left-6 px-4 py-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-white transition-colors">
                    LOCAL {isMuted && "• MUTED"}
                </div>
            </div>

            {/* Right: Stranger */}
            <div className="relative flex-1 bg-black overflow-hidden group/remote">
                {remoteVideoTrack ? (
                    <VideoTrack
                        trackRef={remoteVideoTrack as any}
                        className="h-full w-full object-cover transition-all duration-700"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-900/10 backdrop-blur-3xl">
                        <div className="flex flex-col items-center gap-10">
                            <div className="relative">
                                <div className="flex h-32 w-32 items-center justify-center rounded-[3rem] bg-zinc-900 border border-white/5 shadow-3xl">
                                    <UserRound className="h-10 w-10 text-zinc-700" />
                                </div>
                                {connectionState === ConnectionState.Connecting && (
                                    <div className="absolute -inset-4 rounded-full border border-zinc-800 border-t-zinc-600 animate-spin" />
                                )}
                            </div>
                            <div className="text-center space-y-4">
                                <h4 className="text-2xl font-semibold text-white uppercase tracking-tight">{partnerName.toUpperCase()}</h4>
                                <div className="flex items-center justify-center">
                                    {remoteParticipant ? (
                                        <div className="px-4 py-2 rounded-full bg-white/5 border border-white/5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                                            FEED SUSPENDED
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 text-zinc-600 text-[10px] font-semibold uppercase tracking-wider">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Syncing with match
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Partner label */}
                <div className="absolute top-6 left-6 flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    <div className={`h-1.5 w-1.5 rounded-full ${remoteParticipant ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'bg-zinc-800'}`} />
                    {partnerName.toUpperCase()}
                </div>

                <div className="absolute right-6 top-6 flex items-center gap-3">
                    {timeConnected >= 10 && (
                        <button
                            onClick={() => sendFriendRequest.mutate()}
                            disabled={friendStatus === "sent"}
                            className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-[10px] font-semibold uppercase tracking-wider transition-all hover:scale-[1.05] active:scale-95 shadow-2xl ${
                                friendStatus === "sent" 
                                ? "bg-zinc-800 text-zinc-500 border border-white/5" 
                                : "bg-blue-600 text-white shadow-blue-600/20"
                            }`}
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            {friendStatus === "sent" ? "Request Sent" : "Add Friend"}
                        </button>
                    )}

                    <button
                        onClick={onSkip}
                        className="flex items-center gap-2 rounded-2xl bg-white text-black px-6 py-3 text-[10px] font-semibold uppercase tracking-wider transition-all hover:scale-[1.05] active:scale-95 shadow-2xl"
                    >
                        <SkipForward className="h-3.5 w-3.5" />
                        Skip Stranger
                    </button>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 p-3 rounded-[2.5rem] bg-zinc-900/60 backdrop-blur-3xl border border-white/10 shadow-3xl z-50">
                <button
                    onClick={toggleMic}
                    className={`flex h-14 w-14 items-center justify-center rounded-[1.5rem] transition-all duration-300 ${
                        isMuted
                            ? "bg-zinc-800 text-red-500 border border-red-500/20 shadow-lg shadow-red-500/5"
                            : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
                    }`}
                >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <button
                    onClick={toggleVideo}
                    className={`flex h-14 w-14 items-center justify-center rounded-[1.5rem] transition-all duration-300 ${
                        isVideoOff
                            ? "bg-zinc-800 text-red-500 border border-red-500/20 shadow-lg shadow-red-500/5"
                            : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
                    }`}
                >
                    {isVideoOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
                </button>

                <div className="h-8 w-[1px] bg-white/10 mx-2" />

                <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className={`flex h-14 w-14 items-center justify-center rounded-[1.5rem] transition-all duration-300 ${
                        chatOpen
                            ? "bg-white text-black shadow-lg"
                            : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
                    }`}
                >
                    <MessageCircle className="h-5 w-5" />
                </button>

                <button
                    onClick={onLeave}
                    className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-zinc-800 text-zinc-400 border border-white/5 transition-all duration-300 hover:bg-red-600 hover:text-white hover:border-red-500 hover:scale-110 group shadow-lg shadow-red-500/0 hover:shadow-red-500/10"
                >
                    <PhoneOff className="h-5 w-5 transition-transform group-hover:rotate-[135deg]" />
                </button>
            </div>

            {/* Chat Panel */}
            {chatOpen && (
                <div className="animate-in slide-in-from-right-10 fade-in duration-500 absolute bottom-32 right-10 w-96 rounded-[2.5rem] border border-white/10 bg-zinc-900/95 shadow-3xl backdrop-blur-3xl overflow-hidden z-[60]">
                    <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-semibold text-white uppercase tracking-[0.3em] italic">TRANSMISSION</span>
                        </div>
                        <button onClick={() => setChatOpen(false)} className="text-zinc-600 hover:text-white transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="no-scrollbar h-80 overflow-y-auto p-6 space-y-4">
                        {chatMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-20">
                                <MessageCircle className="h-10 w-10 text-zinc-600" />
                                <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">
                                    Silent Room
                                </p>
                            </div>
                        )}
                        {chatMessages.map((msg, i) => (
                            <div
                                key={i}
                                className={`rounded-[1.5rem] px-5 py-3 text-sm max-w-[85%] animate-in slide-in-from-bottom-2 duration-300 ${
                                    msg.sender === "You"
                                        ? "ml-auto bg-white text-black font-medium"
                                        : "bg-zinc-800 text-zinc-200 border border-white/5"
                                }`}
                            >
                                <span className={`block text-[8px] font-semibold uppercase mb-1 tracking-wider ${
                                    msg.sender === "You" ? "text-black/40" : "text-zinc-500"
                                }`}>
                                    {msg.sender.toUpperCase()}
                                </span >
                                <p className="leading-relaxed">{msg.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-white/5">
                        <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/5 p-1 px-2 focus-within:border-white/20 transition-all">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                placeholder="TYPE MESSAGE..."
                                className="flex-1 bg-transparent px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white placeholder-zinc-700 outline-none"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!chatInput.trim()}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black transition-all hover:bg-zinc-100 disabled:opacity-10 active:scale-95"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx global>{`
                .mirror { transform: scaleX(-1); }
            `}</style>
        </div>
    );
}

