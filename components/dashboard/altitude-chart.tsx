"use client"

import React, { useMemo } from "react"
import { TrendingUp, Clock, Sun, Moon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea,
} from "recharts"
import { useNina } from "@/lib/nina-context"
import { useNinaPolling } from "@/lib/use-nina-polling"
import { getMountInfo } from "@/lib/nina-api"
import { generateAltitudeData } from "@/lib/astro-utils"
import { StatusBadge } from "./status-badge"
import { formatNumber } from "@/lib/utils"

export function AltitudeChart() {
    const { settings, addApiLog } = useNina()
    const [currentTime, setCurrentTime] = React.useState(new Date())

    // Internal clock to move "Now" line independently of polling
    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 30000) // Update every 30 seconds
        return () => clearInterval(timer)
    }, [])

    const { data: mountData, isLoading } = useNinaPolling({
        fetcher: (signal, onLog) => getMountInfo(settings.host, settings.port, signal, onLog),
        interval: settings.pollingInterval,
        enabled: true,
        onLog: addApiLog,
    })

    // Calculate Chart Start Time (Noon of current astronomical day)
    const startTime = useMemo(() => {
        const d = new Date()
        // If it's before noon, the "day" started yesterday
        if (d.getHours() < 12) {
            d.setDate(d.getDate() - 1)
        }
        d.setHours(12, 0, 0, 0)
        return d
    }, [])

    const chartData = useMemo(() => {
        if (!mountData) return []
        return generateAltitudeData(
            mountData.RightAscension,
            mountData.Declination,
            mountData.SiteLatitude,
            mountData.SiteLongitude,
            startTime,
            24 // Full 24 hours
        )
    }, [mountData, startTime])

    const segments = useMemo(() => {
        if (chartData.length < 2) return []
        const zones: { x1: number; x2: number; type: string }[] = []

        let currentStart = chartData[0].relHour
        let currentType = getTwilightType(chartData[0].sunAltitude)

        for (let i = 1; i < chartData.length; i++) {
            const type = getTwilightType(chartData[i].sunAltitude)
            if (type !== currentType) {
                zones.push({ x1: currentStart, x2: chartData[i].relHour, type: currentType })
                currentStart = chartData[i].relHour
                currentType = type
            }
        }
        zones.push({ x1: currentStart, x2: chartData[chartData.length - 1].relHour, type: currentType })
        return zones
    }, [chartData])

    const maxAltPoint = useMemo(() => {
        if (chartData.length === 0) return null
        return chartData.reduce((max, p) => p.altitude > max.altitude ? p : max, chartData[0])
    }, [chartData])

    const nowIndex = useMemo(() => {
        if (chartData.length === 0) return -1
        const now = currentTime.getTime()
        let closestIdx = 0
        let minDiff = Infinity
        chartData.forEach((p, i) => {
            const diff = Math.abs(p.timestamp.getTime() - now)
            if (diff < minDiff) {
                minDiff = diff
                closestIdx = i
            }
        })
        return closestIdx
    }, [chartData, currentTime])

    const currentSunAlt = nowIndex !== -1 ? chartData[nowIndex].sunAltitude : 0

    if (isLoading && !mountData) {
        return (
            <Card className="h-full bg-card border-border animate-pulse">
                <CardHeader className="py-1.5 px-3 border-b border-border">
                    <CardTitle className="text-[10px] font-mono font-bold uppercase text-muted-foreground/50">Altitude Chart</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]" />
            </Card>
        )
    }

    return (
        <Card className="flex flex-col h-full bg-card border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-1.5 px-3 space-y-0 border-b border-border flex-shrink-0 bg-muted/5">
                <div className="flex items-center gap-2">
                    {currentSunAlt > 0 ? (
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                    )}
                    <CardTitle className="text-[10px] font-mono font-bold text-foreground/80 uppercase tracking-tight">
                        Altitude Chart
                    </CardTitle>
                </div>
                {mountData && (
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end">
                            <span className="text-[7px] font-mono text-muted-foreground uppercase leading-none">LST</span>
                            <span className="text-[9px] font-mono text-foreground/80 leading-none mt-0.5">{mountData.SiderealTimeString}</span>
                        </div>
                        <div className="flex flex-col items-end border-l border-border/40 pl-2 ml-1">
                            <span className="text-[7px] font-mono text-muted-foreground uppercase leading-none">Alt</span>
                            <span className="text-[9px] font-mono font-bold text-primary leading-none mt-0.5">
                                {formatNumber(mountData.Altitude, 1)}°
                            </span>
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="flex-1 p-0 relative min-h-0 overflow-hidden bg-[#050505]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        {segments.map((s, i) => (
                            <ReferenceArea
                                key={i}
                                x1={s.x1}
                                x2={s.x2}
                                fill={getTwilightColor(s.type)}
                                fillOpacity={1}
                            />
                        ))}

                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />

                        <XAxis
                            dataKey="relHour"
                            tick={{ fontSize: 8, fill: "#444", fontFamily: "monospace" }}
                            axisLine={{ stroke: "#222" }}
                            tickLine={true}
                            ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]}
                            tickFormatter={(val) => {
                                const point = chartData.find(d => Math.abs(d.relHour - val) < 0.1)
                                if (!point) return ""
                                const h = point.timestamp.getHours()
                                return h.toString().padStart(2, '0')
                            }}
                        />

                        <YAxis
                            domain={[0, 90]}
                            ticks={[0, 30, 60, 90]}
                            tick={{ fontSize: 8, fill: "#444", fontFamily: "monospace" }}
                            axisLine={{ stroke: "#222" }}
                            tickLine={false}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        <ReferenceLine y={30} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.2} />

                        {maxAltPoint && (
                            <ReferenceLine
                                x={maxAltPoint.relHour}
                                stroke="hsl(var(--primary))"
                                strokeDasharray="2 2"
                                label={{ value: `${formatNumber(maxAltPoint.altitude, 0)}° Transit`, position: "top", fill: "hsl(var(--primary))", fontSize: 7, fontFamily: 'monospace' }}
                            />
                        )}

                        {nowIndex !== -1 && (
                            <ReferenceLine
                                x={chartData[nowIndex].relHour}
                                stroke="#fff"
                                strokeWidth={1}
                                label={{ value: "Now", position: "insideTopLeft", fill: "#fff", fontSize: 8, fontWeight: 'bold' }}
                            />
                        )}

                        <Area
                            type="monotone"
                            dataKey="altitude"
                            stroke="hsl(var(--primary))"
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#colorAlt)"
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

