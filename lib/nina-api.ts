import type {
  NinaApiResponse,
  CameraInfo,
  GuiderInfo,
  GuiderGraphData,
  SequenceState,
  ImageHistoryItem,
  ApiLogEntry,
  LiveStackAvailableTarget,
  LiveStackInfo,
} from "./nina-types"

let logIdCounter = 0

export type ApiLogCallback = (entry: ApiLogEntry) => void

function buildUrl(host: string, port: number, path: string): string {
  const base = host.startsWith("http") ? host : `http://${host}`
  return `${base}:${port}/v2/api${path}`
}

async function fetchNina<T>(
  host: string,
  port: number,
  path: string,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<T> {
  const url = buildUrl(host, port, path)
  const start = performance.now()

  let status: number | null = null
  let statusText = ""
  let ok = false

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    })

    status = res.status
    statusText = res.statusText
    ok = res.ok
    const durationMs = Math.round(performance.now() - start)

    if (onLog) {
      onLog({
        id: ++logIdCounter,
        timestamp: new Date(),
        method: "GET",
        path: `/v2/api${path}`,
        status,
        statusText,
        durationMs,
        ok,
      })
    }

    if (!res.ok) {
      throw new Error(`NINA API Error: ${res.status} ${res.statusText}`)
    }

    const data: NinaApiResponse<T> = await res.json()

    if (!data.Success && data.Error) {
      throw new Error(`NINA: ${data.Error}`)
    }

    return data.Response
  } catch (err) {
    const durationMs = Math.round(performance.now() - start)

    // Only log network errors (not already logged above)
    if (status === null && onLog) {
      const message = err instanceof Error ? err.message : "Network error"
      // Don't log aborted requests
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        onLog({
          id: ++logIdCounter,
          timestamp: new Date(),
          method: "GET",
          path: `/v2/api${path}`,
          status: null,
          statusText: "Network Error",
          durationMs,
          ok: false,
          errorMessage: message,
        })
      }
    }
    throw err
  }
}

// -- Camera --
export async function getCameraInfo(
  host: string,
  port: number,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<CameraInfo> {
  return fetchNina<CameraInfo>(host, port, "/equipment/camera/info", signal, onLog)
}

// -- Guider --
export async function getGuiderInfo(
  host: string,
  port: number,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<GuiderInfo> {
  return fetchNina<GuiderInfo>(host, port, "/equipment/guider/info", signal, onLog)
}

// -- Mount --
export async function getMountInfo(
  host: string,
  port: number,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<import("./nina-types").MountInfo> {
  return fetchNina<import("./nina-types").MountInfo>(host, port, "/equipment/mount/info", signal, onLog)
}

export async function getGuiderGraph(
  host: string,
  port: number,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<GuiderGraphData> {
  return fetchNina<GuiderGraphData>(host, port, "/equipment/guider/graph", signal, onLog)
}

// -- Sequence --
export async function getSequenceState(
  host: string,
  port: number,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<SequenceState> {
  return fetchNina<SequenceState>(host, port, "/sequence/json", signal, onLog)
}

// -- Image History --
export async function getImageHistory(
  host: string,
  port: number,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<ImageHistoryItem[]> {
  return fetchNina<ImageHistoryItem[]>(host, port, "/image-history?all=true", signal, onLog)
}

// -- Image URL (with optional resize for thumbnails) --
export function getImageUrl(
  host: string,
  port: number,
  id: number,
  options?: {
    resize?: boolean
    width?: number
    height?: number
    quality?: number
    debayer?: boolean
    autoprepared?: boolean
  }
): string {
  const {
    resize = false,
    width = 640,
    height = 480,
    quality = 80,
    debayer = true,
    autoprepared = true
  } = options || {}

  let params = `autoprepared=${autoprepared}&debayer=${debayer}&stream=true&quality=${quality}`

  if (resize) {
    params += `&resize=true&size=${width}x${height}`
  }

  return buildUrl(host, port, `/image/${id}?${params}`)
}

// Full quality image (accepts full options)
export function getFullImageUrl(
  host: string,
  port: number,
  id: number,
  options?: {
    resize?: boolean
    width?: number
    height?: number
    quality?: number
    debayer?: boolean
    autoprepared?: boolean
  }
): string {
  return getImageUrl(host, port, id, options)
}

// Thumbnail image - uses dedicated thumbnail endpoint (unconfigurable)
export function getThumbnailImageUrl(
  host: string,
  port: number,
  id: number
): string {
  return buildUrl(host, port, `/image/thumbnail/${id}`)
}

// Prepared image (thumbnails with configuration)
export function getPreparedImageUrl(
  host: string,
  port: number,
  id: number,
  options?: {
    resize?: boolean
    width?: number
    height?: number
    quality?: number
    debayer?: boolean
    autoprepared?: boolean
  }
): string {
  // If no options provided, use the fast thumbnail endpoint
  if (!options || (!options.resize && options.quality === undefined && options.debayer === undefined && options.autoprepared === undefined)) {
    return getThumbnailImageUrl(host, port, id)
  }

  // Otherwise use the main image endpoint with requested parameters
  return getImageUrl(host, port, id, options)
}

// -- LiveStack --

export async function getLiveStackStatus(
  host: string,
  port: number,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<string> {
  return fetchNina<string>(host, port, "/livestack/status", signal, onLog)
}

export async function getLiveStackAvailableImages(
  host: string,
  port: number,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<LiveStackAvailableTarget[]> {
  return fetchNina<LiveStackAvailableTarget[]>(host, port, "/livestack/image/available", signal, onLog)
}

export async function getLiveStackInfo(
  host: string,
  port: number,
  target: string,
  filter: string,
  signal?: AbortSignal,
  onLog?: ApiLogCallback
): Promise<LiveStackInfo> {
  const encodedTarget = encodeURIComponent(target)
  const encodedFilter = encodeURIComponent(filter)
  return fetchNina<LiveStackInfo>(host, port, `/livestack/image/${encodedTarget}/${encodedFilter}/info`, signal, onLog)
}

export function getLiveStackImageUrl(
  host: string,
  port: number,
  target: string,
  filter: string,
  quality = 90
): string {
  const encodedTarget = encodeURIComponent(target)
  const encodedFilter = encodeURIComponent(filter)
  return buildUrl(host, port, `/livestack/image/${encodedTarget}/${encodedFilter}?quality=${quality}&stream=true`)
}
