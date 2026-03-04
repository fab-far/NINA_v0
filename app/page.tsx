"use client"

import { useState, useEffect, useCallback } from "react"
import { SequencePanel } from "@/components/dashboard/sequence-panel"
import { CameraPanel } from "@/components/dashboard/camera-panel"
import { ImagePanel } from "@/components/dashboard/image-panel"
import { GuiderPanel } from "@/components/dashboard/guider-panel"
import { AltitudeChart } from "@/components/dashboard/altitude-chart"
import { MountPanel } from "@/components/dashboard/mount-panel"
import { DashboardHeader } from "@/components/dashboard/header"
import { LogPanel } from "@/components/dashboard/log-panel"
import BatteryPanel from "@/components/dashboard/battery-panel"
import { useNina } from "@/lib/nina-context"
import { getCameraInfo } from "@/lib/nina-api"
import { cn } from "@/lib/utils"
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels"
import { Menu, X, LayoutDashboard } from "lucide-react"

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
  const { settings } = useNina()
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // Switching to mobile/vertical layout below 1024px
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  if (!mounted) return null

  // MOBILE LAYOUT (Simplified Vertical Stack)
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
        <ConnectionProbe />
        <DashboardHeader />

        <main className="flex-1 overflow-y-auto bg-[#020202] p-2 space-y-3 pb-20">
          <section className="min-h-[300px]">
            <ImagePanel />
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-[280px]">
              <CameraPanel />
            </div>
            <div className="h-[280px]">
              <MountPanel />
            </div>
          </div>

          <div className="space-y-3">
            <section className="h-[300px]">
              <GuiderPanel />
            </section>
            <section className="h-[300px]">
              <AltitudeChart />
            </section>
          </div>

          <section className="h-[400px]">
            <SequencePanel />
          </section>

          {settings.showBatteryPanel && (
            <section className="h-[300px]">
              <BatteryPanel />
            </section>
          )}

          {settings.showApiLog && (
            <section className="h-[200px]">
              <LogPanel />
            </section>
          )}
        </main>

        {/* Floating Mobile Nav or just a reminder this is mobile view */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-md border border-border px-4 py-2 rounded-full flex items-center gap-4 z-50 shadow-2xl">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Mobile View Active</span>
        </div>
      </div>
    )
  }

  // DESKTOP LAYOUT (The T-Shape we refined)
  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden text-foreground">
      <ConnectionProbe />
      <DashboardHeader />

      <main className="flex-1 overflow-hidden bg-[#020202] p-1 flex flex-col">
        {/* ROOT Group: Dashboard Area vs Log Panel (Vertical) */}
        <PanelGroup direction="vertical" autoSaveId="nina-v6-root">
          <Panel defaultSize={88} minSize={50} className="flex flex-col">

            {/* MAIN CONTENT: Sidebar vs Work Area (Horizontal) */}
            <PanelGroup direction="horizontal" autoSaveId="nina-v6-main-row">

              {/* 1. SEQUENCE SIDEBAR + BATTERY */}
              <Panel defaultSize={18} minSize={15}>
                {settings.showBatteryPanel ? (
                  <PanelGroup direction="vertical" autoSaveId="nina-v6-sequence-battery">
                    <Panel defaultSize={75} minSize={30} className="p-0.5">
                      <SequencePanel />
                    </Panel>
                    <ResizeHandle direction="vertical" />
                    <Panel defaultSize={25} minSize={15} className="p-0.5">
                      <BatteryPanel />
                    </Panel>
                  </PanelGroup>
                ) : (
                  <div className="h-full p-0.5">
                    <SequencePanel />
                  </div>
                )}
              </Panel>

              <ResizeHandle direction="horizontal" />

              {/* 2. CENTRAL COLUMN (Image & Guider) */}
              <Panel defaultSize={57} minSize={30}>
                <PanelGroup direction="vertical" autoSaveId="nina-v6-central-stack">
                  <Panel defaultSize={65} minSize={30} className="p-0.5">
                    <ImagePanel />
                  </Panel>
                  <ResizeHandle direction="vertical" />
                  <Panel defaultSize={35} minSize={10} className="p-0.5">
                    <GuiderPanel />
                  </Panel>
                </PanelGroup>
              </Panel>

              <ResizeHandle direction="horizontal" />

              {/* 3. INFO SIDEBAR (Camera, Mount, Altitude) */}
              <Panel defaultSize={25} minSize={20}>
                <PanelGroup direction="vertical" autoSaveId="nina-v6-info-sidebar">
                  <Panel defaultSize={33} minSize={15} className="p-0.5">
                    <CameraPanel />
                  </Panel>
                  <ResizeHandle direction="vertical" />
                  <Panel defaultSize={33} minSize={15} className="p-0.5">
                    <MountPanel />
                  </Panel>
                  <ResizeHandle direction="vertical" />
                  <Panel defaultSize={34} minSize={15} className="p-0.5">
                    <AltitudeChart />
                  </Panel>
                </PanelGroup>
              </Panel>

            </PanelGroup>
          </Panel>

          {settings.showApiLog && (
            <>
              <ResizeHandle direction="vertical" />
              <Panel defaultSize={12} minSize={4} className="p-0.5">
                <LogPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </main>
    </div>
  )
}
