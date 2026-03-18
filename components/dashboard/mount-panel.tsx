"use client"

import React, { useCallback } from "react"
import { Compass, Navigation, MapPin, Activity, Map, Timer } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useNina } from "@/lib/nina-context"
import { StatusBadge } from "./status-badge"
import { cn } from "@/lib/utils"
import { SkyMap } from "./sky-map"

export function MountPanel() {
    const { settings, addApiLog, mount: data, isPollingLoading: isLoading, mountError: error } = useNina()

    // Format SideOfPier to be more readable
    const formatPierSide = (side: string | undefined) => {
        if (!side) return "--"
        if (side === "pierEast") return "East"
        if (side === "pierWest") return "West"
        return side
    }

    return (
        <Card className="flex flex-col h-full bg-card border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-1.5 px-3 space-y-0 border-b border-border flex-shrink-0 bg-muted/5">
                <div className="flex items-center gap-2">
                    <Compass className={cn("h-3.5 w-3.5", data?.Connected ? "text-primary" : "text-destructive")} />
                    <CardTitle className="text-[10px] font-mono font-bold text-foreground/80 uppercase tracking-tight">
                        Mount
                    </CardTitle>
                </div>
                {data && (
                    <StatusBadge
                        label={data.Slewing ? "Slewing" : data.TrackingEnabled ? (data.TrackingMode || "Tracking") : "Idle"}
                        variant={data.Slewing ? "running" : data.TrackingEnabled ? "warning" : "idle"}
                        pulse={data.Slewing}
                    />
                )}
            </CardHeader>
            <CardContent className="flex-1 p-2 overflow-hidden flex flex-col">
                {isLoading ? (
                    <div className="grid grid-cols-3 gap-2 p-1 flex-1">
                        <Skeleton className="h-full w-full rounded" />
                        <Skeleton className="h-full w-full rounded" />
                        <Skeleton className="h-full w-full rounded" />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-[10px] text-destructive font-mono text-center px-2">{error}</p>
                    </div>
                ) : data ? (
                    <div className="flex flex-col h-full gap-2">
                        <div className="grid grid-cols-3 gap-1.5 flex-1">
                            {/* Column 1: Equatorial */}
                            <div className="flex flex-col gap-1.5">
                                <MountStat label="RA" value={data.RightAscensionString || "--"} icon={Navigation} />
                                <MountStat label="DEC" value={data.DeclinationString || "--"} icon={Navigation} className="rotate-90" />
                                <MountStat label="Pier Side" value={formatPierSide(data.SideOfPier)} icon={Activity} />
                            </div>

                            {/* Column 2: Horizontal & Meridian */}
                            <div className="flex flex-col gap-1.5">
                                <MountStat label="AZ" value={data.AzimuthString || "--"} icon={Map} />
                                <MountStat label="ALT" value={data.AltitudeString || "--"} icon={MapPin} />
                                <MountStat
                                    label="Flip In"
                                    value={data.HoursToMeridianString || data.TimeToMeridianFlipString || "--"}
                                    icon={Timer}
                                    highlight={data.TimeToMeridianFlip && data.TimeToMeridianFlip < 0.5}
                                />
                            </div>

                            {/* Column 3: Sky Map */}
                            <div className="flex flex-col h-full min-h-0">
                                <Dialog>
                                    <DialogTrigger className="flex-1 flex flex-col cursor-pointer transition-opacity hover:opacity-80 rounded ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-0 text-left border-0 bg-transparent p-0 m-0">
                                        <SkyMap
                                            altitude={data.Altitude}
                                            azimuth={data.Azimuth}
                                            siteLatitude={data.SiteLatitude}
                                            siderealTime={data.SiderealTime}
                                            targetRa={data.RightAscension}
                                            targetDec={data.Declination}
                                            className="h-full"
                                        />
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl w-[95vw] sm:w-[80vw] mx-auto p-4 sm:p-6 !rounded-xl bg-background/95 backdrop-blur-md border-border/50 shadow-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="font-mono uppercase text-sm text-foreground/80 tracking-widest">
                                                Sky Map
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div className="w-full aspect-square sm:aspect-video mt-2 relative">
                                            <SkyMap
                                                altitude={data.Altitude}
                                                azimuth={data.Azimuth}
                                                siteLatitude={data.SiteLatitude}
                                                siderealTime={data.SiderealTime}
                                                targetRa={data.RightAscension}
                                                targetDec={data.Declination}
                                                className="absolute inset-0 w-full h-full !border-0 bg-transparent"
                                                svgClassName="max-w-none h-full w-full"
                                            />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        {/* Bottom Bar */}
                        <div className="mt-auto flex items-center justify-between px-2 py-1 bg-muted/30 rounded border border-border/40">
                            <div className="flex flex-col">
                                <span className="text-[7px] font-mono text-muted-foreground uppercase leading-none">Tracking</span>
                                <span className={cn("text-[9px] font-mono font-bold leading-none mt-0.5", data.TrackingEnabled ? "text-primary" : "text-muted-foreground")}>
                                    {data.TrackingEnabled ? (data.TrackingMode || "Sidereal") : "OFF"}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[7px] font-mono text-muted-foreground uppercase leading-none">LST</span>
                                <span className="text-[9px] font-mono text-foreground/80 leading-none mt-0.5">{data.SiderealTimeString || "--"}</span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}

function MountStat({ label, value, icon: Icon, className, highlight }: any) {
    return (
        <div className="flex flex-col px-2 py-1 bg-muted/20 border border-border/40 rounded">
            <div className="flex items-center gap-1 mb-0.5">
                {Icon && <Icon className={cn("h-2.5 w-2.5 text-muted-foreground/60", className)} />}
                <span className="text-[7px] uppercase tracking-tighter text-muted-foreground/60 font-mono">
                    {label}
                </span>
            </div>
            <span className={cn("text-[10px] font-mono font-bold tabular-nums leading-none truncate", highlight ? "text-amber-400" : "text-foreground/90")}>
                {value}
            </span>
        </div>
    )
}
