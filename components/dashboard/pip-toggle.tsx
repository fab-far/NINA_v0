"use client"

import { useEffect, useState } from "react"
import { PictureInPicture, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useNina } from "@/lib/nina-context"
import { cn } from "@/lib/utils"

export function PiPToggle() {
    const { pipWindow, setPipWindow } = useNina()
    const [isSupported, setIsSupported] = useState(false)

    useEffect(() => {
        setIsSupported('documentPictureInPicture' in window)
    }, [])

    const togglePiP = async () => {
        if (!isSupported) return

        if (pipWindow) {
            pipWindow.close()
            return
        }

        try {
            // Find the dashboard container in the main window
            const dashboardContainer = (window as any).__nina_dashboard_container as HTMLDivElement
            if (!dashboardContainer) {
                console.error('Dashboard container not found')
                return
            }

            const pipOptions = {
                width: window.innerWidth,
                height: window.innerHeight,
            }

            // @ts-ignore
            const newPipWindow = await window.documentPictureInPicture.requestWindow(pipOptions)

            // Sync Theme and Classes early
            const syncTheme = () => {
                const isDark = document.documentElement.classList.contains('dark')
                newPipWindow.document.documentElement.classList.toggle('dark', isDark)
                newPipWindow.document.body.className = document.body.className

                // Copy computed background from main body
                const mainBodyStyle = getComputedStyle(document.body)
                newPipWindow.document.body.style.backgroundColor = mainBodyStyle.backgroundColor
                newPipWindow.document.body.style.color = mainBodyStyle.color
                newPipWindow.document.body.style.margin = '0'
                newPipWindow.document.body.style.overflow = 'hidden'
                newPipWindow.document.body.style.height = '100vh'
                newPipWindow.document.body.style.width = '100vw'
            }
            syncTheme()

            // Copy CSS Variables (Crucial for shadcn/tailwind)
            const copyCSSVariables = () => {
                const rootStyles = getComputedStyle(document.documentElement)
                const pipRoot = newPipWindow.document.documentElement.style

                // We specifically want the variables starting with --
                for (let i = 0; i < document.styleSheets.length; i++) {
                    try {
                        const sheet = document.styleSheets[i]
                        for (let j = 0; j < sheet.cssRules.length; j++) {
                            const rule = sheet.cssRules[j] as CSSStyleRule
                            if (rule.selectorText === ':root' || rule.selectorText === '.dark') {
                                // Extract and set variables
                                const style = rule.style
                                for (let k = 0; k < style.length; k++) {
                                    const prop = style[k]
                                    if (prop.startsWith('--')) {
                                        pipRoot.setProperty(prop, rootStyles.getPropertyValue(prop))
                                    }
                                }
                            }
                        }
                    } catch (e) { /* cross-origin sheets */ }
                }
            }
            copyCSSVariables()

            const observer = new MutationObserver(() => {
                syncTheme()
                copyCSSVariables()
            })
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

            // Proxy Events (Crucial for interactivity)
            const eventTypes = [
                'mousedown', 'mousemove', 'mouseup',
                'pointerdown', 'pointermove', 'pointerup',
                'touchstart', 'touchmove', 'touchend',
                'wheel', 'keydown', 'keyup'
            ]

            eventTypes.forEach(type => {
                newPipWindow.document.addEventListener(type, (event: any) => {
                    try {
                        const clonedEvent = new event.constructor(event.type, event)

                        // Copy essential properties that might not be initialized by the constructor
                        const propsToCopy = ['target', 'currentTarget', 'clientX', 'clientY', 'screenX', 'screenY', 'button', 'buttons', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'key', 'code', 'keyCode', 'deltaX', 'deltaY', 'deltaZ', 'deltaMode']

                        propsToCopy.forEach(prop => {
                            if (event[prop] !== undefined) {
                                try {
                                    Object.defineProperty(clonedEvent, prop, {
                                        value: event[prop],
                                        enumerable: true,
                                        configurable: true
                                    })
                                } catch (e) {
                                    // Some properties might be read-only or fail to define
                                }
                            }
                        })

                        // Dispatch to both window and document to ensure all listeners (like React's) see it
                        window.dispatchEvent(clonedEvent)
                        document.dispatchEvent(clonedEvent)
                    } catch (err) {
                        // Silent fail for uncloneable events to prevent dashboard crash
                    }
                }, { capture: true, passive: false })
            })

            // Copy style sheets
            const allCSS = [...document.styleSheets]
                .map((styleSheet) => {
                    try {
                        return [...styleSheet.cssRules].map((rule) => rule.cssText).join('')
                    } catch (e) {
                        return null
                    }
                })

            allCSS.forEach((css, i) => {
                if (css) {
                    const style = newPipWindow.document.createElement('style')
                    style.textContent = css
                    newPipWindow.document.head.appendChild(style)
                } else {
                    const originalLink = document.styleSheets[i].ownerNode as HTMLLinkElement
                    if (originalLink && originalLink.href) {
                        const link = newPipWindow.document.createElement('link')
                        link.rel = 'stylesheet'
                        link.href = originalLink.href
                        newPipWindow.document.head.appendChild(link)
                    }
                }
            })

            // Wait a tick for styles to parse before moving the node
            requestAnimationFrame(() => {
                dashboardContainer.classList.remove('hidden')
                dashboardContainer.classList.add('flex')
                newPipWindow.document.body.appendChild(dashboardContainer)
            })

            // Handle closing
            newPipWindow.addEventListener('pagehide', () => {
                observer.disconnect()

                // Return dashboard to main window
                const shell = document.getElementById('dashboard-root-shell')
                if (shell && dashboardContainer) {
                    shell.appendChild(dashboardContainer)
                }

                setPipWindow(null)
            })

            setPipWindow(newPipWindow)

        } catch (err) {
            console.error('Failed to open PiP window:', err)
            setPipWindow(null)
        }
    }

    if (!isSupported) return null

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-8 w-8 transition-colors",
                        pipWindow ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={togglePiP}
                >
                    {pipWindow ? <ExternalLink className="h-4 w-4" /> : <PictureInPicture className="h-4 w-4" />}
                    <span className="sr-only">Toggle PiP</span>
                </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground">
                <p className="text-xs">Toggle PiP</p>
            </TooltipContent>
        </Tooltip>
    )
}
