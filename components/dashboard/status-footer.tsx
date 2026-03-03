"use client"

import { useNina } from "@/lib/nina-context"
import { cn } from "@/lib/utils"
import { Wifi, WifiOff, Activity, AlertTriangle, Target, Camera, Loader2 } from "lucide-react"

export function StatusFooter() {
    const { lastStatus, isWebSocketConnected } = useNina()

    const getStatusStyles = (type: string, priority: number) => {
        if (priority >= 10) return "text-red-400 bg-red-500/15 border-red-500/40 animate-pulse"
        switch (type) {
            case "error": return "text-red-400 bg-red-500/10 border-red-500/20"
            case "warning": return "text-amber-400 bg-amber-500/10 border-amber-500/20"
            case "status": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            default: return "text-sky-400 bg-sky-500/10 border-sky-500/20"
        }
    }

    return (
        <footer className="h-7 border-t border-border bg-[#050505] flex items-center px-3 justify-between text-[10px] font-mono tracking-wider uppercase select-none z-50">
            <div className="flex items-center gap-4 overflow-hidden">
                {/* Connection Status */}
                <div className="flex items-center gap-1.5 shrink-0 border-r border-border/50 pr-4">
                    <div className="relative flex h-2 w-2">
                        {isWebSocketConnected && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/40 opacity-75"></span>
                        )}
                        <span className={cn(
                            "relative inline-flex h-2 w-2 rounded-full",
                            isWebSocketConnected ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                        )}></span>
                    </div>
                    <span className={cn("font-bold text-[9px]", isWebSocketConnected ? "text-emerald-500/70" : "text-red-500/70")}>
                        {isWebSocketConnected ? "NINA LIVE" : "NINA OFFLINE"}
                    </span>
                </div>

                {/* Status Message */}
                {lastStatus ? (
                    <div className={cn(
                        "flex items-center gap-2 px-2 py-0.5 rounded border transition-all duration-500 animate-in fade-in slide-in-from-bottom-1",
                        getStatusStyles(lastStatus.type, lastStatus.priority)
                    )}>
                        <span className="font-bold flex items-center gap-1.5">
                            {lastStatus.priority >= 10 && <AlertTriangle className="h-3 w-3" />}
                            {lastStatus.text}
                        </span>
                        <span className="opacity-40 tabular-nums border-l border-current/20 pl-2 ml-1">
                            {lastStatus.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-muted-foreground/40 italic">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Waiting for events...</span>
                    </div>
                )}
            </div>

            {/* Right side info */}
            <div className="flex items-center gap-4 text-muted-foreground/30 shrink-0 ml-4 font-bold">
                <div className="flex items-center gap-1">
                    <Activity className="h-2.5 w-2.5" />
                    <span className="text-[8px]">V2 STREAM ACTIVE</span>
                </div>
            </div>
        </footer>
    )
}
