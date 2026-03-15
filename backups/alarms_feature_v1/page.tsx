"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { SequencePanel } from "@/components/dashboard/sequence-panel"
import { CameraPanel } from "@/components/dashboard/camera-panel"
import { ImagePanel } from "@/components/dashboard/image-panel"
import { GuiderPanel } from "@/components/dashboard/guider-panel"
import { AltitudeChart } from "@/components/dashboard/altitude-chart"
import { MountPanel } from "@/components/dashboard/mount-panel"
import { DashboardHeader } from "@/components/dashboard/header"
import { LogPanel } from "@/components/dashboard/log-panel"
import BatteryPanel from "@/components/dashboard/battery-panel"
import { Button } from "@/components/ui/button"
import { useNina } from "@/lib/nina-context"
import { getCameraInfo } from "@/lib/nina-api"
import { cn } from "@/lib/utils"
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels"
import { Menu, X, LayoutDashboard } from "lucide-react"
import { createPortal } from "react-dom"

function ResizeHandle({ direction = "horizontal" }: { direction?: "horizontal" | "vertical" }) {
  return (
    <PanelResizeHandle
      className={cn(
        "flex items-center justify-center bg-transparent hover:bg-primary/20 transition-colors group relative",
        direction === "horizontal" ? "w-2 cursor-col-resize px-0.5" : "h-2 cursor-row-resize py-0.5"
      )}
    >
      <div className={cn(
        "bg-border group-hover:bg-primary/50 transition-colors rounded-full",
        direction === "horizontal" ? "w-[1px] h-10" : "h-[1px] w-10"
      )} />
    </PanelResizeHandle>
  )
}

function ConnectionProbe() {
  const { settings, setIsConnected, setConnectionError } = useNina()

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const info = await getCameraInfo(settings.host, settings.port)
        if (info) {
          setIsConnected(true)
          setConnectionError(null)
        }
      } catch (err) {
        setIsConnected(false)
        setConnectionError(err instanceof Error ? err.message : "Connection failed")
      }
    }
    checkConnection()
    const interval = setInterval(checkConnection, 10000)
    return () => clearInterval(interval)
  }, [settings.host, settings.port, setIsConnected, setConnectionError])

  return null
}

