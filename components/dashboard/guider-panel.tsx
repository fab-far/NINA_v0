"use client"

import { useCallback, useMemo, useState } from "react"
import { Crosshair, Activity } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useNina } from "@/lib/nina-context"
import { useNinaPolling } from "@/lib/use-nina-polling"
import { getGuiderInfo, getGuiderGraph } from "@/lib/nina-api"
import { StatusBadge } from "./status-badge"
import { cn, formatNumber } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

function guiderStateVariant(state: string) {
  const lower = state?.toLowerCase() ?? ""
  if (lower.includes("guiding")) return "running" as const
  if (lower.includes("calibrating")) return "warning" as const
  if (lower.includes("stopped") || lower.includes("idle")) return "idle" as const
  if (lower.includes("error") || lower.includes("lost")) return "error" as const
  return "idle" as const
}

const POINT_OPTIONS = [
  { value: "50", label: "50 pts" },
  { value: "100", label: "100 pts" },
  { value: "400", label: "400 pts" },
]


export function GuiderPanel() {
  const { settings, updateSettings, addApiLog, guider: guiderInfo, isPollingLoading: infoLoading, guiderError: infoError } = useNina()
  const [pointCount, setPointCount] = useState(String(settings.guideGraphPoints))
  const [unit, setUnit] = useState<"px" | "arcsec">(settings.guideUnit || "arcsec")

  const graphFetcher = useCallback(
    (signal: AbortSignal, onLog?: import("@/lib/nina-api").ApiLogCallback) =>
      getGuiderGraph(settings.host, settings.port, signal, onLog),
    [settings.host, settings.port]
  )

  const { data: graphData } = useNinaPolling({
    fetcher: graphFetcher,
    interval: settings.pollingInterval + 1000,
    enabled: true,
    onLog: addApiLog,
  })

  const pixelScale = guiderInfo?.PixelScale || 1

  const raRMS = useMemo(() => {
    if (!guiderInfo?.RMSError?.RA) return 0
    return unit === "arcsec" ? guiderInfo.RMSError.RA.Arcseconds : guiderInfo.RMSError.RA.Pixel
  }, [guiderInfo?.RMSError?.RA, unit])

  const decRMS = useMemo(() => {
    if (!guiderInfo?.RMSError?.Dec) return 0
    return unit === "arcsec" ? guiderInfo.RMSError.Dec.Arcseconds : guiderInfo.RMSError.Dec.Pixel
  }, [guiderInfo?.RMSError?.Dec, unit])

  const totalRMS = useMemo(() => {
    if (!guiderInfo?.RMSError?.Total) return 0
    return unit === "arcsec" ? guiderInfo.RMSError.Total.Arcseconds : guiderInfo.RMSError.Total.Pixel
  }, [guiderInfo?.RMSError?.Total, unit])

  const chartData = useMemo(() => {
    const steps = graphData?.GuideSteps
    if (!steps || steps.length === 0) return []
    const maxPoints = Number.parseInt(pointCount, 10) || 100
    const slice = steps.slice(-maxPoints)

    return slice.map((step, i) => {
      let ra = step.RADistanceRaw || 0
      let dec = step.DECDistanceRaw || 0

      // Convert to arcsec if needed. Raw is usually in pixels.
      if (unit === "arcsec") {
        ra *= pixelScale
        dec *= pixelScale
      }

      return {
        index: i,
        ra: Number(formatNumber(ra, 2, "0")),
        dec: Number(formatNumber(dec, 2, "0")),
      }
    })
  }, [graphData, pointCount, unit, pixelScale])

  function handlePointChange(value: string) {
    setPointCount(value)
    updateSettings({ guideGraphPoints: Number.parseInt(value, 10) })
  }

  function toggleUnit() {
    const newUnit = unit === "px" ? "arcsec" : "px"
    setUnit(newUnit)
    updateSettings({ guideUnit: newUnit })
  }

  const isGuiding = guiderInfo?.State?.toLowerCase().includes("guiding")

  return (
    <Card className="flex flex-col h-full bg-card border-border overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-1.5 px-3 space-y-0 border-b border-border flex-shrink-0 bg-muted/5">
        <div className="flex items-center gap-2">
          <Crosshair className={cn("h-3.5 w-3.5", guiderInfo?.Connected ? "text-primary" : "text-destructive")} />
          <CardTitle className="text-[10px] font-mono font-bold text-foreground/80 uppercase tracking-tight">
            Guider
          </CardTitle>

          {/* Header RMS Info */}
          {guiderInfo?.Connected && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
              <div className="flex flex-col leading-none">
                <span className="text-[7px] text-muted-foreground uppercase font-mono tracking-tighter">Total RMS</span>
                <span className="text-[11px] font-mono font-bold text-primary leading-none mt-0.5">
                  {formatNumber(totalRMS, 2)}{unit === "arcsec" ? '"' : "px"}
                </span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[7px] text-blue-400/60 uppercase font-mono tracking-tighter">RA</span>
                <span className="text-[10px] font-mono font-bold text-blue-400 leading-none mt-0.5">
                  {formatNumber(raRMS, 2)}
                </span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[7px] text-red-400/60 uppercase font-mono tracking-tighter">DEC</span>
                <span className="text-[10px] font-mono font-bold text-red-400 leading-none mt-0.5">
                  {formatNumber(decRMS, 2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Unit Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleUnit}
            className="h-5 px-1.5 text-[9px] font-mono bg-muted/30 border-border/50 hover:bg-muted/50 transition-colors"
          >
            {unit === "px" ? "PIX" : 'ARC"'}
          </Button>

          <Select value={pointCount} onValueChange={handlePointChange}>
            <SelectTrigger className="h-5 w-[65px] text-[9px] font-mono bg-muted/30 border-border/50 px-1.5 leading-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {POINT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-[10px] font-mono">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {guiderInfo && (
            <StatusBadge
              label={guiderInfo.State || "Unknown"}
              variant={guiderStateVariant(guiderInfo.State)}
              pulse={isGuiding}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
        {infoLoading ? (
          <div className="p-3 flex flex-col gap-2 flex-1">
            <Skeleton className="flex-1 w-full rounded" />
            <div className="grid grid-cols-3 gap-1">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : infoError ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-[10px] text-destructive font-mono">{infoError}</p>
          </div>
        ) : (
          <>
            {/* Guide Graph */}
            <div className="flex-1 min-h-0 bg-muted/5 relative">
              {chartData.length > 0 ? (
                <>
                  <div className="absolute inset-0 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                        <XAxis dataKey="index" tick={false} axisLine={false} tickLine={false} height={0} />
                        <YAxis
                          tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))", fontFamily: "var(--font-geist-mono)" }}
                          axisLine={false}
                          tickLine={false}
                          domain={unit === "arcsec" ? [-2, 2] : [-1, 1]}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
                        <Line type="monotone" dataKey="ra" stroke="hsl(210, 80%, 60%)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="dec" stroke="hsl(0, 80%, 60%)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Tooltip
                          content={<CustomTooltip unit={unit} />}
                          position={{ y: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Scale Overlay */}
                  <div className="absolute top-2 right-4 text-[8px] font-mono text-muted-foreground/50 pointer-events-none">
                    Scale: {unit === "arcsec" ? '±2"' : "±1px"}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-1 text-muted-foreground opacity-20">
                  <Activity className="h-5 w-5" />
                  <p className="text-[9px] font-mono uppercase tracking-widest leading-loose">Waiting for guide data</p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function CustomTooltip({ active, payload, unit }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/80 backdrop-blur-md border border-white/10 p-2 rounded shadow-xl font-mono text-[9px] flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-blue-400">RA:</span>
          <span className="text-white">{payload[0].value}{unit === "arcsec" ? '"' : "px"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-red-400">DEC:</span>
          <span className="text-white">{payload[1].value}{unit === "arcsec" ? '"' : "px"}</span>
        </div>
      </div>
    )
  }
  return null
}
