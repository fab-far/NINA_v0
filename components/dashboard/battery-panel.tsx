"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Battery, Zap, Activity, BatteryLow, BatteryMedium, BatteryFull, AlertTriangle, BatteryWarning } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useNina } from "@/lib/nina-context"
import { getBatteryStatus, BatteryResponse } from "@/lib/transfer-api"
import { cn, formatNumber } from "@/lib/utils"

export default function BatteryPanel() {
    const { settings, isConnected, addApiLog, battery: data, batteryError: error } = useNina()
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

    useEffect(() => {
        if (data) setLastUpdate(new Date())
    }, [data])

    const stats = useMemo(() => {
        if (!data || data.status !== "running") return null

        const voltage = data.battery_voltage
        const current = data.load_current
        const watt = data.load_watt
        const wh = data.consumed_wh

        // Calculations
        const consumedAh = wh / 13
        const totalCapacityAh = 50
        const remainingAh = Math.max(0, totalCapacityAh - consumedAh)
        const batteryPercentage = (remainingAh / totalCapacityAh) * 100

        // Alert conditions
        const isLowVoltage = voltage < 11.8
        const isLowBattery = batteryPercentage < 15

        return {
            voltage,
            current,
            watt,
            wh,
            consumedAh,
            batteryPercentage,
            isLowVoltage,
            isLowBattery,
            status: data.status
        }
    }, [data])

    const getStatusColor = () => {
        if (!isConnected || error) return "text-destructive"
        if (!data) return "text-muted-foreground"
        if (data.status === "starting") return "text-amber-500"
        if (data.status === "running") {
            if (stats?.isLowVoltage || stats?.isLowBattery) return "text-destructive animate-pulse"
            return "text-emerald-500"
        }
        return "text-muted-foreground"
    }

    const getBatteryColor = (pct: number) => {
        if (pct < 15) return "bg-destructive"
        if (pct < 30) return "bg-amber-500"
        return "bg-emerald-500"
    }

    const getBatteryIcon = (pct: number, className?: string) => {
        if (pct < 10) return <BatteryWarning className={cn(className, "text-destructive")} />
        if (pct < 25) return <BatteryLow className={cn(className, "text-destructive")} />
        if (pct < 60) return <BatteryMedium className={cn(className, "text-amber-500")} />
        return <BatteryFull className={cn(className, "text-emerald-500")} />
    }

    return (
        <Card className="flex flex-col h-full bg-card border-border overflow-hidden">
            <CardHeader className="py-1.5 px-2.5 border-b border-border/50 bg-muted/20">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-1.5 text-muted-foreground">
                        {stats ? getBatteryIcon(stats.batteryPercentage, "h-3 w-3") : <Battery className="h-3 w-3" />}
                        BATTERY_STATE
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {lastUpdate && (
                            <span className="text-[6.5px] text-muted-foreground/50 uppercase font-mono">
                                {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        )}
                        <div className={cn("text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-black/20", getStatusColor())}>
                            {error ? "OFFLINE" : (data?.status?.toUpperCase() || "CONNECTING...")}
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-2 flex flex-col gap-2 flex-1 overflow-y-auto">
                {!data || data.status === "starting" ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 opacity-50">
                        <Activity className="h-4 w-4 animate-pulse text-primary" />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-center">
                            {data?.message || "Initializing..."}
                        </span>
                    </div>
                ) : (
                    <>
                        {/* Telemetry Grid - Priority Info First */}
                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-muted/30 p-1.5 rounded border border-border/50">
                                <span className="text-[7.5px] uppercase text-muted-foreground block mb-0.5">Voltage</span>
                                <div className={cn(
                                    "text-xs font-mono font-bold",
                                    stats!.isLowVoltage ? "text-destructive" : "text-foreground"
                                )}>
                                    {formatNumber(stats!.voltage, 2)}<span className="text-[9px] ml-0.5 font-normal text-muted-foreground">V</span>
                                </div>
                            </div>
                            <div className="bg-muted/30 p-1.5 rounded border border-border/50">
                                <span className="text-[7.5px] uppercase text-muted-foreground block mb-0.5">Load Current</span>
                                <div className="text-xs font-mono font-bold text-foreground">
                                    {formatNumber(stats!.current, 2)}<span className="text-[9px] ml-0.5 font-normal text-muted-foreground">A</span>
                                </div>
                            </div>
                            <div className="bg-muted/30 p-1.5 rounded border border-border/50">
                                <span className="text-[7.5px] uppercase text-muted-foreground block mb-0.5">Instant Power</span>
                                <div className="text-xs font-mono font-bold text-primary">
                                    {formatNumber(stats!.watt, 1)}<span className="text-[9px] ml-0.5 font-normal text-muted-foreground">W</span>
                                </div>
                            </div>
                            <div className="bg-muted/30 p-1.5 rounded border border-border/50">
                                <span className="text-[7.5px] uppercase text-muted-foreground block mb-0.5">Efficiency (Today)</span>
                                <div className="text-xs font-mono font-bold text-emerald-500">
                                    {Math.round(data!.yield_today)}<span className="text-[9px] ml-0.5 font-normal text-muted-foreground text-emerald-500/60">Wh</span>
                                </div>
                            </div>
                        </div>

                        {/* Battery Level Bar - Moved Below Power Stats */}
                        <div className="space-y-1 mt-0.5">
                            <div className="flex justify-between items-end text-[9px] font-mono">
                                <span className="text-muted-foreground uppercase flex items-center gap-1">
                                    {getBatteryIcon(stats!.batteryPercentage, "h-2.5 w-2.5")}
                                    Remaining
                                </span>
                                <span className={cn(
                                    "font-bold text-[10px]",
                                    stats!.isLowBattery ? "text-destructive" : "text-emerald-500"
                                )}>
                                    {Math.round(stats!.batteryPercentage)}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-white/5">
                                <div
                                    className={cn("h-full transition-all duration-1000", getBatteryColor(stats!.batteryPercentage))}
                                    style={{ width: `${stats!.batteryPercentage}%` }}
                                />
                            </div>
                        </div>

                        {/* Consumption Details - Single Row */}
                        <div className="mt-0.5 pb-0.5 border-t border-white/5 pt-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                    <Zap className="h-2.5 w-2.5 text-amber-500" />
                                    <span className="text-[8px] uppercase font-bold text-muted-foreground">Used:</span>
                                </div>
                                <div className="flex items-center gap-3 text-[9px] font-mono">
                                    <span className="text-foreground">{formatNumber(stats!.wh, 1)} <span className="text-muted-foreground/60 text-[7px]">Wh</span></span>
                                    <div className="w-[1px] h-2 bg-white/5" />
                                    <span className="text-amber-500 font-bold">{formatNumber(stats!.consumedAh, 2)} <span className="text-amber-500/60 text-[7px]">Ah</span></span>
                                </div>
                            </div>
                        </div>

                        {/* Alerts */}
                        {(stats!.isLowVoltage || stats!.isLowBattery) && (
                            <div className="mt-1 bg-destructive/10 border border-destructive/20 p-1 rounded flex items-center justify-center gap-1.5 animate-pulse">
                                <AlertTriangle className="h-2.5 w-2.5 text-destructive" />
                                <span className="text-[8px] font-bold text-destructive uppercase">
                                    {stats!.isLowBattery ? "Low Battery" : "Low Voltage"}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