export default function DashboardPage() {
  const { pipWindow } = useNina()
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)

    const checkMobile = () => {
      // Use the window containing the dashboard container
      const targetWindow = containerRef.current?.ownerDocument?.defaultView || window
      setIsMobile(targetWindow.innerWidth < 1024)
    }

    checkMobile()

    // Listen to main window resize
    window.addEventListener("resize", checkMobile)

    // Listen to PiP window resize if active
    if (pipWindow) {
      pipWindow.addEventListener("resize", checkMobile)
    }

    return () => {
      window.removeEventListener("resize", checkMobile)
      if (pipWindow) {
        pipWindow.removeEventListener("resize", checkMobile)
      }
    }
  }, [pipWindow]) // Re-bind if pipWindow changes

  // Expose the container ref globally for the PiP toggle to find it
  useEffect(() => {
    if (typeof window !== 'undefined' && containerRef.current) {
      (window as any).__nina_dashboard_container = containerRef.current
    }
  }, [mounted])

  if (!mounted) return null

  // UNIFIED RENDERING FOR STABILITY
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* 1. STABLE PLACEHOLDER LAYER */}
      <div id="pip-placeholder-mount" className="z-50 absolute inset-0 pointer-events-none">
        {pipWindow && (
          <div className="flex items-center justify-center h-full w-full bg-background border-4 border-dashed border-primary/20 pointer-events-auto">
            <div className="text-center space-y-4">
              <LayoutDashboard className="h-12 w-12 text-primary mx-auto animate-pulse" />
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Dashboard is in PiP Mode</p>
              <Button variant="outline" onClick={() => { pipWindow ? pipWindow.close() : null }}>Return to Main Window</Button>
            </div>
          </div>
        )}
      </div>

      {/* 2. STABLE DASHBOARD CONTAINER (This node never unmounts) */}
      <div
        id="dashboard-root-shell"
        className={cn(
          "h-full w-full",
          pipWindow ? "hidden" : "block"
        )}
      >
        <div
          ref={containerRef}
          id="nina-dashboard-container"
          className="h-full w-full bg-background text-foreground overflow-hidden flex flex-col"
        >
          <ConnectionProbe />
          <DashboardHeader />

          {isMobile ? (
            /* MOBILE VIEW */
            <main id="mobile-view" className="flex-1 overflow-y-auto bg-[#020202] p-2 space-y-3 pb-20">
              <section className="min-h-[300px]"><ImagePanel /></section>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="h-[280px]"><CameraPanel /></div>
                <div className="h-[280px]"><MountPanel /></div>
              </div>
              <div className="space-y-3">
                <section className="h-[300px]"><GuiderPanel /></section>
                <section className="h-[300px]"><AltitudeChart /></section>
              </div>
              <section className="h-[400px]"><SequencePanel /></section>
              <BatteryPanelWrapper />
              <LogPanelWrapper />
              {/* Mobile Indicator */}
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-md border border-border px-4 py-2 rounded-full flex items-center gap-4 z-50 shadow-2xl">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Mobile Mode</span>
              </div>
            </main>
          ) : (
            /* DESKTOP VIEW */
            <main id="desktop-view" className="flex-1 overflow-hidden bg-[#020202] p-1 flex flex-col">
              <PanelGroup direction="vertical" autoSaveId="nina-v6-root">
                <Panel defaultSize={88} minSize={50} className="flex flex-col">
                  <PanelGroup direction="horizontal" autoSaveId="nina-v6-main-row">
                    <Panel defaultSize={18} minSize={15}>
                      <SidebarContent />
                    </Panel>
                    <ResizeHandle direction="horizontal" />
                    <Panel defaultSize={57} minSize={30}>
                      <PanelGroup direction="vertical" autoSaveId="nina-v6-central-stack">
                        <Panel defaultSize={65} minSize={30} className="p-0.5"><ImagePanel /></Panel>
                        <ResizeHandle direction="vertical" />
                        <Panel defaultSize={35} minSize={10} className="p-0.5"><GuiderPanel /></Panel>
                      </PanelGroup>
                    </Panel>
                    <ResizeHandle direction="horizontal" />
                    <Panel defaultSize={25} minSize={20}>
                      <PanelGroup direction="vertical" autoSaveId="nina-v6-info-sidebar">
                        <Panel defaultSize={33} minSize={15} className="p-0.5"><CameraPanel /></Panel>
                        <ResizeHandle direction="vertical" />
                        <Panel defaultSize={33} minSize={15} className="p-0.5"><MountPanel /></Panel>
                        <ResizeHandle direction="vertical" />
                        <Panel defaultSize={34} minSize={15} className="p-0.5"><AltitudeChart /></Panel>
                      </PanelGroup>
                    </Panel>
                  </PanelGroup>
                </Panel>
                <LogPanelArea />
              </PanelGroup>
            </main>
          )}
        </div>
      </div>
    </div>
  )
}

function SidebarContent() {
  const { settings } = useNina()
  return settings.showBatteryPanel ? (
    <PanelGroup direction="vertical" autoSaveId="nina-v6-sequence-battery">
      <Panel defaultSize={75} minSize={30} className="p-0.5"><SequencePanel /></Panel>
      <ResizeHandle direction="vertical" />
      <Panel defaultSize={25} minSize={15} className="p-0.5"><BatteryPanel /></Panel>
    </PanelGroup>
  ) : (
    <div className="h-full p-0.5"><SequencePanel /></div>
  )
}

function LogPanelArea() {
  const { settings } = useNina()
  if (!settings.showApiLog) return null
  return (
    <>
      <ResizeHandle direction="vertical" />
      <Panel defaultSize={12} minSize={4} className="p-0.5"><LogPanel /></Panel>
    </>
  )
}

function BatteryPanelWrapper() {
  const { settings } = useNina()
  return settings.showBatteryPanel ? <section className="h-[300px]"><BatteryPanel /></section> : null
}

function LogPanelWrapper() {
  const { settings } = useNina()
  return settings.showApiLog ? <section className="h-[200px]"><LogPanel /></section> : null
}
