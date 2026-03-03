import { ApiLogCallback } from "./nina-api";

export interface BrowseItem {
    name: string
    is_dir: boolean
    rel_path: string
    size: number
}

export interface BrowseResponse {
    current_rel_path: string
    items: BrowseItem[]
}

export interface TransferStatus {
    type: "START" | "PROGRESS" | "COMPLETE" | "ERROR" | "INFO"
    filename?: string
    total_size?: number
    file_count?: number
    message?: string
    processed?: number
    total?: number
    duration_sec?: number
}

let logIdCounter = 10000;

export interface RecursiveFile {
    rel_path: string
    abs_rel_path: string
    size: number
}

export interface ListRecursiveResponse {
    files: RecursiveFile[]
}

export function getBrowseUrl(host: string, port: number, path: string): string {
    const base = host.startsWith("http") ? host : `http://${host}`
    return `${base}:${port}/api/browse?path=${encodeURIComponent(path)}`
}

export function getDownloadUrl(host: string, port: number, path: string): string {
    const base = host.startsWith("http") ? host : `http://${host}`
    return `${base}:${port}/api/download?path=${encodeURIComponent(path)}`
}

export function getListRecursiveUrl(host: string, port: number, path: string): string {
    const base = host.startsWith("http") ? host : `http://${host}`
    return `${base}:${port}/api/list-recursive?path=${encodeURIComponent(path)}`
}

export function getTransferWsUrl(host: string, port: number): string {
    const baseHost = host.replace(/^http:\/\//, "").replace(/^https:\/\//, "")
    return `ws://${baseHost}:${port}/ws/transfer`
}

export async function browseDirectory(host: string, port: number, path: string, signal?: AbortSignal, onLog?: ApiLogCallback): Promise<BrowseResponse> {
    const url = getBrowseUrl(host, port, path)
    if (!host) throw new Error("Invalid Host")

    const start = performance.now()
    let status: number | null = null
    let statusText = ""
    let ok = false

    try {
        const res = await fetch(url, { signal })
        status = res.status
        statusText = res.statusText
        ok = res.ok

        const durationMs = Math.round(performance.now() - start)
        if (onLog) {
            onLog({
                id: ++logIdCounter,
                timestamp: new Date(),
                method: "GET",
                path: `/transfer/browse?path=${path}`,
                status,
                statusText,
                durationMs,
                ok
            })
        }

        if (!res.ok) {
            let detail = ""
            try {
                const errBody = await res.json()
                detail = errBody.detail || ""
            } catch (e) { }
            throw new Error(detail || `HTTP Error ${res.status}`)
        }
        return await res.json()
    } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
            const durationMs = Math.round(performance.now() - start)
            if (onLog && status === null) {
                onLog({
                    id: ++logIdCounter,
                    timestamp: new Date(),
                    method: "GET",
                    path: `/transfer/browse?path=${path}`,
                    status: null,
                    statusText: "Network Error",
                    durationMs,
                    ok: false,
                    errorMessage: err instanceof Error ? err.message : "Connect Error"
                })
            }
        }
        throw err
    }
}

export async function listRecursive(host: string, port: number, path: string, signal?: AbortSignal, onLog?: ApiLogCallback): Promise<ListRecursiveResponse> {
    const url = getListRecursiveUrl(host, port, path)
    if (!host) throw new Error("Invalid Host")

    const start = performance.now()
    let status: number | null = null
    let statusText = ""
    let ok = false

    try {
        const res = await fetch(url, { signal })
        status = res.status
        statusText = res.statusText
        ok = res.ok

        const durationMs = Math.round(performance.now() - start)
        if (onLog) {
            onLog({
                id: ++logIdCounter,
                timestamp: new Date(),
                method: "GET",
                path: `/transfer/list-recursive?path=${path}`,
                status,
                statusText,
                durationMs,
                ok
            })
        }

        if (!res.ok) {
            let detail = ""
            try {
                const errBody = await res.json()
                detail = errBody.detail || ""
            } catch (e) { }
            throw new Error(detail || `HTTP Error ${res.status}`)
        }
        return await res.json()
    } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
            const durationMs = Math.round(performance.now() - start)
            if (onLog && status === null) {
                onLog({
                    id: ++logIdCounter,
                    timestamp: new Date(),
                    method: "GET",
                    path: `/transfer/list-recursive?path=${path}`,
                    status: null,
                    statusText: "Network Error",
                    durationMs,
                    ok: false,
                    errorMessage: err instanceof Error ? err.message : "Connect Error"
                })
            }
        }
        throw err
    }
}
export interface BatteryResponse {
    status: "idle" | "starting" | "running" | "error"
    message?: string
    battery_voltage: number
    load_current: number
    load_watt: number
    consumed_wh: number
    yield_today: number
}

export function getBatteryUrl(host: string, port: number): string {
    if (!host) return ""
    const base = host.startsWith("http") ? host : `http://${host}`
    return `${base}:${port}/api/battery`
}

export async function getBatteryStatus(host: string, port: number, signal?: AbortSignal, onLog?: ApiLogCallback): Promise<BatteryResponse> {
    const url = getBatteryUrl(host, port)
    if (!url) throw new Error("Invalid Host/Port")

    const start = performance.now()
    let status: number | null = null
    let statusText = ""
    let ok = false

    try {
        const res = await fetch(url, { signal })
        status = res.status
        statusText = res.statusText
        ok = res.ok

        const durationMs = Math.round(performance.now() - start)
        if (onLog) {
            onLog({
                id: ++logIdCounter,
                timestamp: new Date(),
                method: "GET",
                path: "/transfer/battery",
                status,
                statusText,
                durationMs,
                ok
            })
        }

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return await res.json()
    } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
            const durationMs = Math.round(performance.now() - start)
            if (onLog && status === null) {
                onLog({
                    id: ++logIdCounter,
                    timestamp: new Date(),
                    method: "GET",
                    path: "/transfer/battery",
                    status: null,
                    statusText: "Network Error",
                    durationMs,
                    ok: false,
                    errorMessage: err instanceof Error ? err.message : "Connect Error"
                })
            }
        }
        throw err
    }
}
