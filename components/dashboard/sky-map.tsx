"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface SkyMapProps {
    altitude: number
    azimuth: number
    className?: string
}

export function SkyMap({ altitude, azimuth, className }: SkyMapProps) {
    // Normalize values
    const alt = Math.max(0, Math.min(90, altitude))
    const az = azimuth % 360

    // SVG parameters
    const size = 100
    const center = size / 2
    const maxRadius = 40

    // Coordinate transformation
    // r is distance from center (Zenith = 0, Horizon = maxRadius)
    const r = maxRadius * (1 - alt / 90)
    const azRad = (az * Math.PI) / 180

    // Math: 
    // South (180) -> Top (y min)
    // North (0) -> Bottom (y max)
    // East (90) -> Left (x min)
    // West (270) -> Right (x max)
    const x = center - r * Math.sin(azRad)
    const y = center + r * Math.cos(azRad)

    return (
        <div className={cn("relative flex items-center justify-center bg-muted/10 rounded-lg border border-border/30", className)}>
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className="w-full h-full max-w-[120px]"
            >
                {/* Outer boundary (Horizon) */}
                <circle
                    cx={center}
                    cy={center}
                    r={maxRadius}
                    className="fill-none stroke-muted-foreground/20 stroke-[0.5]"
                />

                {/* Reference circles (Alt 30, 60) */}
                <circle
                    cx={center}
                    cy={center}
                    r={maxRadius * (2 / 3)}
                    className="fill-none stroke-muted-foreground/10 stroke-[0.3]"
                    strokeDasharray="1 1"
                />
                <circle
                    cx={center}
                    cy={center}
                    r={maxRadius * (1 / 3)}
                    className="fill-none stroke-muted-foreground/10 stroke-[0.3]"
                    strokeDasharray="1 1"
                />

                {/* Crosshair (Zenith) */}
                <line x1={center - 3} y1={center} x2={center + 3} y2={center} className="stroke-muted-foreground/20 stroke-[0.3]" />
                <line x1={center} y1={center - 3} x2={center} y2={center + 3} className="stroke-muted-foreground/20 stroke-[0.3]" />

                {/* Cardinal Labels */}
                <text x={center} y={center - maxRadius - 3} className="fill-muted-foreground/40 text-[5px] font-mono text-center" textAnchor="middle">S</text>
                <text x={center} y={center + maxRadius + 7} className="fill-muted-foreground/40 text-[5px] font-mono text-center" textAnchor="middle">N</text>
                <text x={center - maxRadius - 6} y={center + 2} className="fill-muted-foreground/40 text-[5px] font-mono text-center" textAnchor="middle">E</text>
                <text x={center + maxRadius + 2} y={center + 2} className="fill-muted-foreground/40 text-[5px] font-mono text-center" textAnchor="middle">W</text>

                {/* Telescope Pointer (Amber) */}
                <circle
                    cx={x}
                    cy={y}
                    r="2.5"
                    className="fill-amber-500 shadow-xl"
                />
                {/* Subtle glow */}
                <circle
                    cx={x}
                    cy={y}
                    r="4"
                    className="fill-amber-500/20"
                />
            </svg>

            {/* Altitude percentage indicator (optional, just for scale) */}
            <div className="absolute bottom-1 right-1 flex flex-col items-end pointer-events-none opacity-30">
                <span className="text-[6px] font-mono uppercase tracking-tighter">Zenith</span>
            </div>
            <div className="absolute top-1 left-2 pointer-events-none opacity-30">
                <span className="text-[6px] font-mono uppercase tracking-tighter">Sky Map</span>
            </div>
        </div>
    )
}
