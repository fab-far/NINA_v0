"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { ApiLogCallback } from "./nina-api"

interface UseNinaPollingOptions<T> {
  fetcher: (signal: AbortSignal, onLog?: ApiLogCallback) => Promise<T>
  interval: number
  enabled?: boolean
  onLog?: ApiLogCallback
}

interface UseNinaPollingResult<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  lastUpdated: Date | null
  refresh: () => void
}

export function useNinaPolling<T>({
  fetcher,
  interval,
  enabled = true,
  onLog,
}: UseNinaPollingOptions<T>): UseNinaPollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const fetcherRef = useRef(fetcher)
  const onLogRef = useRef(onLog)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  useEffect(() => {
    onLogRef.current = onLog
  }, [onLog])

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    let active = true
    const controller = new AbortController()

    async function poll() {
      try {
        const result = await fetcherRef.current(controller.signal, onLogRef.current)
        if (active) {
          setData(result)
          setError(null)
          setIsLoading(false)
          setLastUpdated(new Date())
        }
      } catch (err: unknown) {
        if (active && !(err instanceof DOMException && err.name === "AbortError")) {
          const message =
            err instanceof Error ? err.message : "Connection failed"
          setError(message)
          setIsLoading(false)
        }
      }
    }

    poll()
    const id = setInterval(poll, interval)

    // Pause when tab not visible
    function onVisibilityChange() {
      if (document.hidden) {
        // do nothing extra, interval keeps ticking but fetch will be skipped naturally
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      active = false
      controller.abort()
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [interval, enabled, refreshKey])

  return { data, error, isLoading, lastUpdated, refresh }
}
