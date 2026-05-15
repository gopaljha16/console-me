"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOmegleStore } from "@/store/omegle-store";
import { useSocket } from "./use-socket";
import { API_BASE } from "@/utils/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useOmegle() {
    const store = useOmegleStore();
    const router = useRouter();
    const { socket } = useSocket();
    const queryClient = useQueryClient();

    // 1. Polling Query
    const { data: pollData } = useQuery({
        queryKey: ["omegle-poll"],
        queryFn: async () => {
            const { displayName, preference, myGender } = useOmegleStore.getState();
            const res = await fetch(`${API_BASE}/api/v1/omegle/poll`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ displayName, preference, myGender }),
            });
            if (!res.ok) throw new Error("Failed to poll");
            return res.json();
        },
        enabled: store.step === "searching",
        refetchInterval: 3000,
    });

    useEffect(() => {
        if (pollData?.status === "matched") {
            const currentStore = useOmegleStore.getState();
            currentStore.setMatchData(pollData.data);
            currentStore.setStep("connected");
            queryClient.invalidateQueries({ queryKey: ["omegle-poll"] });
        }
    }, [pollData, queryClient]);

    // 2. Join Mutation
    const joinMutation = useMutation({
        mutationFn: async () => {
            const { displayName, email, preference, myGender } = useOmegleStore.getState();
            const res = await fetch(`${API_BASE}/api/v1/omegle/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ displayName, email, preference, myGender }),
            });
            if (!res.ok) throw new Error("Failed to join");
            return res.json();
        },
        onSuccess: (data) => {
            if (data.status === "matched") {
                store.setMatchData(data.data);
                store.setStep("connected");
            } else {
                store.setStep("searching");
            }
        },
    });

    const startSearching = useCallback(() => {
        // Stop local camera stream used in setup so LiveKit can use it later
        const stream = useOmegleStore.getState().localStream;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            useOmegleStore.getState().setLocalStream(null);
        }

        joinMutation.mutate();
    }, [joinMutation]);

    // 3. Skip Mutation
    const skipMutation = useMutation({
        mutationFn: async () => {
            const { displayName, preference, myGender } = useOmegleStore.getState();
            const res = await fetch(`${API_BASE}/api/v1/omegle/skip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ displayName, preference, myGender }),
            });
            if (!res.ok) throw new Error("Failed to skip");
            return res.json();
        },
        onSuccess: (data) => {
            if (data.status === "matched") {
                store.setMatchData(data.data);
                store.setStep("connected");
            } else {
                store.setMatchData(null);
                store.setStep("searching");
            }
        },
    });

    const skip = useCallback(() => {
        const { matchData } = useOmegleStore.getState();
        if (socket && matchData?.partnerId) {
            socket.emit("omegle:skip", { partnerId: matchData.partnerId });
        }
        skipMutation.mutate();
    }, [socket, skipMutation]);

    // 4. Leave Mutation
    const leaveMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_BASE}/api/v1/omegle/leave`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to leave");
            return res.json();
        },
    });

    const leave = useCallback(() => {
        const { matchData } = useOmegleStore.getState();
        if (socket && matchData?.partnerId) {
            socket.emit("omegle:leave", { partnerId: matchData.partnerId });
        }
        leaveMutation.mutate();
        store.setStep("idle");
        store.closeOmegle();
    }, [socket, leaveMutation, store]);

    // Request camera/mic access
    const requestMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            store.setLocalStream(stream);
            return stream;
        } catch (err) {
            console.error("[Omegle] Media access denied:", err);
            return null;
        }
    }, [store]);

    // Listen for socket events
    useEffect(() => {
        if (!socket) return;

        const handlePartnerLeft = () => {
            store.setStep("partner-left");
        };

        socket.on("omegle:partner-left", handlePartnerLeft);

        return () => {
            socket.off("omegle:partner-left", handlePartnerLeft);
        };
    }, [socket, store]);

    return {
        ...store,
        startSearching,
        skip,
        leave,
        requestMedia,
        isJoining: joinMutation.isPending,
        isSkipping: skipMutation.isPending,
    };
}
