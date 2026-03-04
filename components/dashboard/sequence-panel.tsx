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
  Settings2
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNina } from "@/lib/nina-context"
import { useNinaPolling } from "@/lib/use-nina-polling"
import { getSequenceState } from "@/lib/nina-api"
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

function SequenceParamGrid({ item }: { item: SequenceItem }) {
  const ignoreKeys = ['Items', 'Conditions', 'Triggers', 'GlobalTriggers', 'Name', 'Status', 'Category', 'Description', 'Progress', 'Attempts', 'ImageType']
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
      {item.Coordinates && (item.Coordinates.RAString || item.Coordinates.DecString) && (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] h-5 flex items-center gap-1">
          <Globe className="h-3 w-3" />
          <span>{item.Coordinates.RAString}</span>
          {item.Coordinates.RAString && item.Coordinates.DecString && <span className="opacity-50 mx-0.5">|</span>}
          <span>{item.Coordinates.DecString}</span>
        </Badge>
      )}
      {/* Generic Params */}
      {parameters.slice(0, 3).map(([key, value]) => (
        <Badge key={key} variant="outline" className="text-[9px] h-5 border-white/5 bg-white/5 text-muted-foreground">
          {key}: {String(value)}
        </Badge>
      ))}
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
        </div>

        {/* Full Details only in Fullscreen View */}
        {isWide && <SequenceParamGrid item={item} />}
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
              className="flex items-center gap-1.5 py-0.5 px-2 text-[10px] text-muted-foreground/60 font-mono"
              style={{ paddingLeft: `${(depth + 1) * (isWide ? 24 : 16) + 24}px` }}
            >
              <span className="text-primary/30 font-bold italic">ON</span>
              <span className="truncate">{trigger.Name}</span>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return NodeContent
}

export function SequencePanel() {
  const { settings, isConnected, addApiLog, updateSessionData } = useNina()
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

  const fetcher = useCallback(
    (signal: AbortSignal, onLog?: import("@/lib/nina-api").ApiLogCallback) =>
      getSequenceState(settings.host, settings.port, signal, onLog),
    [settings.host, settings.port]
  )

  const { data, error, isLoading } = useNinaPolling({
    fetcher,
    interval: settings.pollingInterval,
    enabled: true,
    onLog: addApiLog,
  })

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
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
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
                    {data.map((item, i) => (
                      <SequenceNode key={`full-${i}`} item={item} isWide />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-20 opacity-20 italic">No sequence data available</div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>

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
              {data.map((item, i) => (
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
