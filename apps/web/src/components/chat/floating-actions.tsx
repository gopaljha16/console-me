"use client";

import { Mail, Compass, Users } from "lucide-react";
import { useHomeUIStore } from "@/store/home-ui-store";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function FloatingActions() {
    const { isChatPopoverOpen, setChatPopoverOpen } = useHomeUIStore();
    const pathname = usePathname();

    // Don't show these actions on the dedicated chat page
    if (pathname.startsWith("/chat")) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4">
            <Link
                href="/friends"
                className="flex items-center justify-center h-[54px] w-[54px] rounded-full bg-blue-600 border border-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform hover:scale-105 active:scale-95"
            >
                <Users className="h-6 w-6" />
            </Link>
            <button
                type="button"
                className="flex items-center justify-center h-[54px] w-[54px] rounded-full bg-black border border-zinc-800 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform hover:scale-105 active:scale-95"
            >
                <Compass className="h-6 w-6" />
            </button>
            <button
                type="button"
                onClick={() => setChatPopoverOpen(!isChatPopoverOpen)}
                className="flex items-center justify-center h-[54px] w-[54px] rounded-full bg-black border border-zinc-800 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform hover:scale-105 active:scale-95"
            >
                <Mail className="h-6 w-6" />
            </button>
        </div>
    );
}
