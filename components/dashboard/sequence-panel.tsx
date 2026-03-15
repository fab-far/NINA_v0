"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Clock,
  SkipForward,
  XCircle,
  Ban,
  ListTree,
  Search,
  Maximize2,
  Info,
  Globe,
  Camera,
  Layers,
  Settings2,
  Play,
  Square,
  RotateCw
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useNina } from "@/lib/nina-context"
import { useNinaPolling } from "@/lib/use-nina-polling"
import { getSequenceState, startSequence, stopSequence, resetSequence } from "@/lib/nina-api"
import type { SequenceItem, SequenceItemStatus } from "@/lib/nina-types"
import { StatusBadge } from "./status-badge"
import { cn } from "@/lib/utils"

function StatusIcon({ status }: { status: SequenceItemStatus }) {
  const iconClass = "h-3.5 w-3.5 flex-shrink-0"
  const normalizedStatus = status?.toUpperCase()

  switch (true) {
    case normalizedStatus === "RUNNING":
      return <Loader2 className={cn(iconClass, "text-emerald-400 animate-spin")} />
    case normalizedStatus === "FINISHED":
      return <CheckCircle2 className={cn(iconClass, "text-emerald-400")} />
    case normalizedStatus === "FAILED":
      return <XCircle className={cn(iconClass, "text-red-400")} />
    case normalizedStatus === "SKIPPED":
      return <SkipForward className={cn(iconClass, "text-muted-foreground/60")} />
    case normalizedStatus === "DISABLED":
      return <Ban className={cn(iconClass, "text-muted-foreground/40")} />
    default:
      return <Clock className={cn(iconClass, "text-muted-foreground")} />
  }
}

function SequenceParamGrid({ item, isWide = false }: { item: SequenceItem; isWide?: boolean }) {
  const ignoreKeys = ['Items', 'Conditions', 'Triggers', 'GlobalTriggers', 'Name', 'Status', 'Category', 'Description', 'Progress', 'Attempts', 'ImageType', 'Script', 'ScriptPath', 'FlipStatus', 'Message', 'Reason', 'flip_status', 'externscript', 'ProcessedScript', 'Temperature', 'SelectedDevice']
  const parameters = Object.entries(item)
    .filter(([key, value]) => !ignoreKeys.includes(key) && value !== null && value !== undefined && value !== "" && typeof value !== 'object')

  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {/* Special: Exposure */}
      {item.ExposureTime && (
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 text-[9px] h-5 flex items-center gap-1">
          <Camera className="h-3 w-3" /> {item.ExposureTime}s
        </Badge>
      )}
      {/* Special: Coordinates */}
      {/* Special: Coordinates */}
      {item.Coordinates && (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] h-5 flex items-center gap-1">
          <Globe className="h-3 w-3" />
          {item.Coordinates.RAHours !== undefined ? (
            <>
              <span>{item.Coordinates.RAHours}h {item.Coordinates.RAMinutes ?? 0}m</span>
              <span className="opacity-50 mx-0.5">|</span>
              <span>{item.Coordinates.NegativeDec ? '-' : '+'}{item.Coordinates.DecDegrees ?? 0}° {item.Coordinates.DecMinutes ?? 0}'</span>
            </>
          ) : (
            <>
              <span>{item.Coordinates.RAString}</span>
              {item.Coordinates.RAString && item.Coordinates.DecString && <span className="opacity-50 mx-0.5">|</span>}
              <span>{item.Coordinates.DecString}</span>
            </>
          )}
        </Badge>
      )}
      {/* Generic Params */}
      {parameters.slice(0, isWide ? 15 : 3).map(([key, value]) => (
        <Badge key={key} variant="outline" className="text-[9px] h-5 border-white/5 bg-white/5 text-muted-foreground">
          {key}: {String(value)}
        </Badge>
      ))}

      {/* Verbose/Special Fields */}
      {(item.ScriptPath || item.externscript) && (
        <Badge variant="outline" className="text-[9px] h-5 border-blue-500/20 bg-blue-500/5 text-blue-400 font-mono">
          Path: {item.ScriptPath || item.externscript}
        </Badge>
      )}
      {(item.Script || item.ProcessedScript) && (
        <Badge variant="outline" className="text-[9px] h-5 border-blue-500/20 bg-blue-500/5 text-blue-400 font-mono">
          Cmd: {item.Script || item.ProcessedScript}
        </Badge>
      )}
      {(item.FlipStatus || item.flip_status) && (
        <Badge variant="outline" className={cn(
          "text-[9px] h-5 border-amber-500/20 bg-amber-500/5 font-mono",
          (item.FlipStatus === "Completed" || item.flip_status === "Completed") ? "text-emerald-400" : "text-amber-400"
        )}>
          Flip: {item.FlipStatus || item.flip_status}
        </Badge>
      )}
      {item.Message && (
        <div className="w-full text-[9px] text-muted-foreground/80 font-mono mt-1 px-1 border-l border-white/10 italic">
          {item.Message}
        </div>
      )}
    </div>
  )
}

