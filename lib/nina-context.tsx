"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import {
  DEFAULT_SETTINGS,
  type NinaConnectionSettings,
  type ApiLogEntry,
  type AlarmEntry,
  type AlarmSource,
  type ImageHistoryItem,
  type BatteryResponse,
} from "./nina-types"
import {
  getCameraInfo,
  getGuiderInfo,
  getImageHistory,
  getSequenceState,
  getMountInfo,
} from "./nina-api"
import { getBatteryStatus } from "./transfer-api"
import { useNinaPolling } from "./use-nina-polling"

const MAX_LOG_ENTRIES = 500
const MAX_ALARM_LOG = 200

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
  pipWindow: any | null
  setPipWindow: (window: any | null) => void
  // --- Alarm System ---
  activeAlarms: AlarmEntry[]
  alarmLog: AlarmEntry[]
  /** Aggiunge o aggiorna un allarme attivo (unico per source) */
  raiseAlarm: (entry: Omit<AlarmEntry, "id" | "acked" | "resolved">) => void
  /** Segna un allarme come risolto (dato rientrato): sparisce dagli attivi, torna normale */
  resolveAlarm: (source: AlarmSource) => void
  /** L'operatore preme ACK: marchio tutto come acked */
  ackAlarms: () => void
  /** [NUOVO] ACK per singolo allarme */
  ackSingleAlarm: (id: string) => void
  clearAlarmLog: () => void
  /** true se c'è almeno un CRITICAL non ancora acked e non ancora resolved */
  hasActiveCritical: boolean
  /** true se c'è storico allarmi (per mantenere icona visibile) */
  hasAlarmHistory: boolean
  /** Drawer alarm aperto/chiuso. Il secondo parametro indica se l'apertura è manuale */
  alarmDrawerOpen: boolean
  setAlarmDrawerOpen: (open: boolean, isManual?: boolean) => void

  /** [NUOVO] Dati centralizzati dal polling */
  camera: any | null
  guider: any | null
  imageHistory: ImageHistoryItem[] | null
  sequence: any | null
  mount: any | null
  battery: BatteryResponse | null
  isPollingLoading: boolean
  pollingError: string | null
}

const NinaContext = createContext<NinaContextValue | null>(null)

const STORAGE_KEY = "nina-dashboard-settings"

function loadSettings(): NinaConnectionSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS

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

let alarmIdCounter = 0
function nextAlarmId() {
  return `alarm-${Date.now()}-${++alarmIdCounter}`
}

