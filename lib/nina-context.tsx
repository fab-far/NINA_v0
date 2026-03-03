"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import {
  DEFAULT_SETTINGS,
  type NinaConnectionSettings,
  type ApiLogEntry,
  type NinaStatusMessage,
  type NinaSocketResponse,
} from "./nina-types"
import { getCameraInfo, getSequenceState } from "./nina-api"

const MAX_LOG_ENTRIES = 500

interface NinaContextValue {
  settings: NinaConnectionSettings
  updateSettings: (settings: Partial<NinaConnectionSettings>) => void
  isConnected: boolean
  setIsConnected: (connected: boolean) => void
  connectionError: string | null
  setConnectionError: (error: string | null) => void
  apiLogs: ApiLogEntry[]
  addApiLog: (entry: ApiLogEntry) => void
  clearApiLogs: () => void
  sessionData: Record<string, any>
  updateSessionData: (key: string, value: any) => void
  isLoggingPaused: boolean
  setIsLoggingPaused: (paused: boolean) => void
  lastStatus: NinaStatusMessage | null
  isWebSocketConnected: boolean
}

const NinaContext = createContext<NinaContextValue | null>(null)

const STORAGE_KEY = "nina-dashboard-settings"

function loadSettings(): NinaConnectionSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS

  // Use current hostname as default if not set (useful for miniPCs in LAN)
  const defaultWithHost = {
    ...DEFAULT_SETTINGS,
    host: window.location.hostname || DEFAULT_SETTINGS.host
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return { ...defaultWithHost, ...JSON.parse(saved) }
    }
  } catch {
    // ignore parse errors
  }
  return defaultWithHost
}

function saveSettings(settings: NinaConnectionSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore storage errors
  }
}