function getTwilightType(sunAlt: number) {
    if (sunAlt > 0) return "day"
    if (sunAlt > -6) return "civil"
    if (sunAlt > -12) return "nautical"
    if (sunAlt > -18) return "astronomical"
    return "night"
}

function getTwilightColor(type: string) {
    switch (type) {
        case "day": return "#2a2410" // Muted Amber/Yellow
        case "civil": return "#1a1a5a" // Distinct Blue
        case "nautical": return "#12123a" // Darker Blue
        case "astronomical": return "#0a0a22" // Deep Blue-Grey
        case "night": return "#000000" // Pure Black
        default: return "transparent"
    }
}

function CustomTooltip({ active, payload }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        return (
            <div className="bg-black/95 border border-white/10 p-1.5 rounded shadow-2xl">
                <p className="text-[9px] font-mono font-bold text-primary">
                    {data.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
                <p className="text-[11px] font-mono font-bold text-white">
                    ALT: {formatNumber(data.altitude, 1)}°
                </p>
                <div className="mt-1 border-t border-white/5 pt-1">
                    <p className="text-[7px] font-mono text-muted-foreground uppercase leading-none">Sun Altitude</p>
                    <p className="text-[9px] font-mono text-amber-500/80">{formatNumber(data.sunAltitude, 1)}°</p>
                </div>
            </div>
        )
    }
    return null
}
