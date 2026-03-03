"use client"

import React, { useCallback } from "react"
import { Camera, Thermometer, Zap, Aperture, Settings2, Fingerprint } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNina } from "@/lib/nina-context"
import { useNinaPolling } from "@/lib/use-nina-polling"
import { getCameraInfo } from "@/lib/nina-api"
import type { CameraState } from "@/lib/nina-types"
import { StatusBadge } from "./status-badge"
import { cn, formatNumber } from "@/lib/utils"

function cameraStateVariant(state: CameraState) {
  switch (state) {
    case "Exposing":
      return "running" as const
    case "Download":
    case "Reading":
    case "Waiting":
      return "warning" as const
    default:
      return "idle" as const
  }
}

function cameraStateLabel(state: CameraState) {
  switch (state) {
    case "Exposing": return "Exposing"
    case "Download": return "Downloading"
    case "Reading": return "Reading"
    case "Waiting": return "Waiting"
    case "NoState": return "Idle"
    default: return state
  }
}

function StatItem({
  label,
  value,
  unit,
  icon: Icon,
  className,
  subValue
}: {
  label: string
  value: string | number
  unit?: string
  icon?: React.ElementType
  className?: string
  subValue?: string
}) {
  return (
    <div className={cn("flex flex-col rounded bg-muted/30 p-2 border border-border/40", className)}>
      <div className="flex items-center gap-1 mb-0.5">
        {Icon && <Icon className="h-2.5 w-2.5 text-muted-foreground" />}
        <span className="text-[8px] uppercase tracking-tighter text-muted-foreground font-mono">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-sm font-mono font-bold text-foreground tabular-nums">
          {value}
        </span>
        {unit && <span className="text-[9px] text-muted-foreground font-mono">{unit}</span>}
      </div>
      {subValue && <span className="text-[8px] text-muted-foreground font-mono leading-none mt-0.5">{subValue}</span>}
    </div>
  )
}

export function CameraPanel() {
  const { settings, addApiLog } = useNina()

  const fetcher = useCallback(
    (signal: AbortSignal, onLog?: import("@/lib/nina-api").ApiLogCallback) =>
      getCameraInfo(settings.host, settings.port, signal, onLog),
    [settings.host, settings.port]
  )

  const { data, error, isLoading } = useNinaPolling({
    fetcher,
    interval: settings.pollingInterval,
    enabled: true,
    onLog: addApiLog,
  })

  const tempDelta = data ? Math.abs(Number(data.Temperature) - Number(data.TemperatureSetPoint)) : 0
  const tempOnTarget = data?.CoolerOn && tempDelta < 1

  const lastDownloadSec = data && (data as any).LastDownloadTime
    ? formatNumber((data as any).LastDownloadTime * 86400, 1)
    : "0.0"

  return (
    <Card className="flex flex-col h-full bg-card border-border overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Camera className={cn("h-4 w-4", data?.Connected ? "text-primary" : "text-destructive")} />
          <CardTitle className="text-xs font-mono font-bold text-foreground uppercase tracking-tight">
            Camera Info
          </CardTitle>
        </div>
        {data && (
          <StatusBadge
            label={data.IsExposing ? "Exposing" : cameraStateLabel(data.CameraState)}
            variant={data.IsExposing ? "running" : cameraStateVariant(data.CameraState)}
            pulse={data.IsExposing}
          />
        )}
      </CardHeader>
      <CardContent className="flex-1 p-3 overflow-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] text-destructive font-mono">{error}</p>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-2">
            {/* Header cam name - Tight */}
            <div className="px-2 py-1 bg-primary/5 rounded border border-primary/10 flex items-center justify-between">
              <span className="text-[10px] font-mono text-primary font-bold truncate max-w-[150px]">
                {data.Name || "No Name"}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground">
                {data.BinX}x{data.BinY} Bin
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatItem
                label="Sensor Temp"
                value={formatNumber(data.Temperature, 1)}
                unit="°C"
                icon={Thermometer}
                className={cn(
                  tempOnTarget && "border-emerald-500/40 bg-emerald-500/5",
                  !data.CoolerOn && "border-destructive/40 bg-destructive/5"
                )}
                subValue={data.CoolerOn ? `Target: ${data.TemperatureSetPoint}°C` : "Cooler OFF"}
              />

              <StatItem
                label="Cooler Power"
                value={data.CoolerOn ? formatNumber(data.CoolerPower, 0) : "0"}
                unit="%"
                icon={Zap}
                className={cn(
                  data.CoolerOn && data.CoolerPower > 0 && "border-amber-500/30 bg-amber-500/5",
                  (!data.CoolerOn || data.CoolerPower === 0) && "border-destructive/40 bg-destructive/5"
                )}
              />

              <StatItem
                label="Gain"
                value={data.Gain}
                icon={Settings2}
              />

              <StatItem
                label="Offset"
                value={data.Offset}
                icon={Fingerprint}
              />

              <StatItem
                label="Last DL"
                value={lastDownloadSec}
                unit="s"
                icon={Aperture}
              />

              <StatItem
                label="Status"
                value={data.IsExposing ? "Exposing" : cameraStateLabel(data.CameraState)}
                className="col-span-1"
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
