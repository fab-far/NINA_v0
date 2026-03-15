"use client"

import { useRef, useEffect } from "react"
import { X, Trash2, AlertTriangle, Info, ShieldAlert } from "lucide-react"
import { useNina } from "@/lib/nina-context"
import type { AlarmEntry, AlarmLevel } from "@/lib/nina-types"
import { cn } from "@/lib/utils"

const LEVEL_CONFIG: Record<AlarmLevel, { label: string; color: string; icon: React.ReactNode }> = {
    INFO: {
        label: "INFO",
        color: "text-blue-400 border-blue-400/40 bg-blue-400/5",
        icon: <Info className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />,
    },
    WARNING: {
        label: "Warn",
        color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/5",
        icon: <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />,
    },
    CRITICAL: {
        label: "Crit",
        color: "text-red-400 border-red-400/40 bg-red-400/5",
        icon: <ShieldAlert className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />,
    },
}

function AlarmRow({ entry }: { entry: AlarmEntry }) {
    const { ackSingleAlarm } = useNina()
    const cfg = LEVEL_CONFIG[entry.level]
    const canAck = !entry.acked && !entry.resolved && (entry.level === "WARNING" || entry.level === "CRITICAL")

    return (
        <div className={cn(
            "flex gap-2 p-2 rounded border text-[10px] font-mono transition-opacity",
            entry.acked || entry.resolved
                ? "text-muted-foreground border-border bg-muted/5 opacity-60"
                : cfg.color
        )}>
            {cfg.icon}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="font-bold tracking-wider">{cfg.label}</span>
                    <span className="text-muted-foreground/60 truncate">{entry.source.replace(/_/g, " ")}</span>

                    <div className="ml-auto flex items-center gap-2">
                        {canAck && (
                            <button
                                onClick={() => ackSingleAlarm(entry.id)}
                                className="px-1.5 py-0.5 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground font-bold border border-foreground/20 transition-colors uppercase text-[8px]"
                            >
                                ACK
                            </button>
                        )}
                        {entry.resolved && (
                            <span className="text-green-500/80 font-bold shrink-0 text-[8px] uppercase tracking-tighter">Resolved</span>
                        )}
                        {entry.acked && !entry.resolved && (
                            <span className="text-muted-foreground/40 shrink-0 text-[8px] uppercase tracking-tighter">Acked</span>
                        )}
                    </div>
                </div>
                <span className="text-foreground/80 leading-tight">{entry.message}</span>
                <span className="text-muted-foreground/40 text-[9px]">
                    {entry.timestamp.toLocaleTimeString("en-US")}
                </span>
            </div>
        </div>
    )
}

export function AlarmDrawer() {
    const { alarmDrawerOpen, setAlarmDrawerOpen, alarmLog, clearAlarmLog } = useNina()
    const drawerRef = useRef<HTMLDivElement>(null)

    // Chiudi col tasto Escape
    useEffect(() => {
        if (!alarmDrawerOpen) return
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setAlarmDrawerOpen(false)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [alarmDrawerOpen, setAlarmDrawerOpen])

    return (
        <>
            {/* Backdrop */}
            {alarmDrawerOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9990]"
                    onClick={() => setAlarmDrawerOpen(false)}
                />
            )}

            {/* Drawer */}
            <div
                ref={drawerRef}
                style={{ zIndex: 9991 }}
                className={cn(
                    "fixed top-0 right-0 h-full w-[380px] max-w-full",
                    "bg-card border-l border-border shadow-2xl",
                    "flex flex-col",
                    "transition-transform duration-300 ease-in-out",
                    alarmDrawerOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-red-400" />
                        <span className="font-mono font-bold text-sm text-foreground/90 uppercase tracking-wider">
                            Alarm Log
                        </span>
                        {alarmLog.length > 0 && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                                ({alarmLog.length})
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={clearAlarmLog}
                            title="Clear alarm log"
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            <Trash2 className="h-3 w-3" />
                            Clear
                        </button>
                        <button
                            onClick={() => setAlarmDrawerOpen(false)}
                            className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Lista allarmi */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {alarmLog.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground/30">
                            <Info className="h-6 w-6" />
                            <p className="font-mono text-[10px] uppercase tracking-widest">No alarms recorded</p>
                        </div>
                    ) : (
                        alarmLog.map((entry) => <AlarmRow key={entry.id} entry={entry} />)
                    )}
                </div>
            </div>
        </>
    )
}
