"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Settings, Moon, Sun, Telescope, Wifi, WifiOff, HardDriveDownload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useNina } from "@/lib/nina-context"
import { ConnectionDialog } from "./connection-dialog"
import { StatusBadge } from "./status-badge"
import { TransferDialog } from "./transfer-dialog"
import { PiPToggle } from "./pip-toggle"

export function DashboardHeader() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { settings, isConnected, connectionError } = useNina()

  return (
    <TooltipProvider>
      <header className="flex items-center justify-between border-b border-border px-2 sm:px-4 py-2 bg-card">
        <div className="flex items-center gap-1.5 sm:gap-3 shrink min-w-0">
          <Telescope className="h-4 w-4 sm:h-5 sm:h-5 text-primary shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-foreground font-mono leading-tight truncate">
              N.I.N.A. Dashboard
            </h1>
            <span className="text-[10px] text-muted-foreground font-mono hidden md:inline truncate">
              {settings.host}:{settings.port}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {isConnected ? (
            <StatusBadge label="Connected" variant="running" pulse />
          ) : connectionError ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <WifiOff className="h-3.5 w-3.5 text-red-400" />
                  <StatusBadge label="Disconnected" variant="error" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-popover text-popover-foreground">
                <p className="text-xs font-mono">{connectionError}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
              <StatusBadge label="Connecting..." variant="warning" />
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground">
              <p className="text-xs">Toggle theme</p>
            </TooltipContent>
          </Tooltip>

          <PiPToggle />

          {settings.enableTransfer && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setTransferOpen(true)}
                >
                  <HardDriveDownload className="h-4 w-4" />
                  <span className="sr-only">Remote File Browser</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground">
                <p className="text-xs">File Browser</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Connection settings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground">
              <p className="text-xs">Settings</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <ConnectionDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        {settings.enableTransfer && <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />}
      </header >
    </TooltipProvider >
  )
}
