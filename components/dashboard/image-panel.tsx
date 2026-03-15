"use client"

import React, { useCallback, useMemo, useState, useEffect } from "react"
import {
  ImageIcon,
  Star,
  Focus,
  CircleDot,
  BarChart3,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Clock,
  Grid3x3,
  Loader2
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip as RadixTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useNina } from "@/lib/nina-context"
import { useNinaPolling } from "@/lib/use-nina-polling"
import {
  getImageHistory,
  getPreparedImageUrl,
  getFullImageUrl,
  getThumbnailImageUrl,
  getCameraInfo,
  getLiveStackStatus,
  getLiveStackAvailableImages,
  getLiveStackInfo,
  getLiveStackImageUrl
} from "@/lib/nina-api"
import {
  ImageHistoryItem,
  LiveStackStatusResponse,
  LiveStackAvailableTarget,
  LiveStackInfo
} from "@/lib/nina-types"
import { StatusBadge } from "./status-badge"
import { cn, formatNumber, toNumber } from "@/lib/utils"
import { analyzeImageStars, ImageAnalysisResult } from "@/lib/star-analysis"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
const HistogramChart = React.memo(({ imageUrl, stats }: { imageUrl: string, stats: any }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!imageUrl) return

    const calcHistogram = async () => {
      setLoading(true)
      try {
        console.log("[HistogramChart] Calculating histogram for:", imageUrl.substring(0, 100) + "...")
        const img = new Image()
        // If it's a blob URL, we don't need anonymous crossOrigin
        if (!imageUrl.startsWith('blob:')) {
          img.crossOrigin = "anonymous"
        }

        const loadPromise = new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = (e) => {
            console.error("[HistogramChart] Image load error:", e)
            reject(new Error("Failed to load image for histogram"))
          }
        })
        img.src = imageUrl
        await loadPromise

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error("Could not get canvas context")

        // Downsample for performance
        const size = 200
        canvas.width = size
        canvas.height = size
        ctx.drawImage(img, 0, 0, size, size)

        const imageData = ctx.getImageData(0, 0, size, size).data
        const rBins = new Array(256).fill(0)
        const gBins = new Array(256).fill(0)
        const bBins = new Array(256).fill(0)

        for (let i = 0; i < imageData.length; i += 4) {
          rBins[imageData[i]]++
          gBins[imageData[i + 1]]++
          bBins[imageData[i + 2]]++
        }

        const chartData = []
        for (let i = 0; i < 256; i++) {
          chartData.push({
            bin: i,
            r: rBins[i],
            g: gBins[i],
            b: bBins[i],
          })
        }
        setData(chartData)
        console.log("[HistogramChart] Data calculated. Bins:", chartData.length)
      } catch (err) {
        console.error("Histogram error:", err)
        setData([]) // Clear data on error
      } finally {
        setLoading(false)
      }
    }
    calcHistogram()
  }, [imageUrl])

  if (loading) return <div className="h-32 flex items-center justify-center"><Skeleton className="h-24 w-full" /></div>

  return (
    <div className="flex flex-col gap-3 p-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl w-[320px]">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[10px] font-mono font-bold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3" /> Histogram
        </span>
      </div>

      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <Area type="monotone" dataKey="r" stroke="#ef4444" fillOpacity={1} fill="url(#colorR)" isAnimationActive={false} strokeWidth={1} />
            <Area type="monotone" dataKey="g" stroke="#22c55e" fillOpacity={1} fill="url(#colorG)" isAnimationActive={false} strokeWidth={1} />
            <Area type="monotone" dataKey="b" stroke="#3b82f6" fillOpacity={1} fill="url(#colorB)" isAnimationActive={false} strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/5 pt-2">
        <StatRow label="Mean" value={formatNumber(stats?.Mean, 1)} />
        <StatRow label="Median" value={formatNumber(stats?.Median, 0)} />
        <StatRow label="Min" value={formatNumber(stats?.Min, 0)} />
        <StatRow label="Max" value={formatNumber(stats?.Max, 0)} />
        <StatRow label="StDev" value={formatNumber(stats?.StDev, 1)} />
      </div>
    </div>
  )
})

