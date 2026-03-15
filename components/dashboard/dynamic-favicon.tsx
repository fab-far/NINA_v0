"use client"

import { useEffect } from "react"
import { useNina } from "@/lib/nina-context"

/**
 * DynamicFavicon
 * Updates the browser favicon based on:
 * - Guider status: Red if "Lost Lock"
 * - Camera status: Pulsing if "IsExposing"
 */
export function DynamicFavicon() {
    const { camera, guider } = useNina()

    useEffect(() => {
        if (typeof window === "undefined") return

        const isLost = guider?.State?.toLowerCase().includes("lost") || guider?.State?.toLowerCase().includes("error")
        const isExposing = camera?.IsExposing || camera?.CameraState === "Exposing"

        const color = isLost ? "#E74C3C" : "#F39C12"
        const pulseAnim = isExposing
            ? `<style>
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.9); }
                }
                .pulse-layer { 
                    animation: pulse 2s infinite ease-in-out; 
                    transform-origin: 16px 16px; 
                }
               </style>`
            : ""

        const svg = `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${pulseAnim}
  <rect width="32" height="32" rx="6" fill="#1A1A1B"/>
  <g class="${isExposing ? "pulse-layer" : ""}">
    <circle cx="16" cy="16" r="8" stroke="${color}" stroke-width="1.5"/>
    <path d="M16 4V10M16 22V28M4 16H10M22 16H28" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M16 13L17 16L16 19L15 16L16 13Z" fill="${color}"/>
    <circle cx="16" cy="16" r="0.5" fill="white"/>
  </g>
</svg>`.trim()

        const encodedSvg = window.btoa(svg)
        const faviconUrl = `data:image/svg+xml;base64,${encodedSvg}`

        // Update or create favicon link
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
        if (!link) {
            link = document.createElement("link")
            link.rel = "icon"
            document.head.appendChild(link)
        }
        link.href = faviconUrl
    }, [camera, guider])

    return null
}