export function NinaProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<NinaConnectionSettings>(DEFAULT_SETTINGS)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([])
  const [isLoggingPaused, setIsLoggingPaused] = useState(false)
  const [pipWindow, setPipWindow] = useState<any | null>(null)
  const [sessionData, setSessionData] = useState<Record<string, any>>({})
  const [alarmDrawerOpen, setAlarmDrawerOpenState] = useState(false)
  const isDrawerManualOpenRef = useRef(false)
  const autoOpenedSourcesRef = useRef<Set<string>>(new Set())

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

  const updateSessionData = useCallback((key: string, value: any) => {
    setSessionData(prev => {
      if (prev[key] === value) return prev
      return { ...prev, [key]: value }
    })
  }, [])

  // --- Centralized Polling ---
  const cameraFetcher = useCallback(
    (signal: AbortSignal) => getCameraInfo(settings.host, settings.port, signal),
    [settings.host, settings.port]
  )
  const { data: camera, error: cameraError, isLoading: cameraLoading } = useNinaPolling({
    fetcher: cameraFetcher,
    interval: settings.pollingInterval,
    enabled: isConnected,
  })

  const guiderFetcher = useCallback(
    (signal: AbortSignal) => getGuiderInfo(settings.host, settings.port, signal),
    [settings.host, settings.port]
  )
  const { data: guider, error: guiderError, isLoading: guiderLoading } = useNinaPolling({
    fetcher: guiderFetcher,
    interval: settings.pollingInterval,
    enabled: isConnected,
  })

  const historyFetcher = useCallback(
    (signal: AbortSignal) => getImageHistory(settings.host, settings.port, signal),
    [settings.host, settings.port]
  )
  const { data: imageHistory, error: historyError, isLoading: historyLoading } = useNinaPolling({
    fetcher: historyFetcher,
    interval: settings.pollingInterval + 500, // leggermente sfalsato
    enabled: isConnected,
  })

  const sequenceFetcher = useCallback(
    (signal: AbortSignal) => getSequenceState(settings.host, settings.port, signal),
    [settings.host, settings.port]
  )
  const { data: sequence, error: sequenceError, isLoading: sequenceLoading } = useNinaPolling({
    fetcher: sequenceFetcher,
    interval: settings.pollingInterval + 200,
    enabled: isConnected,
  })

  const batteryFetcher = useCallback(
    (signal: AbortSignal) => getBatteryStatus(settings.host, settings.transferPort, signal, addApiLog),
    [settings.host, settings.transferPort, addApiLog]
  )
  const { data: battery, error: batteryError, isLoading: batteryLoading } = useNinaPolling({
    fetcher: batteryFetcher,
    interval: 15000,
    enabled: isConnected && settings.enableTransfer,
  })

  const mountFetcher = useCallback(
    (signal: AbortSignal) => getMountInfo(settings.host, settings.port, signal),
    [settings.host, settings.port]
  )
  const { data: mount, error: mountError, isLoading: mountLoading } = useNinaPolling({
    fetcher: mountFetcher,
    interval: settings.pollingInterval,
    enabled: isConnected,
  })

  const pollingError = cameraError || guiderError || historyError || sequenceError || mountError || batteryError || null
  const isPollingLoading = cameraLoading && guiderLoading && historyLoading && sequenceLoading && mountLoading && batteryLoading

  // activeAlarms: solo allarmi in corso (non resolved)
  const [activeAlarms, setActiveAlarms] = useState<AlarmEntry[]>([])
  // alarmLog: storico di sessione (tutti, anche risolti)
  const [alarmLog, setAlarmLog] = useState<AlarmEntry[]>([])

  const setAlarmDrawerOpen = useCallback((open: boolean, isManual: boolean = false) => {
    setAlarmDrawerOpenState(open)
    if (open) {
      isDrawerManualOpenRef.current = isManual
    } else {
      // Quando si chiude (manualmente o auto), resettiamo il flag manuale
      isDrawerManualOpenRef.current = false
    }
  }, [])


  // --- Alarm actions ---

  const raiseAlarm = useCallback((entry: Omit<AlarmEntry, "id" | "acked" | "resolved">) => {
    const alarmId = nextAlarmId()

    setActiveAlarms(prev => {
      // Se esiste già un allarme attivo (anche se acked), non lo riaggiungiamo.
      const exists = prev.find(a => a.source === entry.source)
      if (exists) return prev

      const newEntry: AlarmEntry = {
        ...entry,
        id: alarmId,
        acked: false,
        resolved: false,
      }
      return [newEntry, ...prev]
    })

    // Aggiungi sempre al log storico (se non già presente e non risolta)
    setAlarmLog(prev => {
      // Evita duplicati per la stessa source non risolta
      const hasActive = prev.find(a => a.source === entry.source && !a.resolved)
      if (hasActive) return prev
      const newEntry: AlarmEntry = {
        ...entry,
        id: alarmId,
        acked: false,
        resolved: false,
      }
      const next = [newEntry, ...prev]
      return next.length > MAX_ALARM_LOG ? next.slice(0, MAX_ALARM_LOG) : next
    })

    // Auto-apertura drawer se WARNING o CRITICAL (solo la prima volta per source)
    // Coerente con "Visual monitoring remains always active"
    if (entry.level === "WARNING" || entry.level === "CRITICAL") {
      if (!autoOpenedSourcesRef.current.has(entry.source)) {
        setAlarmDrawerOpen(true)
        autoOpenedSourcesRef.current.add(entry.source)
      }
    }
  }, [setAlarmDrawerOpen])

  const resolveAlarm = useCallback((source: AlarmSource) => {
    setActiveAlarms(prev => prev.filter(a => a.source !== source))
    autoOpenedSourcesRef.current.delete(source)
    setAlarmLog(prev => prev.map(a =>
      a.source === source && !a.resolved
        ? { ...a, resolved: true }
        : a
    ))
  }, [])

  const ackAlarms = useCallback(() => {
    setActiveAlarms(prev => prev.map(a => (!a.acked ? { ...a, acked: true } : a)))
    setAlarmLog(prev => prev.map(a => (!a.acked ? { ...a, acked: true } : a)))
  }, [])

  const ackSingleAlarm = useCallback((id: string) => {
    setActiveAlarms(prev => prev.map(a => a.id === id ? { ...a, acked: true } : a))
    setAlarmLog(prev => prev.map(a => a.id === id ? { ...a, acked: true } : a))
  }, [])

  const clearAlarmLog = useCallback(() => {
    setAlarmLog([])
  }, [])

  const hasActiveCritical = useMemo(
    () => activeAlarms.some(a => a.level === "CRITICAL" && !a.acked),
    [activeAlarms]
  )

  // Auto-chiusura drawer se non ci sono più allarmi non riconosciuti (nuovi o attivi)
  // MA solo se non è stato aperto manualmente
  useEffect(() => {
    if (!alarmDrawerOpen || isDrawerManualOpenRef.current) return

    if (activeAlarms.length > 0 && activeAlarms.every(a => a.acked)) {
      setAlarmDrawerOpen(false)
    }
    // Se la lista è vuota (tutti risolti), chiudiamo comunque se era aperto
    if (activeAlarms.length === 0) {
      setAlarmDrawerOpen(false)
    }
  }, [activeAlarms, alarmDrawerOpen, setAlarmDrawerOpen])

  const hasAlarmHistory = useMemo(() => alarmLog.length > 0, [alarmLog])

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
        pipWindow,
        setPipWindow,
        camera,
        guider,
        imageHistory,
        sequence,
        mount,
        battery,
        isPollingLoading,
        pollingError,
        activeAlarms,
        alarmLog,
        raiseAlarm,
        resolveAlarm,
        ackAlarms,
        ackSingleAlarm,
        clearAlarmLog,
        hasActiveCritical,
        hasAlarmHistory,
        alarmDrawerOpen,
        setAlarmDrawerOpen,
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