function StatRow({ label, value }: { label: string, value: any }) {
  return (
    <div className="flex justify-between items-center font-mono">
      <span className="text-[9px] text-white/40 uppercase">{label}</span>
      <span className="text-[10px] text-white/80 font-bold">{value || "--"}</span>
    </div>
  )
}

function ImageStat({ label, value, highlight, className }: { label: string, value: any, highlight?: boolean, className?: string }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-1 px-1 border-r border-border/50 last:border-r-0",
      highlight && !className && "bg-primary/5"
    )}>
      <span className="text-[8px] text-muted-foreground/60 uppercase tracking-tighter mb-0.5">{label}</span>
      <span className={cn(
        "text-[10px] font-mono font-bold tabular-nums",
        !className && (highlight ? "text-primary" : "text-foreground"),
        className
      )}>{value || "--"}</span>
    </div>
  )
}

function getEccentricityColor(ecc: number) {
  if (ecc < 0.45) return "text-emerald-400"
  if (ecc < 0.6) return "text-amber-400"
  return "text-red-400"
}

export function ImagePanel() {
  const {
    settings,
    addApiLog,
    sessionData,
    imageHistory: data,
    camera: cameraData,
    isPollingLoading: isLoading,
    pollingError: error
  } = useNina()

  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const [exposureProgress, setExposureProgress] = useState({ progress: 0, remaining: 0 })
  const [showHistogram, setShowHistogram] = useState(false)
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [displayedDialogIndex, setDisplayedDialogIndex] = useState<number | null>(null)
  const [isBlobLoading, setIsBlobLoading] = useState(false)

  // -- LiveStack States --
  const [isLiveStackMode, setIsLiveStackMode] = useState(false)
  const [liveStackInfo, setLiveStackInfo] = useState<LiveStackInfo | null>(null)
  const [isLiveStackLoading, setIsLiveStackLoading] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const handleLiveStackClick = async () => {
    setIsLiveStackLoading(true)
    try {
      // 1. Check Status
      const status = await getLiveStackStatus(settings.host, settings.port)
      if (status.toLowerCase() !== "running") {
        alert(`LIVESTACK not RUNNING\nStatus: ${status}`)
        setIsLiveStackLoading(false)
        return
      }

      // 2. Discover available targets
      const availableTargets = await getLiveStackAvailableImages(settings.host, settings.port)
      const rgbTarget = availableTargets.find(t => t.Filter === "RGB")

      if (!rgbTarget) {
        alert("Nessun target RGB disponibile in LiveStack.")
        setIsLiveStackLoading(false)
        return
      }

      // 3. Get Info
      const info = await getLiveStackInfo(settings.host, settings.port, rgbTarget.Target, rgbTarget.Filter)
      setLiveStackInfo(info)
      setIsLiveStackMode(true)
      setIsPreviewOpen(true)
    } catch (err) {
      console.error("[ImagePanel] LiveStack Error:", err)
      alert("Errore durante il recupero del LiveStack.")
    } finally {
      setIsLiveStackLoading(false)
    }
  }

  // Exposure countdown logic (moved here for better visibility)
  useEffect(() => {
    if (!cameraData?.IsExposing || !cameraData?.ExposureEndTime) {
      setExposureProgress({ progress: 0, remaining: 0 })
      return
    }

    const updateProgress = () => {
      const match = cameraData.ExposureEndTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
      if (!match) return

      const datePart = match[0]
      const tzMatch = cameraData.ExposureEndTime.match(/([+-]\d{2}:\d{2}|Z)$/)
      const tzPart = tzMatch ? tzMatch[0] : ""

      const endTime = new Date(datePart + tzPart).getTime()
      const now = Date.now()
      const remainingMs = endTime - now
      const remainingSec = Math.max(0, remainingMs / 1000)

      const totalSeconds = Number(cameraData.ExposureTime) || Number(sessionData?.exposureTime) || 0
      const totalMs = totalSeconds * 1000
      let progress = 0

      if (totalMs > 0) {
        progress = Math.min(100, Math.max(0, ((totalMs - remainingMs) / totalMs) * 100))
      } else {
        progress = 100
      }

      setExposureProgress({ progress, remaining: remainingSec })
    }

    const timer = setInterval(updateProgress, 100)
    updateProgress()
    return () => clearInterval(timer)
  }, [cameraData?.IsExposing, cameraData?.ExposureEndTime, cameraData?.ExposureTime, sessionData?.exposureTime])


  // Image cache-bust key
  const [imageKey, setImageKey] = useState(0)


  const [frozenImage, setFrozenImage] = useState<ImageHistoryItem | null>(null)
  const [frozenIndex, setFrozenIndex] = useState<number | null>(null)

  const lastImage = data && data.length > 0 ? data[data.length - 1] : null
  const lastImageIndex = data && data.length > 0 ? data.length - 1 : null

  const activeImage = frozenImage || (historyIndex !== null && data ? data[historyIndex] : lastImage)
  const activeIndex = frozenIndex !== null ? frozenIndex : (historyIndex !== null ? historyIndex : lastImageIndex)

  const isHistoryMode = historyIndex !== null && historyIndex !== lastImageIndex && !frozenImage

  // Extract frame number from filename (pattern: ..._$$FRAMENR$$.fits) - kept only for DISPLAY
  const displayFrameNumber = useMemo(() => {
    if (!activeImage?.Filename) return null
    const base = activeImage.Filename.split(/[\\/]/).pop() || ""
    const withoutExt = base.split('.').slice(0, -1).join('.')
    const parts = withoutExt.split('_')
    if (parts.length === 0) return null
    const lastPart = parts[parts.length - 1]
    return /^\d+$/.test(lastPart) ? lastPart : null
  }, [activeImage?.Filename])

  // Determine settings for image loading
  const { imageResize, imageWidth, imageHeight, imageQuality, imageDebayer, imageAutoprepared } = settings

  // High Quality Image URL for Fullscreen
  const fullImageUrl = useMemo(() => {
    if (isLiveStackMode && liveStackInfo) {
      return getLiveStackImageUrl(settings.host, settings.port, liveStackInfo.Target, liveStackInfo.Filter, settings.imageQuality)
    }
    if (activeIndex !== null) {
      return getFullImageUrl(settings.host, settings.port, activeIndex, {
        resize: settings.imageResize,
        width: settings.imageWidth,
        height: settings.imageHeight,
        debayer: settings.imageDebayer,
        quality: settings.imageQuality,
        autoprepared: settings.imageAutoprepared
      })
    }
    return null
  }, [isLiveStackMode, liveStackInfo, activeIndex, settings.host, settings.port, settings.imageResize, settings.imageWidth, settings.imageHeight, settings.imageDebayer, settings.imageQuality, settings.imageAutoprepared])

  // Blob caching for performance
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  // Star Analysis state
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    // Only fetch high-res if we are in dialog mode (frozenIndex is set) or LiveStack is active
    if ((frozenIndex === null && !isLiveStackMode) || !fullImageUrl) {
      return
    }

    let active = true
    const controller = new AbortController()

    const loadBlob = async () => {
      setIsBlobLoading(true)
      try {
        console.log('[ImagePanel] Fetching image blob:', fullImageUrl, isLiveStackMode ? '(LiveStack)' : `(Index: ${frozenIndex})`)
        const res = await fetch(fullImageUrl, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const blob = await res.blob()

        if (active) {
          const url = URL.createObjectURL(blob)

          setBlobUrl(prev => {
            if (prev) URL.revokeObjectURL(prev) // Revoke old one to prevent memory leak
            return url
          })

          if (!isLiveStackMode) {
            setDisplayedDialogIndex(frozenIndex) // Sync label ONLY when blob is ready
          }
          setIsBlobLoading(false)
          console.log('[ImagePanel] Blob URL created:', url)

          // Start star analysis
          setIsAnalyzing(true)
          analyzeImageStars(url).then(res => {
            if (active) {
              setAnalysisResult(res)
              setIsAnalyzing(false)
              console.log('[ImagePanel] Star analysis complete:', res)
            }
          })
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("[ImagePanel] Error loading full image blob:", err)
        }
      } finally {
        if (active) setIsBlobLoading(false)
      }
    }

    loadBlob()

    return () => {
      active = false
      controller.abort()
    }
  }, [frozenIndex, fullImageUrl]) // Now depends on frozenIndex and fullImageUrl

  // Cleanup blob on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  // Fullscreen state
  const [showInspector, setShowInspector] = useState(false)



  const hfrChartData = useMemo(() => {
    if (!data || data.length === 0) return []
    // Show full history (auto-expanding)
    return data.map((item, i) => ({
      index: i, // Raw array index
      displayIndex: item.Id || (i + 1),
      hfr: toNumber(item.HFR),
      stars: item.Stars || 0,
    }))
  }, [data])

  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const clickedIndex = state.activePayload[0].payload.index
      setHistoryIndex(clickedIndex)
    }
  }

  // Arrow key navigation when a chart point is selected
  useEffect(() => {
    if (historyIndex === null || !data || data.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        setHistoryIndex(prev => {
          if (prev === null) return prev
          return Math.min(prev + 1, data.length - 1)
        })
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        setHistoryIndex(prev => {
          if (prev === null) return prev
          return Math.max(prev - 1, 0)
        })
      } else if (e.key === "Escape") {
        setHistoryIndex(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [historyIndex, data])

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) setZoom(z => Math.min(z + 0.5, 10))
    else setZoom(z => Math.max(z - 0.5, 1))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    setIsDragging(true)
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const resetView = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  return (
    <Card className="flex flex-col h-full bg-card border-border overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-1.5 px-3 space-y-0 border-b border-border flex-shrink-0 bg-muted/5">
        <div className="flex items-center gap-2 shrink-0">
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
          <CardTitle className="text-[10px] font-mono font-bold text-foreground/80 uppercase tracking-tight">
            Image
          </CardTitle>
          <div className="flex items-center gap-1.5 ml-2">
            {isHistoryMode ? (
              <Button
                variant="outline"
                size="sm"
                className="h-5 px-1.5 bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20 text-[8px] font-bold py-0 group"
                onClick={() => setHistoryIndex(null)}
              >
                <RotateCcw className="h-2.5 w-2.5 mr-1 group-hover:rotate-[-45deg] transition-transform" />
                HISTORY
              </Button>
            ) : (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[8px] font-bold text-emerald-400 uppercase tracking-widest">
                <span className="h-1 w-1 bg-emerald-400 rounded-full animate-pulse" />
                Live
              </div>
            )}
          </div>
          {activeImage?.TargetName && (
            <span className="text-[10px] text-primary/80 font-mono font-bold border-l border-border pl-2 ml-1">
              {activeImage.TargetName}
            </span>
          )}
        </div>

        {/* Filename centered */}
        <div className="flex-1 text-center px-4 overflow-hidden hidden md:block">
          <span className="text-[9px] font-mono text-muted-foreground/50 truncate italic select-all" title={activeImage?.Filename}>
            {activeImage?.Filename ? activeImage.Filename.split(/[\\/]/).pop() : "--"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {cameraData?.IsExposing && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400">
              <Clock className="h-3 w-3 animate-pulse" />
              <span>{formatNumber(exposureProgress.remaining, 0)}s</span>
            </div>
          )}

          <TooltipProvider>
            <RadixTooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-[9px] font-mono uppercase tracking-widest transition-all",
                    isLiveStackLoading ? "opacity-50 cursor-wait" : "bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary hover:text-primary"
                  )}
                  onClick={handleLiveStackClick}
                  disabled={isLiveStackLoading}
                >
                  {isLiveStackLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse mr-1.5" />
                  )}
                  LiveStack
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground">
                <p className="text-xs">LiveStack Preview</p>
              </TooltipContent>
            </RadixTooltip>
          </TooltipProvider>

          <span className="text-[10px] font-mono bg-muted/40 px-2 py-0.5 rounded border border-border/50 text-muted-foreground tabular-nums">
            {activeIndex !== null ? `Frame #${activeIndex}` : "--"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-3 flex-1 h-full">
            <Skeleton className="flex-1 w-full rounded-lg" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 p-4">
            <p className="text-xs text-destructive font-mono text-center">
              {error}
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Image preview with Dialog for Fullscreen */}
            <div className="flex-1 min-h-0 bg-[#070707] relative group overflow-hidden flex flex-col">
              {lastImage ? (
                <Dialog open={isPreviewOpen} onOpenChange={(open) => {
                  setIsPreviewOpen(open)
                  if (open && activeImage && activeIndex !== null && !isLiveStackMode) {
                    setFrozenImage(activeImage)
                    setFrozenIndex(activeIndex)
                  } else if (!open) {
                    setFrozenImage(null)
                    setFrozenIndex(null)
                    setIsLiveStackMode(false)
                    setLiveStackInfo(null)
                    setShowInspector(false)
                    setShowHistogram(false)
                    setZoom(1)
                    setPosition({ x: 0, y: 0 })
                  }
                }}>
                  <DialogTrigger asChild>
                    <div className="flex-1 h-full cursor-zoom-in flex items-center justify-center relative min-h-0">
                      <div className="relative group/img-container h-full w-full flex items-center justify-center">
                        {activeIndex !== null && (
                          <img
                            key={activeIndex}
                            src={getThumbnailImageUrl(settings.host, settings.port, activeIndex)}
                            alt="Target frame"
                            className="max-w-full max-h-full object-contain transition-transform group-hover:scale-[1.01] duration-700"
                          />
                        )}
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 bg-black border-border overflow-hidden">
                    <div className="absolute top-4 left-6 z-50 pointer-events-none">
                      <DialogTitle className="text-white font-mono flex items-center gap-4">
                        <div className="flex items-center gap-2 px-2 py-1 bg-primary/20 rounded border border-primary/40 backdrop-blur-md">
                          <ImageIcon className="h-3 w-3" />
                          <span className="text-[10px] tracking-widest uppercase">{isLiveStackMode ? "LiveStack" : "Preview"}</span>
                        </div>
                        <div className="flex flex-col leading-none">
                          <span className="text-lg tracking-tight">
                            {isLiveStackMode ? (liveStackInfo?.Target || "Stacking") : (activeImage?.TargetName || "Unknown Target")}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal opacity-80 mt-0.5 uppercase tracking-widest">
                            {isLiveStackMode ? `STACKS: ${liveStackInfo?.RedStackCount || "--"}` : `FRAME ID: #${displayedDialogIndex !== null ? displayedDialogIndex : "--"}`}
                          </span>
                        </div>
                        {!showInspector && (
                          <span className="text-muted-foreground text-[10px] font-normal px-2 py-0.5 bg-white/5 rounded">
                            {formatNumber(zoom, 1)}x Zoom
                          </span>
                        )}
                        {showInspector && (
                          <span className="text-primary text-[10px] font-bold px-2 py-0.5 bg-primary/10 rounded border border-primary/20">
                            ABERRATION INSPECTOR
                          </span>
                        )}
                      </DialogTitle>
                      <DialogDescription className="sr-only">
                        Fullscreen preview of the captured astronomical image with zoom, pan, and aberration inspection tools
                      </DialogDescription>
                    </div>

                    {/* Histogram Overlay */}
                    {showHistogram && displayedDialogIndex !== null && (
                      <div className="absolute top-4 right-16 z-50 animate-in fade-in zoom-in duration-200">
                        <HistogramChart imageUrl={blobUrl || ""} stats={historyIndex !== null && data ? data[historyIndex] : lastImage!} />
                      </div>
                    )}

                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-black/60 backdrop-blur-2xl px-6 py-3 rounded-full border border-white/10 shadow-2xl">
                      {!showInspector && (
                        <>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/10 rounded-full text-white/70" onClick={() => setZoom(z => Math.max(z - 1, 1))}>
                              <ZoomOut className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/10 rounded-full text-white/70" onClick={() => setZoom(z => Math.min(z + 1, 10))}>
                              <ZoomIn className="h-5 w-5" />
                            </Button>
                          </div>
                          <div className="h-6 w-px bg-white/10" />
                        </>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-9 w-9 hover:bg-white/10 rounded-full transition-colors", showInspector ? "text-primary bg-primary/10" : "text-white/70")}
                        onClick={() => setShowInspector(!showInspector)}
                        title="Aberration Inspector"
                      >
                        <Grid3x3 className="h-5 w-5" />
                      </Button>

                      <div className="h-6 w-px bg-white/10" />

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-9 w-9 hover:bg-white/10 rounded-full transition-colors", showHistogram ? "text-primary bg-primary/10" : "text-white/70")}
                        onClick={() => setShowHistogram(!showHistogram)}
                      >
                        <BarChart3 className="h-5 w-5" />
                      </Button>
                      <div className="h-6 w-px bg-white/10" />
                      <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/10 rounded-full text-white/70" onClick={resetView}>
                        <RotateCcw className="h-5 w-5" />
                      </Button>
                      <div className="h-6 w-px bg-white/10" />
                      <span className="text-[10px] font-mono whitespace-nowrap text-white/40 select-none uppercase tracking-widest">
                        {showInspector ? "INSPECTOR MODE" : "WHEEL ZOOM / DRAG PAN"}
                      </span>
                    </div>

                    {showInspector ? (
                      <div className="w-full h-full relative bg-black">
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5 bg-black">
                          {[
                            { pos: "left top", key: "topLeft" as const },
                            { pos: "center top", key: "top" as const },
                            { pos: "right top", key: "topRight" as const },
                            { pos: "left center", key: "left" as const },
                            { pos: "center center", key: "center" as const },
                            { pos: "right center", key: "right" as const },
                            { pos: "left bottom", key: "bottomLeft" as const },
                            { pos: "center bottom", key: "bottom" as const },
                            { pos: "right bottom", key: "bottomRight" as const }
                          ].map(({ pos, key }, i) => (
                            <div
                              key={i}
                              className="w-full h-full relative overflow-hidden border border-white/10 bg-black group/tile"
                              style={{
                                backgroundImage: blobUrl ? `url(${blobUrl})` : undefined,
                                backgroundPosition: pos,
                                backgroundRepeat: 'no-repeat',
                                backgroundSize: 'auto', // 1:1 pixel mapping
                              }}
                            >
                              {analysisResult && (
                                <div className={cn(
                                  "absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[9px] font-mono transition-colors",
                                  getEccentricityColor(analysisResult.regions[key])
                                )}>
                                  E: {formatNumber(analysisResult.regions[key], 2)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Global Loading Overlay for Inspector */}
                        {isBlobLoading && (
                          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-[2px]">
                            <div className="flex flex-col items-center gap-2 bg-black/60 p-4 rounded-xl border border-white/10 shadow-2xl">
                              <Loader2 className="h-8 w-8 text-primary animate-spin" />
                              <span className="text-xs font-mono text-white/80 uppercase tracking-widest">Updating Inspector...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center overflow-hidden cursor-move relative bg-[#050505]"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        {blobUrl ? (
                          <img
                            src={blobUrl}
                            alt="Fullscreen frame"
                            draggable={false}
                            className="max-w-full max-h-full object-contain transition-transform duration-75 ease-out selection:bg-transparent"
                            style={{
                              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-12 w-12 text-primary animate-spin" />
                            <span className="text-muted-foreground font-mono text-xs uppercase tracking-widest animate-pulse">
                              Initial Load...
                            </span>
                          </div>
                        )}

                        {/* Transition Overlay */}
                        {isBlobLoading && blobUrl && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/40 backdrop-blur-[2px] transition-all duration-300">
                            <div className="flex flex-col items-center gap-3 bg-black/60 p-6 rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                              <Loader2 className="h-8 w-8 text-primary animate-spin" />
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] font-mono text-white/80 uppercase tracking-[0.2em]">Loading Frame</span>
                                <span className="text-lg font-mono text-primary font-bold">#{frozenIndex}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4">
                  <ImageIcon className="h-8 w-8 opacity-30" />
                  <p className="text-xs font-mono">No images captured yet</p>
                </div>
              )}
            </div>

            {/* BARRA DI AVANZAMENTO ESPOSIZIONE (Larghezza Piena sotto immagine) */}
            {cameraData?.IsExposing && (
              <div className="px-4 py-2 border-y border-border bg-emerald-500/5">
                <div className="flex justify-between items-center mb-1.5 font-mono text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold uppercase tracking-wider">Exposing</span>
                    <span className="text-muted-foreground px-1.5 py-0.5 bg-background rounded border border-border">
                      {formatNumber((Number(cameraData.ExposureTime) || Number(sessionData?.exposureTime) || 0) - exposureProgress.remaining, 1)}s / {cameraData.ExposureTime || sessionData?.exposureTime}s
                    </span>
                  </div>
                  <span className="text-emerald-400 font-bold">{formatNumber(exposureProgress.progress, 1)}%</span>
                </div>
                <Progress value={exposureProgress.progress} className="h-2.5 bg-emerald-500/10" />
              </div>
            )}

            {lastImage && (
              <div className="flex flex-col flex-shrink-0">
                {/* Stats row - Tighter */}
                <div className="grid grid-cols-7 gap-px bg-border/20 border-b border-border">
                  <ImageStat label="HFR" value={formatNumber(activeImage?.HFR, 2)} highlight />
                  <ImageStat label="Stars" value={activeImage?.Stars?.toString() ?? "--"} highlight />
                  <ImageStat
                    label="ECC"
                    value={isAnalyzing ? "..." : formatNumber(analysisResult?.globalAverage, 2)}
                    highlight={!!analysisResult}
                    className={analysisResult ? getEccentricityColor(analysisResult.globalAverage) : ""}
                  />
                  <ImageStat label="Filter" value={activeImage?.Filter ?? "--"} />
                  <ImageStat label="Type" value={activeImage?.ImageType ?? "--"} />
                  <ImageStat label="Exp" value={`${formatNumber(activeImage?.ExposureTime, 0)}s`} />
                  <ImageStat label="Mean" value={formatNumber(activeImage?.Mean, 0)} />
                </div>


                <div className="px-4 py-1 bg-muted/10 h-[80px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={hfrChartData}
                      margin={{ top: 3, right: 3, left: 3, bottom: 3 }}
                      onClick={handleChartClick}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                      <XAxis dataKey="index" tick={false} axisLine={false} tickLine={false} height={0} />
                      <YAxis yAxisId="hfr" tick={false} axisLine={false} tickLine={false} width={0} domain={['dataMin - 0.2', 'dataMax + 0.2']} />
                      <YAxis yAxisId="stars" orientation="right" tick={false} axisLine={false} tickLine={false} width={0} domain={['dataMin - 10', 'dataMax + 10']} />
                      <Tooltip
                        labelFormatter={(value) => `ID: ${value}`}
                        formatter={(value: any, name: string) => {
                          if (name === "hfr") return [formatNumber(value, 2), "HFR"]
                          if (name === "stars") return [value, "Stars"]
                          return [value, name]
                        }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "10px",
                        }}
                      />
                      <Line
                        yAxisId="hfr"
                        type="monotone"
                        dataKey="hfr"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          if (payload.index === historyIndex) {
                            return <circle key={`dot-hfr-${payload.index}`} cx={cx} cy={cy} r={4} fill="#3b82f6" />
                          }
                          return <path key={`empty-hfr-${props.index}`} d="" />
                        }}
                        activeDot={{ r: 4, fill: "#3b82f6" }}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="stars"
                        type="monotone"
                        dataKey="stars"
                        stroke="#fbbf24"
                        strokeWidth={1.5}
                        strokeOpacity={0.8}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          if (payload.index === historyIndex) {
                            return <circle key={`dot-stars-${payload.index}`} cx={cx} cy={cy} r={3} fill="#fbbf24" />
                          }
                          return <path key={`empty-stars-${props.index}`} d="" />
                        }}
                        activeDot={{ r: 3, fill: "#fbbf24" }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
