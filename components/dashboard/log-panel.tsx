"use client"

import { useRef, useEffect, useState } from "react"
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Terminal,
  Pause,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { useNina } from "@/lib/nina-context"
import type { ApiLogEntry } from "@/lib/nina-types"
import { cn } from "@/lib/utils"

function formatTime(date: Date): string {
  const d = new Date(date)
  return d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 1,
  })
}

function StatusCode({ entry }: { entry: ApiLogEntry }) {
  if (entry.status === null) {
    return (
      <span className="font-mono text-[10px] text-red-500 font-bold tabular-nums w-[30px] text-right">
        ERR
      </span>
    )
  }
  const color =
    entry.status >= 200 && entry.status < 300
      ? "text-emerald-500"
      : entry.status >= 400 && entry.status < 500
        ? "text-amber-500"
        : "text-red-500"
  return (
    <span
      className={cn(
        "font-mono text-[10px] font-bold tabular-nums w-[30px] text-right",
        color
      )}
    >
      {entry.status}
    </span>
  )
}

function LogRow({ entry }: { entry: ApiLogEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col border-b border-border/10">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-[2px] font-mono text-[10px] hover:bg-white/5 transition-colors cursor-pointer",
          !entry.ok && "bg-red-500/5 text-red-200"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-muted-foreground/60 tabular-nums shrink-0 w-[75px]">
          {formatTime(entry.timestamp)}
        </span>
        <span className={cn(
          "font-bold shrink-0 w-[28px]",
          entry.method === "WS" ? "text-purple-400" : (entry.ok ? "text-primary/60" : "text-red-400")
        )}>
          {entry.method}
        </span>
        <StatusCode entry={entry} />
        <span
          className={cn(
            "truncate flex-1 ml-1",
            entry.ok ? "text-foreground/70" : "text-red-400/90"
          )}
        >
          {entry.path}
        </span>
        <span className="text-muted-foreground/50 tabular-nums shrink-0 w-[80px] truncate text-right">
          {entry.statusText}
        </span>
        <span className="text-muted-foreground/40 tabular-nums shrink-0 w-[42px] text-right text-[9px]">
          {entry.durationMs}ms
        </span>
      </div>

      {expanded && entry.errorMessage && (
        <div className="px-3 py-2 bg-black/60 border-t border-border/10">
          <pre className="text-[9px] font-mono text-primary/80 break-all whitespace-pre-wrap leading-relaxed">
            {entry.errorMessage}
          </pre>
        </div>
      )}
    </div>
  )
}

export function LogPanel() {
  const { apiLogs, clearApiLogs, isLoggingPaused, setIsLoggingPaused } = useNina()
  const [collapsed, setCollapsed] = useState(false)
  const [autoscroll, setAutoscroll] = useState(true)
  const [activeTab, setActiveTab] = useState<"api" | "ws">("api")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Filter logs based on active tab
  const filteredLogs = apiLogs.filter(log =>
    activeTab === "ws" ? log.method === "WS" : log.method !== "WS"
  )

  // Use a standard div for scrolling to ensure ref reliability
  useEffect(() => {
    if (autoscroll && scrollRef.current && !isLoggingPaused) {
      scrollRef.current.scrollTop = 0
    }
  }, [filteredLogs.length, autoscroll, isLoggingPaused])

  const successCount = filteredLogs.filter((l) => l.ok).length
  const errorCount = filteredLogs.filter((l) => !l.ok).length

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex flex-col border-t border-border bg-black/40 backdrop-blur-md h-full overflow-hidden",
          collapsed && "h-[36px]"
        )}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-border/50 shrink-0 bg-card/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-mono font-bold text-foreground/80 uppercase tracking-widest mr-2">
                Logs
              </span>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-white/5 p-0.5 rounded-md">
              <button
                onClick={() => setActiveTab("api")}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-mono rounded transition-colors",
                  activeTab === "api" ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
                )}
              >
                API
              </button>
              <button
                onClick={() => setActiveTab("ws")}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-mono rounded transition-colors",
                  activeTab === "ws" ? "bg-purple-500/20 text-purple-400 border border-purple-500/20" : "text-muted-foreground hover:text-foreground"
                )}
              >
                WS
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-white/5 rounded text-muted-foreground">
                {filteredLogs.length}
              </span>
              {successCount > 0 && (
                <span className="text-[9px] font-mono text-emerald-500/80">
                  {successCount} {activeTab === "ws" ? "EVENTI" : "OK"}
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-[9px] font-mono text-red-500/80 font-bold">
                  {errorCount} {activeTab === "ws" ? "ERR" : "FAIL"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 rounded-none",
                !isLoggingPaused ? "text-primary" : "text-amber-500"
              )}
              onClick={() => setIsLoggingPaused(!isLoggingPaused)}
              title={isLoggingPaused ? "Riprendi log" : "Sospendi log"}
            >
              {!isLoggingPaused ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-none text-muted-foreground hover:text-red-400"
              onClick={clearApiLogs}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Log entries area */}
        {!collapsed && (
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10"
          >
            <div className="flex flex-col min-h-full">
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center py-8 opacity-20">
                  <span className="text-[10px] font-mono uppercase tracking-tighter">
                    No {activeTab === "ws" ? "WebSocket events" : "API calls"} recorded...
                  </span>
                </div>
              ) : (
                filteredLogs.map((entry) => (
                  <LogRow key={entry.id} entry={entry} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