function SequenceNode({ item, depth = 0, isWide = false }: { item: SequenceItem; depth?: number; isWide?: boolean }) {
  const hasChildren = item.Items && item.Items.length > 0
  const isRunning = item.Status?.toUpperCase() === "RUNNING"
  const isFinished = item.Status?.toUpperCase() === "FINISHED"
  const isDisabled = item.Status === "Disabled" || item.Status === "Skipped"

  const NodeContent = (
    <div
      className={cn(
        "flex items-start gap-1.5 py-1 px-2 rounded-md transition-all",
        isRunning && "bg-emerald-500/8 border-l-2 border-emerald-500",
        isFinished && "opacity-50",
        isDisabled && "opacity-30"
      )}
      style={{ paddingLeft: `${depth * (isWide ? 24 : 16) + 8}px` }}
    >
      {hasChildren ? (
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-center h-4 w-4 mt-0.5 hover:text-foreground text-muted-foreground transition-colors group">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
          </button>
        </CollapsibleTrigger>
      ) : (
        <div className="w-4" />
      )}

      <div className="mt-0.5">
        <StatusIcon status={item.Status} />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[11px] font-mono truncate",
            isRunning && "text-foreground font-bold active-pulse",
            isFinished && "text-muted-foreground",
            !isRunning && !isFinished && "text-foreground/90"
          )}>
            {item.Name}
          </span>
          {item.Progress && item.Progress.Total > 0 && (
            <span className="text-[9px] font-mono bg-white/5 px-1.5 rounded text-muted-foreground">
              {item.Progress.Current}/{item.Progress.Total}
            </span>
          )}
          {item.Temperature !== undefined && (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] h-5 flex items-center gap-1">
              <span className="opacity-70">Target:</span> {item.Temperature}°C
            </Badge>
          )}
          {item.SelectedDevice && (
            <Badge variant="outline" className="text-[9px] h-5 border-primary/20 bg-primary/5 text-primary font-mono px-1.5">
              {item.SelectedDevice}
            </Badge>
          )}
        </div>

        {/* Full Details only in Fullscreen View, but special items show some info even in compact */}
        {isWide ? (
          <SequenceParamGrid item={item} isWide={isWide} />
        ) : (
          <div className="flex flex-col gap-0.5 mt-0.5 ml-2">
            {(item.Script || item.ProcessedScript || item.ScriptPath || item.externscript) && (
              <div className="text-[9px] text-blue-400/60 font-mono truncate pl-1 border-l border-blue-500/20">
                {item.Script || item.ProcessedScript || item.ScriptPath || item.externscript}
              </div>
            )}
            {item.Coordinates && item.Coordinates.RAHours !== undefined && (
              <div className="text-[9px] text-amber-500/60 font-mono flex items-center gap-1 pl-1 border-l border-amber-500/20">
                <Globe className="h-2.5 w-2.5" />
                <span>{item.Coordinates.RAHours}h {item.Coordinates.RAMinutes}m</span>
                <span className="opacity-50">|</span>
                <span>{item.Coordinates.NegativeDec ? '-' : '+'}{item.Coordinates.DecDegrees}° {item.Coordinates.DecMinutes}'</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (hasChildren) {
    return (
      <Collapsible defaultOpen={true}>
        {NodeContent}
        <CollapsibleContent className="space-y-0.5">
          {item.Items?.map((child, i) => (
            <SequenceNode key={`${child.Name}-${i}`} item={child} depth={depth + 1} isWide={isWide} />
          ))}
          {item.Conditions?.map((cond, i) => {
            let extraInfo = ""
            // Format TargetTime
            if (cond.TargetTime) {
              try {
                const date = new Date(cond.TargetTime)
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                extraInfo += `Target Time: ${timeStr} `
              } catch (e) { }
            }
            // Format RemainingTime
            if (cond.RemainingTime) {
              // Assuming format "HH:mm:ss.ffff"
              const parts = cond.RemainingTime.split(':')
              if (parts.length >= 2) {
                extraInfo += `Remaining Time: ${parts[0]}:${parts[1]} `
              }
            }
            // Format Hours, Minutes, Seconds (Loop Until Time)
            if (cond.Hours !== undefined || cond.Minutes !== undefined || cond.Seconds !== undefined) {
              const h = String(cond.Hours ?? 0).padStart(2, '0')
              const m = String(cond.Minutes ?? 0).padStart(2, '0')
              const s = String(cond.Seconds ?? 0).padStart(2, '0')
              extraInfo += `Target: ${h}:${m}:${s} `
            }
            // Format Altitude Offset
            if (cond.Name.toLowerCase().includes("altitude")) {
              const offset = cond.Offset ?? cond.Data?.Offset;
              if (offset !== undefined) {
                extraInfo += `Offset: ${offset}° `
              }
            }
            // Format Coordinates (Slew To Ra/Dec, etc)
            if (cond.Coordinates) {
              const coords = cond.Coordinates;
              if (coords.RAHours !== undefined) {
                const ra = `${coords.RAHours}h ${coords.RAMinutes ?? 0}m`
                const dec = `${coords.NegativeDec ? '-' : '+'}${coords.DecDegrees ?? 0}° ${coords.DecMinutes ?? 0}'`
                extraInfo += `${ra} | ${dec} `
              } else if (coords.RAString || coords.DecString) {
                extraInfo += `${coords.RAString || ""} ${coords.DecString || ""} `
              }
            }

            return (
              <div
                key={`cond-${i}`}
                className="flex items-center gap-1.5 py-0.5 px-2 text-[10px] text-muted-foreground/60 font-mono"
                style={{ paddingLeft: `${(depth + 1) * (isWide ? 24 : 16) + 24}px` }}
              >
                <span className="text-amber-400/30 font-bold italic">IF</span>
                <span className="truncate">
                  {cond.Name.replace("_Condition", "")}
                  {extraInfo && <span className="text-muted-foreground/80 ml-2 text-[9px]">{extraInfo}</span>}
                </span>
              </div>
            )
          })}
          {item.Triggers?.map((trigger, i) => (
            <div
              key={`trig-${i}`}
              className="flex flex-col gap-0.5 py-1 px-2 text-[10px] text-muted-foreground/60 font-mono border-l border-primary/10 ml-1"
              style={{ marginLeft: `${(depth + 1) * (isWide ? 24 : 16) + 20}px` }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-primary/30 font-bold italic flex-shrink-0">ON</span>
                <span className="truncate">{trigger.Name.replace("_Trigger", "")}</span>
                {trigger.SelectedDevice && (
                  <span className="text-[9px] text-primary/60 font-mono border border-primary/20 bg-primary/5 px-1 rounded-sm">
                    {trigger.SelectedDevice}
                  </span>
                )}
                {trigger.RmsThreshold !== undefined && (
                  <span className="text-[9px] text-amber-500/60 font-mono border border-amber-500/20 bg-amber-500/5 px-1 rounded-sm">
                    Threshold: {trigger.RmsThreshold}
                  </span>
                )}
              </div>
              {(trigger.FlipStatus || (trigger as any).flip_status) && (
                <div className="text-[9px] text-amber-400/80 pl-6 italic break-words">
                  {(() => {
                    const status = trigger.FlipStatus || (trigger as any).flip_status;
                    if (isWide || !trigger.Name.toLowerCase().includes("meridian flip")) return status;
                    const match = status.match(/expected between [^;]+/i);
                    return match ? match[0] : status;
                  })()}
                </div>
              )}
              {isWide && (trigger.RmsInstance !== undefined || trigger.MinimumPoints !== undefined) && (
                <div className="flex gap-4 mt-0.5 pl-6 text-[8px] opacity-70 italic">
                  {trigger.RmsInstance !== undefined && (
                    <span>Instance: {String(trigger.RmsInstance ?? "None")}</span>
                  )}
                  {trigger.MinimumPoints !== undefined && (
                    <span>Min Points: {trigger.MinimumPoints}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return NodeContent
}

export function SequencePanel() {
  const { settings, isConnected, addApiLog, updateSessionData, sequence: data, isPollingLoading: isLoading, pollingError: error } = useNina()
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  // Helper to check if any item in the tree is running
  const checkIsRunning = (items: SequenceItem[]): boolean => {
    return items.some(item =>
      item.Status?.toUpperCase() === "RUNNING" || (item.Items && checkIsRunning(item.Items))
    )
  }

  // Find active exposure time for global state
  useEffect(() => {
    if (data) {
      const flatten = (nodes: SequenceItem[]): SequenceItem[] => {
        let flat: SequenceItem[] = []
        nodes.forEach(node => {
          flat.push(node)
          if (node.Items && node.Items.length > 0) flat = flat.concat(flatten(node.Items))
        })
        return flat
      }
      const allItems = flatten(data)
      const runningItem = allItems.find(item =>
        item.Status?.toUpperCase() === "RUNNING" &&
        (item as any).ExposureTime && Number((item as any).ExposureTime) > 0
      )
      if (runningItem) updateSessionData("exposureTime", Number((runningItem as any).ExposureTime))
    }
  }, [data, updateSessionData])

  const isRunning = data ? checkIsRunning(data) : false

  const handleStart = async () => {
    if (!isConnected) return
    try {
      await startSequence(settings.host, settings.port, undefined, addApiLog)
    } catch (err) {
      console.error("Failed to start sequence:", err)
    }
  }

  const handleStop = async () => {
    if (!isConnected) return
    try {
      await stopSequence(settings.host, settings.port, undefined, addApiLog)
    } catch (err) {
      console.error("Failed to stop sequence:", err)
    }
  }

  const handleReset = async () => {
    if (!isConnected) return
    try {
      await resetSequence(settings.host, settings.port, undefined, addApiLog)
    } catch (err) {
      console.error("Failed to reset sequence:", err)
    }
  }

  return (
    <Card className="flex flex-col h-full bg-card border-border overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0 border-b border-border flex-shrink-0 bg-muted/5">
        <div className="flex items-center gap-2">
          <ListTree className="h-3.5 w-3.5 text-primary" />
          <CardTitle className="text-[10px] font-mono font-bold text-foreground/70 uppercase tracking-widest">
            Sequence Engine
          </CardTitle>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Expand Sequence Details</span>
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent className="bg-popover text-popover-foreground">
                  <p className="text-xs">Expand Sequence Details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0 bg-black/95 backdrop-blur-2xl border-white/10 flex flex-col overflow-hidden">
              <DialogHeader className="p-6 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <ListTree className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-mono font-bold text-white uppercase tracking-tight">Sequence Inspector (Full)</DialogTitle>
                    <DialogDescription className="text-white/40 font-mono text-[10px] uppercase tracking-widest mt-1">Detailed view of all instructions and parameters</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-6">
                {data && data.length > 0 ? (
                  <div className="max-w-4xl mx-auto space-y-1">
                    {data.map((item: SequenceItem, i: number) => (
                      <SequenceNode key={`full-${i}`} item={item} isWide />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-20 opacity-20 italic">No sequence data available</div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <TooltipProvider>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-blue-400"
                        disabled={!isConnected || isRunning}
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        <span className="sr-only">Reset Sequence</span>
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover text-popover-foreground">
                    <p className="text-xs">Reset Sequence</p>
                  </TooltipContent>
                </Tooltip>
                
                <AlertDialogContent className="bg-card text-card-foreground border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-mono text-foreground tracking-tight">Reset Sequence</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      Are you sure you want to reset the sequence progress?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-mono text-xs">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset} className="font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90">Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-emerald-400"
                    disabled={!isConnected || isRunning}
                    onClick={handleStart}
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span className="sr-only">Start Sequence</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-popover text-popover-foreground">
                  <p className="text-xs">Start Sequence</p>
                </TooltipContent>
              </Tooltip>

              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-red-400"
                        disabled={!isConnected || !isRunning}
                      >
                        <Square className="h-3.5 w-3.5" />
                        <span className="sr-only">Stop Sequence</span>
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover text-popover-foreground">
                    <p className="text-xs">Stop Sequence</p>
                  </TooltipContent>
                </Tooltip>

                <AlertDialogContent className="bg-card text-card-foreground border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-mono text-foreground tracking-tight">Stop Sequence</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      Are you sure you want to stop the sequence?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-mono text-xs">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleStop} className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">Stop</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TooltipProvider>

          <StatusBadge
            label={isRunning ? "Active" : "Ready"}
            variant={isRunning ? "running" : "idle"}
            pulse={isRunning}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
            <XCircle className="h-8 w-8 text-destructive opacity-30" />
            <p className="text-[10px] text-destructive font-mono px-4">{error}</p>
          </div>
        ) : data && data.length > 0 ? (
          <ScrollArea className="h-full">
            <div className="py-2 px-1">
              {data.map((item: SequenceItem, i: number) => (
                <SequenceNode key={`compact-${i}`} item={item} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-4 text-center">
            <ListTree className="h-10 w-10 opacity-20" />
            <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">
              Awaiting sequence data...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
