"use client"

import React from "react"
import { cn } from "@/lib/utils"

import { FAMOUS_STARS, calculateAltAz, calculateTrajectory } from "@/lib/astronomy"

interface SkyMapProps {
    altitude: number
    azimuth: number
    siteLatitude?: number
    siderealTime?: number
    targetRa?: number
    targetDec?: number
    className?: string
    svgClassName?: string
}

export function SkyMap({ altitude, azimuth, siteLatitude, siderealTime, targetRa, targetDec, className, svgClassName }: SkyMapProps) {
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
    // North (0) -> Top (y min)
    // South (180) -> Bottom (y max)
    // East (90) -> Left (x min)
    // West (270) -> Right (x max)
    const x = center - r * Math.sin(azRad)
    const y = center - r * Math.cos(azRad)

    return (
        <div className={cn("relative flex items-center justify-center bg-muted/10 rounded-lg border border-border/30", className)}>
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className={cn("w-full h-full max-w-[120px]", svgClassName)}
            >
                {/* Outer boundary (Horizon) */}
                <circle
                    cx={center}
                    cy={center}
                    r={maxRadius}
                    className="fill-none stroke-muted-foreground/40 stroke-[0.5]"
                />

                {/* Reference circles (Alt 30, 60) */}
                <circle
                    cx={center}
                    cy={center}
                    r={maxRadius * (2 / 3)}
                    className="fill-none stroke-muted-foreground/20 stroke-[0.3]"
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
                <line x1={center - 3} y1={center} x2={center + 3} y2={center} className="stroke-muted-foreground/40 stroke-[0.3]" />
                <line x1={center} y1={center - 3} x2={center} y2={center + 3} className="stroke-muted-foreground/40 stroke-[0.3]" />

                {/* Cardinal Labels */}
                <text x={center} y={center - maxRadius - 3} className="fill-muted-foreground/40 text-[5px] font-mono text-center" textAnchor="middle">N</text>
                <text x={center} y={center + maxRadius + 7} className="fill-muted-foreground/40 text-[5px] font-mono text-center" textAnchor="middle">S</text>
                <text x={center - maxRadius - 6} y={center + 2} className="fill-muted-foreground/40 text-[5px] font-mono text-center" textAnchor="middle">E</text>
                <text x={center + maxRadius + 2} y={center + 2} className="fill-muted-foreground/40 text-[5px] font-mono text-center" textAnchor="middle">W</text>

                {/* Target Trajectory (Dashed path) */}
                {siteLatitude !== undefined && siderealTime !== undefined && targetRa !== undefined && targetDec !== undefined && (
                    <g>
                        {(() => {
                            const trajPoints = calculateTrajectory(targetRa, targetDec, siteLatitude, siderealTime)
                            if (trajPoints.length < 2) return null

                            let pathD = ""
                            trajPoints.forEach((p, i) => {
                                const tr = maxRadius * (1 - p.alt / 90)
                                const tazRad = (p.az * Math.PI) / 180
                                const tx = center - tr * Math.sin(tazRad)
                                const ty = center - tr * Math.cos(tazRad)

                                if (i === 0) pathD = `M ${tx} ${ty}`
                                else pathD += ` L ${tx} ${ty}`
                            })

                            return (
                                <path
                                    d={pathD}
                                    className="fill-none stroke-primary/30 stroke-[0.5]"
                                    strokeDasharray="2 2"
                                />
                            )
                        })()}
                    </g>
                )}

                {/* Famous Stars (Small gray dots) */}
                {siteLatitude !== undefined && siderealTime !== undefined && (
                    <g opacity={0.5}>
                        {FAMOUS_STARS.map(star => {
                            const { alt: sAlt, az: sAz } = calculateAltAz(star.ra, star.dec, siteLatitude, siderealTime)
                            if (sAlt < 0) return null // Sotto l'orizzonte

                            const sr = maxRadius * (1 - sAlt / 90)
                            const sazRad = (sAz * Math.PI) / 180
                            const sx = center - sr * Math.sin(sazRad)
                            const sy = center - sr * Math.cos(sazRad)

                            return (
                                <g key={star.name}>
                                    <circle cx={sx} cy={sy} r="0.6" className="fill-white/80" />
                                    <text x={sx + 1.5} y={sy + 1} className="fill-white/30 text-[3px] font-mono pointer-events-none uppercase">{star.name}</text>
                                </g>
                            )
                        })}
                    </g>
                )}

                {/* Polaris (White dot at North, Alt = Lat) */}
                {siteLatitude !== undefined && (
                    <g>
                        {(() => {
                            const pAlt = Math.max(0, Math.min(90, siteLatitude))
                            const pr = maxRadius * (1 - pAlt / 90)
                            // North is at top (Az=0 -> y min)
                            const px = center
                            const py = center - pr
                            return (
                                <>
                                    <circle
                                        cx={px}
                                        cy={py}
                                        r="1.2"
                                        className="fill-white"
                                    />
                                    <circle
                                        cx={px}
                                        cy={py}
                                        r="2.5"
                                        className="fill-white/20"
                                    />
                                    <text
                                        x={px + 2}
                                        y={py + 1}
                                        className="fill-white/40 text-[4px] font-mono pointer-events-none"
                                    >
                                        POLARIS
                                    </text>
                                </>
                            )
                        })()}
                    </g>
                )}

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