export function NinaProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<NinaConnectionSettings>(DEFAULT_SETTINGS)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([])
  const [isLoggingPaused, setIsLoggingPaused] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const updateSettings = useCallback(
    (partial: Partial<NinaConnectionSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial }
        saveSettings(next)
        return next
      })
    },
    []
  )

  const addApiLog = useCallback((entry: ApiLogEntry) => {
    if (isLoggingPaused) return
    setApiLogs((prev) => {
      const next = [entry, ...prev]
      return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next
    })
  }, [isLoggingPaused])

  const clearApiLogs = useCallback(() => {
    setApiLogs([])
  }, [])

  const [sessionData, setSessionData] = useState<Record<string, any>>({})

  const updateSessionData = useCallback((key: string, value: any) => {
    setSessionData(prev => {
      // Avoid unnecessary re-renders if value hasn't changed
      if (prev[key] === value) return prev
      return { ...prev, [key]: value }
    })
  }, [])

  const [lastStatus, setLastStatus] = useState<NinaStatusMessage | null>(null)
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)

  // WebSocket Logic
  useEffect(() => {
    if (typeof window === "undefined" || !settings.host) return

    let socket: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout
    let rmsExceedCount = 0
    let lastCameraSequence = ""
    let logId = Math.floor(Math.random() * 1000000)
    let sequencePollInterval: NodeJS.Timeout | null = null

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      // Clean host: remove http/https AND any trailing port if the user typed it in the host field
      const hostWithoutProtocol = settings.host.replace(/^https?:\/\//, "")
      const cleanHost = hostWithoutProtocol.split(":")[0] || "localhost"

      // DOCUMENTATION FIX: The WS base is /v2, and the channel is /socket
      // So absolute path is /v2/socket, NOT /v2/api/socket
      const wsUrl = `${protocol}//${cleanHost}:${settings.port}/v2/socket`

      const startSequencePolling = () => {
        if (sequencePollInterval) return
        sequencePollInterval = setInterval(async () => {
          try {
            const cam = await getCameraInfo(settings.host, settings.port)
            if (cam.IsExposing) {
              setLastStatus(prev => {
                if (prev?.text.includes("Posa") || prev?.text.includes("Analisi") || prev?.text.includes("esposizione")) return prev
                return {
                  priority: 5,
                  text: `📸 In esposizione...`,
                  type: "status",
                  timestamp: new Date()
                }
              })
            }
          } catch (e) { /* ignore */ }
        }, 8000)
      }

      // Log the connection attempt to the API Panel for user visibility
      addApiLog({
        id: ++logId,
        timestamp: new Date(),
        method: "GET",
        path: "WS: " + wsUrl,
        status: null,
        statusText: "Try Connect...",
        durationMs: 0,
        ok: true
      })

      try {
        socket = new WebSocket(wsUrl)
        socket.binaryType = "blob" // Ensure consistent message handling

        socket.onopen = async () => {
          setIsWebSocketConnected(true)

          // REINFORCE SUBSCRIPTION: Try multiple formats for different NINA versions
          try {
            socket?.send("/socket")
            socket?.send("Subscribe:All")

            const topics = ["Camera", "Telescope", "Guider", "PlateSolver", "Application", "Focuser", "FilterWheel"]
            topics.forEach(topic => {
              socket?.send(JSON.stringify({ Topic: topic, Action: "Subscribe" }))
              socket?.send(`Subscribe:${topic}`)
            })
          } catch (e) {
            console.warn("Could not send initial sub messages", e)
          }

          // SYNC ON CONNECT & START POLLING IF NEEDED
          try {
            const [cam, seq] = await Promise.all([
              getCameraInfo(settings.host, settings.port),
              getSequenceState(settings.host, settings.port).catch(() => null)
            ])

            const isSequenceActive = seq && seq.some(item => item.Status === "Running")

            if (cam.IsExposing || isSequenceActive) {
              startSequencePolling()
            }

            if (cam.IsExposing) {
              setLastStatus({
                priority: 5,
                text: "📸 In esposizione...",
                type: "status",
                timestamp: new Date()
              })
            } else if (isSequenceActive) {
              setLastStatus({
                priority: 5,
                text: "🖥️ Sequenza in corso...",
                type: "status",
                timestamp: new Date()
              })
            } else if (cam.CameraState !== "Idle") {
              setLastStatus({
                priority: 5,
                text: `📸 Camera: ${cam.CameraState}`,
                type: "status",
                timestamp: new Date()
              })
            } else {
              setLastStatus({
                priority: 1,
                text: "🌍 NINA Pronto (Live)",
                type: "info",
                timestamp: new Date()
              })
            }
          } catch {
            setLastStatus({
              priority: 1,
              text: "🌍 Connesso a NINA",
              type: "info",
              timestamp: new Date()
            })
          }
        }

        socket.onmessage = (event) => {
          try {
            const data: NinaSocketResponse = JSON.parse(event.data)
            const response = data.Response

            // SUPER DETECTION: Look everywhere for an event name or status string
            const rawEvent = response?.Event || data.Event
            const statusStr = response?.Status || (typeof response === "string" ? response : null)
            const inferredEvent = rawEvent || statusStr || data.Type || "Message"

            let isHandled = false

            // VERBOSE DEBUG: Log EVERYTHING with high visibility
            addApiLog({
              id: ++logId,
              timestamp: new Date(),
              method: "WS",
              path: inferredEvent.toString().substring(0, 40),
              status: 200,
              statusText: data.Type || "Socket",
              durationMs: 0,
              ok: true,
              errorMessage: JSON.stringify(data, null, 2)
            })

            const eventName = rawEvent

            if (eventName === "IMAGE-SAVE" || eventName === "IMAGE-PREPARED") {
              isHandled = true
              const stats = response?.ImageStatistics
              if (stats) {
                const seqKey = `${stats.TargetName}-${stats.Index}`
                if (seqKey !== lastCameraSequence || lastStatus?.type === "error") {
                  lastCameraSequence = seqKey
                  setLastStatus({
                    priority: 5,
                    text: `📸 ${eventName === "IMAGE-SAVE" ? "Salvataggio" : "Analisi"} posa ${stats.Index}`,
                    type: "status",
                    timestamp: new Date()
                  })
                }
              } else {
                setLastStatus({
                  priority: 3,
                  text: `📸 ${eventName === "IMAGE-SAVE" ? "Salvataggio" : "Preparazione"} immagine...`,
                  type: "info",
                  timestamp: new Date()
                })
              }
            }

            if (eventName === "SEQUENCE-STARTING") {
              isHandled = true
              setLastStatus({ priority: 5, text: "🖥️ Sequenza in corso...", type: "status", timestamp: new Date() })
              startSequencePolling()
            }
            if (eventName === "SEQUENCE-FINISHED") {
              isHandled = true
              setLastStatus({ priority: 5, text: "🏁 Sequenza completata.", type: "info", timestamp: new Date() })
              if (sequencePollInterval) {
                clearInterval(sequencePollInterval)
                sequencePollInterval = null
              }
            }
            if (eventName === "API-CAPTURE-FINISHED" || eventName === "CAPTURE-FINISHED" || eventName === "GUIDER-START") {
              isHandled = true

              // If we see GUIDER-START during a sequence, it usually means dithering is done and next photo is starting
              // We'll show "In esposizione" immediately if it was Dithering before
              if (eventName === "GUIDER-START") {
                setLastStatus(prev => {
                  if (prev?.text.includes("Dithering")) {
                    return { priority: 5, text: "📸 In esposizione...", type: "status", timestamp: new Date() }
                  }
                  return prev || { priority: 1, text: "🌍 NINA Pronto (Live)", type: "info", timestamp: new Date() }
                })
              }

              // Reset status after capture or dither, but give it a moment so users can see the "Salvataggio" message
              setTimeout(() => {
                setLastStatus(prev => {
                  if (!prev || prev.type === "error" || prev.priority >= 10) return prev
                  // Don't reset if we are exposing (handled by polling or other events)
                  if (prev.text.includes("esposizione") || prev.text.includes("Posa")) return prev

                  const age = Date.now() - prev.timestamp.getTime()
                  if (age < 2000 && (prev.text.includes("Salvataggio") || prev.text.includes("Analisi"))) return prev
                  return { priority: 1, text: "🌍 NINA Pronto (Live)", type: "info", timestamp: new Date() }
                })
              }, 1500)
            }

            // 1. Plate Solver Logic
            if (eventName?.includes("PLATESOLVE") || eventName?.includes("SOLVING")) {
              isHandled = true
              if (eventName.includes("SOLVING") || eventName === "PLATESOLVER-SOLVING") {
                setLastStatus({ priority: 5, text: "🔭 Plate Solving...", type: "status", timestamp: new Date() })
              } else if (data.Success && eventName === "PLATESOLVE-FINISHED") {
                const arcsec = response?.ImageStatistics?.HFRStDev || response?.Arcseconds || 0
                setLastStatus({
                  priority: 5,
                  text: `🎯 Target centrato. Err: ${arcsec.toFixed(1)}"`,
                  type: "status",
                  timestamp: new Date()
                })
              } else if (!data.Success && eventName === "ERROR-PLATESOLVE") {
                setLastStatus({
                  priority: 10,
                  text: "⚠️ Errore Plate Solving! Verifica puntamento.",
                  type: "error",
                  timestamp: new Date()
                })
              }
            }

            if (eventName === "CAMERA-ERROR" || data.Error?.includes("Camera")) {
              setLastStatus({
                priority: 10,
                text: "📸 Errore Camera! Verifica connessione.",
                type: "error",
                timestamp: new Date()
              })
            }

            // 2.5 Autofocus Logic
            if (eventName === "AUTOFOCUS-STARTING") {
              setLastStatus({ priority: 5, text: "🛰️ Autofocus in corso...", type: "status", timestamp: new Date() })
            }
            if (eventName === "AUTOFOCUS-FINISHED") {
              setLastStatus({ priority: 5, text: "✅ Autofocus terminato.", type: "status", timestamp: new Date() })
            }
            if (eventName === "AUTOFOCUS-POINT-ADDED") {
              const pos = response?.ImageStatistics?.Position || "?"
              const hfr = response?.ImageStatistics?.HFR?.toFixed(2) || "?"
              setLastStatus({ priority: 5, text: `🛰️ AF: Posa ${pos} (HFR: ${hfr})`, type: "status", timestamp: new Date() })
            }
            if (eventName === "ERROR-AF") {
              setLastStatus({ priority: 10, text: "⚠️ Errore Autofocus!", type: "error", timestamp: new Date() })
            }

            // 3. Guider Logic
            if (eventName === "GUIDER-DITHER") {
              setLastStatus({
                priority: 5,
                text: "🛰️ Interfase: Dithering in corso...",
                type: "status",
                timestamp: new Date()
              })
            }

            if (data.Type === "Socket" && response?.RMSError) {
              const rms = response.RMSError.Total.Arcseconds
              if (rms > 1.5) {
                rmsExceedCount++
                if (rmsExceedCount >= 3) {
                  setLastStatus({
                    priority: 5,
                    text: `📉 Qualità Guida in calo! RMS: ${rms.toFixed(2)}`,
                    type: "warning",
                    timestamp: new Date()
                  })
                }
              } else {
                rmsExceedCount = 0
              }
            }

            // 4. Application / Keyword Filtering (from Response string if present)
            if (typeof response === "string" && !isHandled) {
              const keywords = ["Park", "Slew", "Finished", "Aborted", "Exposing", "Solving", "Dither", "Capture", "Moving", "Settling", "Waiting", "Starting", "Prepared"]
              if (keywords.some(k => response.includes(k))) {
                isHandled = true
                setLastStatus({
                  priority: 5,
                  text: `🖥️ ${response.length > 50 ? response.substring(0, 47) + "..." : response}`,
                  type: "info",
                  timestamp: new Date()
                })
              }
            }

            // 5. Generic Event Fallback (if still not handled and looks like an event)
            if (!isHandled && inferredEvent && inferredEvent !== "Socket" && inferredEvent !== "Message") {
              setLastStatus({
                priority: 2,
                text: `🌍 ${inferredEvent.toString().length > 50 ? inferredEvent.toString().substring(0, 47) + "..." : inferredEvent}`,
                type: "info",
                timestamp: new Date()
              })
            }

          } catch (e) {
            console.error("WS Parse Error", e)
          }
        }

        socket.onclose = (e) => {
          setIsWebSocketConnected(false)
          console.warn("WebSocket closed", e.code, e.reason)

          if (e.code !== 1000) { // Log non-clean closures
            addApiLog({
              id: ++logId,
              timestamp: new Date(),
              method: "GET",
              path: "WS DISCONNECTED",
              status: e.code,
              statusText: e.reason || "Socket Closed",
              durationMs: 0,
              ok: false,
              errorMessage: `Code: ${e.code}. Auto-reconnect in 3s.`
            })
          }

          reconnectTimeout = setTimeout(connect, 3000)
        }

        socket.onerror = (err) => {
          // Avoid noise for common connection drops
          if (socket?.readyState !== WebSocket.CLOSED && socket?.readyState !== WebSocket.CLOSING) {
            console.error("WebSocket error", err)
          }
        }
      } catch (err) {
        console.error("WS Connect Error", err)
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      if (socket) socket.close()
      clearTimeout(reconnectTimeout)
      if (sequencePollInterval) clearInterval(sequencePollInterval)
    }
  }, [settings.host, settings.port, addApiLog])

  return (
    <NinaContext.Provider
      value={{
        settings,
        updateSettings,
        isConnected,
        setIsConnected,
        connectionError,
        setConnectionError,
        apiLogs,
        addApiLog,
        clearApiLogs,
        sessionData,
        updateSessionData,
        isLoggingPaused,
        setIsLoggingPaused,
        lastStatus,
        isWebSocketConnected,
      }}
    >
      {children}
    </NinaContext.Provider>
  )
}

export function useNina() {
  const ctx = useContext(NinaContext)
  if (!ctx) throw new Error("useNina must be used within NinaProvider")
  return ctx
}
