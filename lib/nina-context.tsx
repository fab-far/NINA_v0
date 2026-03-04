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
} from "./nina-types"

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
