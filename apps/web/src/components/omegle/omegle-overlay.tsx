"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOmegle } from "../../hooks/use-omegle";
import { useMeQuery } from "../../hooks/use-me-query";
import { VideoRoom } from "../omegle/video-room";
import {
    X,
    Video,
    Loader2,
    ArrowRight,
    UserRound,
    Sparkles,
    Search,
    Shield,
} from "lucide-react";

// ─── Main Overlay ───
export default function OmegleOverlay() {
    const {
        isOpen,
        step,
        displayName,
        email,
        myGender,
        preference,
        matchData,
        localStream,
        setDisplayName,
        setEmail,
        setMyGender,
        setPreference,
        setStep,
        closeOmegle,
        startSearching,
        skip,
        leave,
        requestMedia,
    } = useOmegle();

    const router = useRouter();
    const { data: meData, isLoading: authLoading } = useMeQuery(true);
    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const [autoProgressed, setAutoProgressed] = useState(false);

    // Identity Handling: Pre-fill and Auto-skip
    useEffect(() => {
        if (!meData?.user) return;

        if (meData.user.email && !email) {
            setEmail(meData.user.email);
        }
        if (meData.user.name && !displayName) {
            setDisplayName(meData.user.name);
        }

    }, [meData, email, displayName, setEmail, setDisplayName]);

    // Attach local stream to preview video
    useEffect(() => {
        if (videoPreviewRef.current && localStream) {
            videoPreviewRef.current.srcObject = localStream;
        }
    }, [localStream, step]);

    if (!isOpen && step === "idle") return null;

    const handleClose = () => {
        leave();
        router.push("/home");
    };

    return (
        <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-3xl">
            {/* Close button */}
            <button
                onClick={handleClose}
                className="absolute right-6 top-6 z-50 rounded-full bg-white/5 p-2.5 text-zinc-400 border border-white/5 transition-all hover:bg-white/10 hover:text-white"
            >
                <X className="h-5 w-5" />
            </button>

            {/* Content Switcher */}
            <div className="w-full h-full flex items-center justify-center p-4">
                {step === "setup" && (
                    <SetupScreen
                        displayName={displayName}
                        email={email}
                        myGender={myGender}
                        setDisplayName={setDisplayName}
                        setMyGender={setMyGender}
                        meData={meData}
                        authLoading={authLoading}
                        onContinue={async () => {
                            const stream = await requestMedia();
                            if (stream) setStep("camera-test");
                        }}
                    />
                )}

                {step === "camera-test" && (
                    <CameraTestScreen
                        videoPreviewRef={videoPreviewRef}
                        preference={preference}
                        setPreference={setPreference}
                        onStart={() => startSearching()}
                    />
                )}

                {step === "searching" && <SearchingScreen />}

                {step === "connected" && matchData && (
                    <VideoRoom
                        roomName={matchData.roomName}
                        token={matchData.token}
                        partnerName={matchData.partnerName}
                        onSkip={skip}
                        onLeave={leave}
                        matchedAt={matchData.matchedAt}
                    />
                )}

                {step === "partner-left" && (
                    <PartnerLeftScreen
                        onFindNext={() => startSearching()}
                        onClose={handleClose}
                    />
                )}
            </div>
        </div>
    );
}

