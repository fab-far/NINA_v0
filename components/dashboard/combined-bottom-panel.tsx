"use client"

import React from "react"
import { GuiderPanel } from "./guider-panel"
import { AltitudeChart } from "./altitude-chart"
import {
    Panel,
    PanelGroup,
    PanelResizeHandle,
} from "react-resizable-panels"
import { cn } from "@/lib/utils"

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

export function CombinedBottomPanel() {
    return (
        <div className="h-full w-full overflow-hidden flex flex-col lg:block">
            {/* Group shared horizontal space: 60/40 split on desktop, stack on mobile */}
            <div className="lg:hidden flex flex-col gap-3 h-full overflow-y-auto">
                <div className="min-h-[300px]">
                    <GuiderPanel />
                </div>
                <div className="min-h-[300px]">
                    <AltitudeChart />
                </div>
            </div>

            <div className="hidden lg:block h-full">
                <PanelGroup direction="horizontal" autoSaveId="nina-v6-bottom-panels">
                    {/* GUIDER GRAPH (60%) */}
                    <Panel defaultSize={60} minSize={30} className="p-0.5">
                        <GuiderPanel />
                    </Panel>

                    <ResizeHandle direction="horizontal" />

                    {/* ALTITUDE CHART (40%) */}
                    <Panel defaultSize={40} minSize={20} className="p-0.5">
                        <AltitudeChart />
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    )
}
