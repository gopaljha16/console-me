import { create } from "zustand";

interface CallState {
    activeCallParams: { roomName: string; partnerName: string } | null;
    incomingCall: { fromUserId: string; roomName: string; fromUserName: string } | null;
    setActiveCallParams: (params: { roomName: string; partnerName: string } | null) => void;
    setIncomingCall: (call: { fromUserId: string; roomName: string; fromUserName: string } | null) => void;
}

export const useCallStore = create<CallState>((set) => ({
    activeCallParams: null,
    incomingCall: null,
    setActiveCallParams: (activeCallParams) => set({ activeCallParams }),
    setIncomingCall: (incomingCall) => set({ incomingCall }),
}));
