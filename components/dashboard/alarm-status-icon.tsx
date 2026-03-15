"use client"

import { BellRing, Bell } from "lucide-react"
import { useNina } from "@/lib/nina-context"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Alarm status icon in header.
 * - Gray/muted: no alarms in log
 * - Red + animated: at least one active CRITICAL alarm
 * - Yellow: active WARNING alarms (no CRITICAL)
 * - Returns to normal color when all alarms resolved
 */
export function AlarmStatusIcon() {
    const { activeAlarms, alarmLog, hasActiveCritical, setAlarmDrawerOpen } = useNina()

    const unackedAlarms = activeAlarms.filter(a => !a.acked)
    const hasActiveWarning = unackedAlarms.some((a) => a.level === "WARNING")
    const hasHistory = alarmLog.length > 0

    const iconColor = hasActiveCritical
        ? "text-red-500"
        : hasActiveWarning
            ? "text-yellow-400"
            : hasHistory
                ? "text-muted-foreground"
                : "text-muted-foreground/30"

    // Icon with "ring" only if there are unacked alarms
    const Icon = unackedAlarms.length > 0 ? BellRing : Bell

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => setAlarmDrawerOpen(true, true)}
                        className={cn(
                            "relative h-8 w-8 flex items-center justify-center rounded-md",
                            "hover:bg-muted/50 transition-colors",
                            iconColor
                        )}
                    >
                        <Icon
                            className={cn(
                                "h-4 w-4 transition-colors",
                                hasActiveCritical && "animate-pulse"
                            )}
                        />
                        {/* Badge counter: only for unacked ones */}
                        {unackedAlarms.length > 0 && (
                            <span
                                className={cn(
                                    "absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center",
                                    "rounded-full text-[8px] font-mono font-bold text-white",
                                    hasActiveCritical ? "bg-red-600" : "bg-yellow-500"
                                )}
                            >
                                {unackedAlarms.length > 9 ? "9+" : unackedAlarms.length}
                            </span>
                        )}
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">
                    {hasActiveCritical
                        ? "Active Critical Alarm – click for log"
                        : hasActiveWarning
                            ? "Active Warning – click for log"
                            : hasHistory
                                ? "Session Alarm Log"
                                : "No Alarms"}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
