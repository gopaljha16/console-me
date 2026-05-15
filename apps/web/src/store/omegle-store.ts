import { create } from "zustand";

export type OmegleStep =
    | "idle"
    | "setup"
    | "camera-test"
    | "searching"
    | "connected"
    | "partner-left";

export interface OmegleMatchData {
    roomName: string;
    token: string;
    partnerId: string;
    partnerName: string;
    matchedAt?: number;
}

type OmegleState = {
    // Flow state
    step: OmegleStep;
    isOpen: boolean;

    // User info
    displayName: string;
    email: string;
    myGender: "any" | "male" | "female";
    preference: "any" | "male" | "female";

    // Match data
    matchData: OmegleMatchData | null;

    // Local media
    localStream: MediaStream | null;

    // Actions
    openOmegle: () => void;
    closeOmegle: () => void;
    setStep: (step: OmegleStep) => void;
    setDisplayName: (name: string) => void;
    setEmail: (email: string) => void;
    setMyGender: (gender: "any" | "male" | "female") => void;
    setPreference: (pref: "any" | "male" | "female") => void;
    setMatchData: (data: OmegleMatchData | null) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    reset: () => void;
};

const initialState = {
    step: "idle" as OmegleStep,
    isOpen: false,
    displayName: "",
    email: "",
    myGender: "any" as const,
    preference: "any" as const,
    matchData: null,
    localStream: null,
};

export const useOmegleStore = create<OmegleState>((set, get) => ({
    ...initialState,

    openOmegle: () => set({ isOpen: true, step: "setup" }),

    closeOmegle: () => {
        // Stop local stream if active
        const stream = get().localStream;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        set({ ...initialState });
    },

    setStep: (step) => set({ step }),
    setDisplayName: (displayName) => set({ displayName }),
    setEmail: (email) => set({ email }),
    setMyGender: (myGender) => set({ myGender }),
    setPreference: (preference) => set({ preference }),
    setMatchData: (matchData) => set({ matchData }),
    setLocalStream: (localStream) => set({ localStream }),

    reset: () => {
        const stream = get().localStream;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        set({ ...initialState });
    },
}));