// ─── Screen 1: Setup (Modern Neutral) ───
function SetupScreen({
    displayName,
    email,
    myGender,
    setDisplayName,
    setMyGender,
    meData,
    authLoading,
    onContinue,
}: {
    displayName: string;
    email: string;
    myGender: "any" | "male" | "female";
    setDisplayName: (name: string) => void;
    setMyGender: (gender: "any" | "male" | "female") => void;
    meData: any;
    authLoading: boolean;
    onContinue: () => void;
}) {
    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 w-full max-w-md">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900/40 p-10 shadow-3xl backdrop-blur-2xl">
                {/* Subtle highlight */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-zinc-400/5 blur-3xl" />

                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-zinc-800 border border-white/10 shadow-2xl">
                            {meData?.user?.image ? (
                                <img
                                    src={meData.user.image}
                                    alt="Avatar"
                                    className="h-full w-full rounded-2xl object-cover p-1"
                                />
                            ) : (
                                <UserRound className="h-10 w-10 text-zinc-500" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="text-center space-y-2 mb-10">
                    <h2 className="text-3xl font-bold uppercase tracking-tight text-white">
                        VIDEO CHAT
                    </h2>
                    <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2">
                        <Shield className="h-3 w-3" />
                        Authenticated Entry
                    </p>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="mb-2 block text-[10px] font-semibold uppercase text-zinc-600 tracking-wider">
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full rounded-2xl border border-white/5 bg-white/5 px-5 py-4 text-white placeholder-zinc-700 outline-none transition-all focus:border-white/20 focus:bg-white/10"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-semibold uppercase text-zinc-600 tracking-wider">
                            I Am A
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: "Secret", value: "any" },
                                { label: "Male", value: "male" },
                                { label: "Female", value: "female" },
                            ].map((gender) => (
                                <button
                                    key={gender.value}
                                    onClick={() => setMyGender(gender.value as any)}
                                    className={`rounded-2xl border px-3 py-4 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                                        myGender === gender.value
                                            ? "border-white bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                                            : "border-white/5 bg-white/5 text-zinc-500 hover:border-white/20 hover:text-white"
                                    }`}
                                >
                                    {gender.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-semibold uppercase text-zinc-600 tracking-wider">
                            Account Info
                        </label>
                        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-zinc-950/40 border border-white/5 text-zinc-500 text-sm">
                            <span className="truncate">{email || "No account detected"}</span>
                        </div>
                    </div>

                    <button
                        onClick={onContinue}
                        disabled={!displayName.trim() || authLoading}
                        className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white text-black px-6 py-5 font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                    >
                        {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "PROCEED TO CHAT"}
                        {!authLoading && <ArrowRight className="h-5 w-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Screen 2: Camera Test ───
function CameraTestScreen({
    videoPreviewRef,
    preference,
    setPreference,
    onStart,
}: {
    videoPreviewRef: React.RefObject<HTMLVideoElement | null>;
    preference: "any" | "male" | "female";
    setPreference: (pref: "any" | "male" | "female") => void;
    onStart: () => void;
}) {
    const preferences: { label: string; value: "any" | "male" | "female" }[] = [
        { label: "Everyone", value: "any" },
        { label: "Male Only", value: "male" },
        { label: "Female Only", value: "female" },
    ];

    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 w-full max-w-5xl">
            <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-zinc-900/40 shadow-3xl backdrop-blur-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Camera Preview */}
                    <div className="relative aspect-video md:aspect-auto bg-black border-r border-white/5">
                        <video
                            ref={videoPreviewRef}
                            autoPlay
                            playsInline
                            muted
                            className="h-full w-full object-cover mirror"
                        />
                        <div className="absolute top-6 left-6 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-[10px] font-bold text-white uppercase tracking-widest backdrop-blur-md border border-white/10">
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                            Live Preview
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col justify-center p-12 lg:p-16 space-y-10">
                        <div className="space-y-3">
                            <h3 className="text-4xl font-bold uppercase text-white">
                                CHAT<br />SETTINGS
                            </h3>
                            <p className="text-zinc-500 text-sm font-medium">
                                Configure your discovery settings before we match you with others.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-[10px] font-semibold uppercase text-zinc-600 tracking-widest">
                                Matching Preference
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {preferences.map((pref) => (
                                    <button
                                        key={pref.value}
                                        onClick={() => setPreference(pref.value)}
                                        className={`rounded-2xl border px-3 py-4 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                                            preference === pref.value
                                                ? "border-white bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                                                : "border-white/5 bg-white/5 text-zinc-500 hover:border-white/20 hover:text-white"
                                        }`}
                                    >
                                        {pref.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={onStart}
                            className="group flex w-full items-center justify-between gap-3 rounded-3xl bg-white text-black px-8 py-6 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <span>START DISCOVERY</span>
                            <div className="bg-black text-white rounded-full p-2 group-hover:translate-x-1 transition-transform">
                                <ArrowRight className="h-5 w-5" />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                .mirror { transform: scaleX(-1); }
            `}</style>
        </div>
    );
}

// ─── Screen 3: Searching Animation ───
function SearchingScreen() {
    return (
        <div className="animate-in fade-in duration-700 flex flex-col items-center justify-center space-y-10">
            <div className="relative flex items-center justify-center">
                <div className="absolute h-48 w-48 animate-[ping_3s_infinite] rounded-full border border-white/5" />
                <div className="absolute h-32 w-32 animate-[ping_2s_infinite] rounded-full border border-white/10" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-zinc-900 border border-white/10 shadow-3xl">
                    <Search className="h-8 w-8 text-white animate-pulse" />
                </div>
            </div>

            <div className="text-center space-y-3">
                <h3 className="text-2xl font-bold tracking-tight uppercase text-white">LOOKING FOR STRANGERS...</h3>
                <div className="flex items-center justify-center gap-3 text-zinc-600 text-[10px] font-semibold uppercase tracking-widest">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Bypassing Queue
                </div>
            </div>
        </div>
    );
}

// ─── Screen 5: Partner Left ───
function PartnerLeftScreen({
    onFindNext,
    onClose,
}: {
    onFindNext: () => void;
    onClose: () => void;
}) {
    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center justify-center max-w-sm w-full">
            <div className="w-full relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900/40 p-10 shadow-3xl text-center space-y-8">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-950 border border-white/5">
                    <UserRound className="h-10 w-10 text-zinc-700" />
                </div>

                <div className="space-y-2">
                    <h3 className="text-2xl font-bold uppercase text-white">PARTNER LEFT</h3>
                    <p className="text-sm font-medium text-zinc-500">
                        The connection was terminated by the remote peer.
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={onFindNext}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white text-black px-6 py-4 font-bold transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Search className="h-4 w-4" />
                        FIND NEXT
                    </button>
                    <button
                        onClick={onClose}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-6 py-4 font-bold text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
                    >
                        CLOSE
                    </button>
                </div>
            </div>
        </div>
    );
}
