"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import {
    Folder,
    File,
    ChevronRight,
    Download,
    HardDriveDownload,
    Loader2,
    Home,
    ArrowLeft,
    X,
    FileArchive,
    Play,
    Pause,
    Check,
    ArrowRight,
    RefreshCw,
    Plus,
    FolderSync,
    Settings2,
    Edit2,
    LockOpen
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNina } from "@/lib/nina-context"
import { cn, formatNumber } from "@/lib/utils"
import {
    browseDirectory,
    getDownloadUrl,
    getTransferWsUrl,
    getListRecursiveUrl,
    BrowseItem,
    TransferStatus,
    listRecursive
} from "@/lib/transfer-api"
import { saveFileHandle, getFileHandle, removeFileHandle } from "@/lib/idb-handles"

interface TransferDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TransferDialog({ open, onOpenChange }: TransferDialogProps) {
    const { settings, isConnected, addApiLog } = useNina()
    const [currentPath, setCurrentPath] = useState("")
    const [items, setItems] = useState<BrowseItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Transfer State
    const [isTransferring, setIsTransferring] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [transferStatus, setTransferStatus] = useState<"IDLE" | "ZIPPING" | "TRANSFERRING" | "COMPLETE" | "ERROR">("IDLE")
    const [zippingProgress, setZippingProgress] = useState({ processed: 0, total: 0 })
    const [transferProgress, setTransferProgress] = useState(0)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [finalDuration, setFinalDuration] = useState<number | null>(null)
    const [transferInfo, setTransferInfo] = useState<{ filename: string, received: number, total: number, rel_path: string, fileCount?: number, completedFiles?: number } | null>(null)
    const [lastSyncInfo, setLastSyncInfo] = useState<{ rel_path: string, name: string } | null>(null)
    const [quickSyncStatus, setQuickSyncStatus] = useState<{ status: 'idle' | 'checking' | 'ready' | 'synchronized' | 'needs_permission', newFiles?: number } | null>(null)
    const lastReceivedOffset = useRef<number>(0)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const isTransferringRef = useRef(false)
    const isPausedRef = useRef(false)
    const syncSessionIdRef = useRef(0)

    const wsRef = useRef<WebSocket | null>(null)
    const activeStreams = useRef<WebSocket[]>([])
    const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
    const browseControllerRef = useRef<AbortController | null>(null)

    const loadDirectory = useCallback(async (path: string) => {
        // Cancel previous browse request if any
        if (browseControllerRef.current) {
            browseControllerRef.current.abort()
        }
        const controller = new AbortController()
        browseControllerRef.current = controller

        setIsLoading(true)
        setError(null)
        try {
            const data = await browseDirectory(settings.host, settings.transferPort, path, controller.signal, addApiLog)
            // Sort: Directories first, then files, both alphabetically
            const sortedItems = [...data.items].sort((a, b) => {
                if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name)
                return a.is_dir ? -1 : 1
            })
            setItems(sortedItems)
            setCurrentPath(data.current_rel_path)
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return

            console.error("[TransferDialog] Load error:", err)
            const msg = err instanceof Error ? err.message : "Connect Error"
            if (msg.includes("N.I.N.A. is closed")) {
                setError("N.I.N.A. is CLOSED or path not resolved. Please open N.I.N.A. and make sure you have an active profile with a valid Image File Path.")
            } else {
                setError(`Failed to load directory: ${msg}. Check Transfer Bridge status.`)
            }
        } finally {
            if (browseControllerRef.current === controller) {
                setIsLoading(false)
            }
        }
    }, [settings.host, settings.transferPort])

    useEffect(() => {
        // Load persistent transfer state on mount
        const saved = localStorage.getItem("nina_transfer_state")
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setTransferInfo(parsed.info)
                setTransferProgress(parsed.progress)
                lastReceivedOffset.current = parsed.offset
                setTransferStatus(parsed.status || "IDLE")
                setIsPaused(parsed.isPaused || false)
                isPausedRef.current = parsed.isPaused || false
                isTransferringRef.current = parsed.status === "TRANSFERRING"
            } catch (e) {
                console.error("[Transfer] Failed to parse saved state:", e)
            }
        }

        // Try to recover directory handle from IndexedDB unconditionally on mount
        getFileHandle("active_directory_sync").then(handle => {
            if (handle) {
                console.log("[Sync] Recovered directory handle from IndexedDB")
                // @ts-ignore
                directoryHandleRef.current = handle
            }
        })
    }, [])

    useEffect(() => {
        // Save transfer state to localStorage
        if (transferInfo) {
            localStorage.setItem("nina_transfer_state", JSON.stringify({
                info: transferInfo,
                progress: transferProgress,
                offset: lastReceivedOffset.current,
                status: transferStatus,
                isPaused: isPaused
            }))
        } else if (transferStatus === "IDLE") {
            localStorage.removeItem("nina_transfer_state")
        }
    }, [transferInfo, transferProgress, transferStatus, isPaused])

    useEffect(() => {
        if (isTransferring && !isPaused) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1)
            }, 1000)
        } else {
            if (timerRef.current) clearInterval(timerRef.current)
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [isTransferring, isPaused])

    useEffect(() => {
        if (open) {
            // Reset status if it was previously COMPLETED, but only when manually opening the window fresh
            if (transferStatus === "COMPLETE") {
                setTransferStatus("IDLE")
                setTransferInfo(null)
            }

            loadDirectory(currentPath || "")
            // Load last sync metadata and ensure handle is recovered
            const restoreSync = async () => {
                const [meta, handle] = await Promise.all([
                    getFileHandle("last_sync_remote"),
                    getFileHandle("active_directory_sync")
                ])
                if (handle) {
                    // @ts-ignore
                    directoryHandleRef.current = handle
                }
                if (meta) {
                    // @ts-ignore
                    setLastSyncInfo(meta)
                    checkQuickSyncStatus(meta as any)
                }
            }
            restoreSync()
        }
    }, [open])

    const checkQuickSyncStatus = async (meta: { rel_path: string, name: string }) => {
        if (!directoryHandleRef.current) return

        // Handle Permission if needed (read-only is enough for check)
        try {
            // @ts-ignore
            const permission = await directoryHandleRef.current.queryPermission({ mode: 'readwrite' })
            if (permission !== 'granted') {
                console.log("[QuickSync] Permission not granted, status check aborted.")
                setQuickSyncStatus({ status: 'needs_permission' })
                return
            }
        } catch (e) {
            console.error("[QuickSync] Permission query failed:", e)
            setQuickSyncStatus({ status: 'idle' })
            return
        }

        setQuickSyncStatus({ status: 'checking' })
        console.log(`[QuickSync] Checking status for ${meta.rel_path}...`)

        try {
            const { files } = await listRecursive(settings.host, settings.transferPort, meta.rel_path)
            let newFilesCount = 0
            const missingFiles = []

            for (const fileInfo of files) {
                const pathParts = fileInfo.rel_path.split("/")
                const fileName = pathParts.pop()!
                let current = directoryHandleRef.current
                let found = true

                try {
                    for (const part of pathParts) {
                        current = await current.getDirectoryHandle(part)
                    }
                    const handle = await current.getFileHandle(fileName)
                    const file = await handle.getFile()
                    if (file.size !== fileInfo.size) {
                        found = false
                        console.log(`[QuickSync] Size mismatch for ${fileInfo.rel_path}: local=${file.size}, remote=${fileInfo.size}`)
                    }
                } catch (e) {
                    found = false
                }

                if (!found) {
                    newFilesCount++
                    missingFiles.push(fileInfo.rel_path)
                }
            }

            console.log(`[QuickSync] Check complete. ${newFilesCount} new files found.`, newFilesCount > 0 ? missingFiles : "")

            setQuickSyncStatus({
                status: newFilesCount > 0 ? 'ready' : 'synchronized',
                newFiles: newFilesCount
            })
        } catch (e) {
            console.error("[QuickSync] Status check failed:", e)
            setQuickSyncStatus({ status: 'idle' })
        }
    }

    const handleGrantPermission = async () => {
        if (!directoryHandleRef.current) return
        try {
            // @ts-ignore
            const res = await directoryHandleRef.current.requestPermission({ mode: 'readwrite' })
            if (res === 'granted' && lastSyncInfo) {
                checkQuickSyncStatus(lastSyncInfo)
            }
        } catch (e) {
            console.error("[QuickSync] Failed to grant permission:", e)
        }
    }

    const handleFolderClick = (path: string) => {
        loadDirectory(path)
    }

    const handleBackClick = () => {
        const parts = currentPath.split(/[\\/]/).filter(Boolean)
        if (parts.length === 0) return
        parts.pop()
        loadDirectory(parts.join("/"))
    }

    const downloadFile = (item: BrowseItem) => {
        const url = getDownloadUrl(settings.host, settings.transferPort, item.rel_path)
        const link = document.createElement("a")
        link.href = url
        link.download = item.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Removed old transferFolder function

    const syncFolder = async (item: BrowseItem, options?: { isQuickSync?: boolean, forceNewHandle?: boolean }) => {
        const isQuickSync = options?.isQuickSync || false
        const forceNewHandle = options?.forceNewHandle || false

        if (isTransferring) {
            console.log("[Sync] Sync already in progress, ignoring request.")
            return
        }

        // Set status immediately to show progress bar if it's a resume
        setIsTransferring(true)
        isTransferringRef.current = true
        setTransferStatus("TRANSFERRING")
        setIsPaused(false)
        isPausedRef.current = false

        setIsLoading(true)
        setError(null)
        console.log(`[Sync] Starting sync for ${item.rel_path} on port ${settings.transferPort}`)

        try {
            // 1. Get recursive list of files
            const listUrl = getListRecursiveUrl(settings.host, settings.transferPort, item.rel_path)
            console.log(`[Sync] Fetching file list from ${listUrl}`)
            const { files } = await listRecursive(settings.host, settings.transferPort, item.rel_path)

            console.log(`[Sync] Found ${files.length} files to transfer`)
            if (files.length === 0) {
                setError(`Nessun file trovato in ${item.rel_path} (o errore server)`)
                setIsLoading(false)
                return
            }

            const totalBytes = files.reduce((acc: number, f: any) => acc + f.size, 0)

            // 2. Select local directory
            if (forceNewHandle || !directoryHandleRef.current || !isQuickSync) {
                try {
                    console.log("[Sync] Opening directory picker...")
                    // @ts-ignore
                    directoryHandleRef.current = await window.showDirectoryPicker({
                        mode: 'readwrite',
                        startIn: 'documents'
                    })
                } catch (err) {
                    console.log("[Sync] Picker canceled or failed:", err)
                    setIsLoading(false)
                    return
                }
                if (directoryHandleRef.current) {
                    await saveFileHandle("active_directory_sync", directoryHandleRef.current)
                }
            } else {
                // Check permission for recovered handle (only if it's Quick Sync)
                // @ts-ignore
                const permission = await directoryHandleRef.current.queryPermission({ mode: 'readwrite' })
                if (permission !== 'granted') {
                    // @ts-ignore
                    const request = await directoryHandleRef.current.requestPermission({ mode: 'readwrite' })
                    if (request !== 'granted') {
                        directoryHandleRef.current = null
                        setIsLoading(false)
                        return
                    }
                }
            }

            // Update Refs and State
            isTransferringRef.current = true
            isPausedRef.current = false
            setIsTransferring(true)
            setIsPaused(false)
            setTransferStatus("TRANSFERRING")

            setTransferInfo(prev => {
                const isResume = prev && prev.rel_path === item.rel_path
                return {
                    filename: item.name,
                    received: isResume ? prev.received : 0,
                    total: totalBytes,
                    rel_path: item.rel_path,
                    fileCount: files.length,
                    completedFiles: isResume ? prev.completedFiles : 0
                }
            })
            setElapsedTime(0)
            setFinalDuration(null)

            // Save for Quick Sync
            saveFileHandle("last_sync_remote", { rel_path: item.rel_path, name: item.name } as any)
            setLastSyncInfo({ rel_path: item.rel_path, name: item.name })

            // New session ID to invalidate ghost workers
            const currentSessionId = ++syncSessionIdRef.current
            activeStreams.current.forEach(ws => ws.close())
            activeStreams.current = []

            const totalSize = totalBytes
            let totalReceived = 0
            let completedFilesCount = 0
            const queue = [...files]
            const MAX_WORKERS = 4
            const dirCache = new Map<string, FileSystemDirectoryHandle>()

            const getOrCreateDirCached = async (dirHandle: FileSystemDirectoryHandle, pathParts: string[]): Promise<FileSystemDirectoryHandle> => {
                let current = dirHandle
                let currentPath = ""
                for (const part of pathParts) {
                    currentPath += (currentPath ? "/" : "") + part
                    if (dirCache.has(currentPath)) {
                        current = dirCache.get(currentPath)!
                    } else {
                        current = await current.getDirectoryHandle(part, { create: true })
                        dirCache.set(currentPath, current)
                    }
                }
                return current
            }

            const downloadFileWorker = async (fileInfo: any) => {
                if (!isTransferringRef.current) return

                const pathParts = fileInfo.rel_path.split("/")
                const fileName = pathParts.pop()!
                const subDir = await getOrCreateDirCached(directoryHandleRef.current!, pathParts)

                let resumeOffset = 0
                try {
                    const existingFile = await subDir.getFileHandle(fileName)
                    const file = await existingFile.getFile()
                    if (file.size === fileInfo.size) {
                        totalReceived += fileInfo.size
                        completedFilesCount++
                        setTransferProgress((totalReceived / totalSize) * 100)
                        setTransferInfo(prev => {
                            if (!prev) return null
                            return {
                                ...prev,
                                received: Math.max(prev.received, totalReceived),
                                completedFiles: Math.max(prev.completedFiles || 0, completedFilesCount)
                            }
                        })
                        return
                    } else if (file.size < fileInfo.size) {
                        resumeOffset = file.size
                    }
                } catch (e) {
                    // File doesn't exist
                }

                // Immediately account for what we already have (resumeOffset) to keep total progress accurate
                totalReceived += resumeOffset
                setTransferProgress((totalReceived / totalSize) * 100)
                setTransferInfo(prev => {
                    if (!prev) return null
                    return { ...prev, received: Math.max(prev.received, totalReceived) }
                })

                const fileHandle = await subDir.getFileHandle(fileName, { create: true })
                const writable = await fileHandle.createWritable({ keepExistingData: true })

                // Local queue to serialize all operations for this file (writes and closing)
                let writeQueue = Promise.resolve()
                let isErrored = false

                return new Promise<void>((resolve, reject) => {
                    const wsUrl = getTransferWsUrl(settings.host, settings.transferPort)
                    const ws = new WebSocket(wsUrl)
                    ws.binaryType = "arraybuffer"
                    activeStreams.current.push(ws)

                    ws.onopen = () => {
                        ws.send(JSON.stringify({
                            file_rel_path: fileInfo.abs_rel_path,
                            offset: resumeOffset
                        }))
                    }

                    let completedSuccessfully = false

                    ws.onmessage = (event) => {
                        if (isErrored) return

                        if (typeof event.data === "string") {
                            const msg = JSON.parse(event.data)
                            if (msg.type === "COMPLETE") {
                                completedSuccessfully = true
                                writeQueue = writeQueue.then(async () => {
                                    try {
                                        await writable.close()
                                        ws.close()
                                    } catch (err) {
                                        console.error(`[Sync] Close error for ${fileInfo.rel_path}:`, err)
                                    }
                                })
                            } else if (msg.type === "ERROR") {
                                isErrored = true
                                completedSuccessfully = false
                                ws.close()
                                reject(msg.message)
                            }
                        } else {
                            const chunk = event.data as ArrayBuffer
                            // Chain the write to the promise queue to ensure sequential processing
                            writeQueue = writeQueue.then(async () => {
                                if (isErrored || !isTransferringRef.current || currentSessionId !== syncSessionIdRef.current) return
                                try {
                                    await writable.write({ type: 'write', data: chunk, position: resumeOffset })
                                    resumeOffset += chunk.byteLength
                                    totalReceived += chunk.byteLength
                                    setTransferProgress((totalReceived / totalSize) * 100)
                                    setTransferInfo(prev => {
                                        if (!prev) return null
                                        return { ...prev, received: Math.max(prev.received, totalReceived) }
                                    })
                                } catch (err) {
                                    console.error(`[Sync] Write error for ${fileInfo.rel_path}:`, err)
                                    isErrored = true
                                    ws.close()
                                    reject(err)
                                }
                            })
                        }
                    }

                    ws.onclose = () => {
                        // Ensure all pending writes are finished before resolving/rejecting
                        writeQueue.then(() => {
                            activeStreams.current = activeStreams.current.filter(s => s !== ws)
                            if (completedSuccessfully) {
                                completedFilesCount++
                                setTransferInfo(prev => {
                                    if (!prev) return null
                                    return { ...prev, completedFiles: Math.max(prev.completedFiles || 0, completedFilesCount) }
                                })
                                resolve()
                            } else if (!isErrored) {
                                // If naturally closed but not success, it's an interruption
                                reject("INTERRUPTED")
                            }
                        })
                    }
                    ws.onerror = (e) => {
                        isErrored = true
                        reject(`WebSocket Error for ${fileInfo.rel_path}`)
                    }
                })
            }

            const startTime = Date.now()
            const worker = async (workerId: number) => {
                while (isTransferringRef.current && currentSessionId === syncSessionIdRef.current) {
                    if (queue.length === 0) break

                    // Handle Pause
                    if (isPausedRef.current) {
                        await new Promise(r => setTimeout(r, 500))
                        continue
                    }

                    const file = queue.shift()
                    if (!file) break

                    try {
                        await downloadFileWorker(file)
                    } catch (err) {
                        // Defensive check: only proceed if we are still in the same session
                        if (currentSessionId !== syncSessionIdRef.current) break

                        if (err === "INTERRUPTED") {
                            console.log(`[Sync] Worker ${workerId}: Re-queuing interrupted file: ${file.rel_path}`)
                            queue.unshift(file) // Put it back at the front
                        } else {
                            console.error(`[Sync] Worker ${workerId}: Error downloading ${file?.rel_path || 'unknown'}:`, err)
                        }
                    }
                }
            }

            // Start parallel workers
            console.log(`[Sync] Launching ${MAX_WORKERS} workers...`)
            await Promise.all(Array(MAX_WORKERS).fill(0).map((_, i) => worker(i)))

            if (isTransferringRef.current && !isPausedRef.current) {
                setTransferStatus("COMPLETE")
                setFinalDuration((Date.now() - startTime) / 1000)
                isTransferringRef.current = false
                setIsTransferring(false)
            }

        } catch (err) {
            console.error("[Sync] Critical Error:", err)
            setError(`Errore durante la sincronizzazione: ${err instanceof Error ? err.message : String(err)}`)
            setTransferStatus("ERROR")
            isTransferringRef.current = false
            setIsTransferring(false)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePauseToggle = () => {
        if (isPausedRef.current && !isTransferringRef.current) {
            // Re-trigger sync if we were at a standstill (e.g. after reload)
            if (transferInfo) {
                syncFolder({
                    name: transferInfo.filename,
                    rel_path: transferInfo.rel_path,
                    is_dir: true,
                    size: 0
                }, { isQuickSync: true }) // Default to quickSync behavior for re-trigger
            }
            return
        }

        isPausedRef.current = !isPausedRef.current
        setIsPaused(isPausedRef.current)
        console.log(`[Sync] Transfer ${isPausedRef.current ? 'Paused' : 'Resumed'}`)

        if (isPausedRef.current) {
            // Force-close all active streams to stop them immediately
            console.log(`[Sync] Pausing: closing ${activeStreams.current.length} active streams`)
            activeStreams.current.forEach(ws => ws.close())
        }
    }

    const cancelTransfer = async () => {
        isTransferringRef.current = false
        setIsTransferring(false)
        setIsPaused(false)
        setTransferStatus("IDLE")

        if (wsRef.current) { // For legacy single file transfer
            wsRef.current.close()
            wsRef.current = null
        }
        activeStreams.current.forEach(ws => ws.close()) // Close all active sync streams
        activeStreams.current = []

        setTransferInfo(null)
        setTransferProgress(0)
        lastReceivedOffset.current = 0
    }

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}m ${s}s`
    }

    const breadcrumbs = currentPath.split(/[\\/]/).filter(Boolean)

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "--"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden flex flex-col h-[80vh]">
                <DialogHeader className="p-4 border-b border-border bg-muted/20 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-sm font-mono font-bold flex items-center gap-2">
                                <HardDriveDownload className="h-4 w-4 text-primary" />
                                REMOTE FILE BROWSER
                            </DialogTitle>
                            <DialogDescription className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mt-1">
                                Browse and download images from NINA Transfer Service
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Navigation / Breadcrumbs */}
                <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/5 border-b border-border text-[10px] font-mono whitespace-nowrap overflow-x-auto scrollbar-none">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => loadDirectory("")}
                    >
                        <Home className="h-3.5 w-3.5" />
                    </Button>

                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />

                    <div className="flex items-center gap-1">
                        {breadcrumbs.length > 0 ? (
                            <>
                                {breadcrumbs.map((part, i) => (
                                    <React.Fragment key={i}>
                                        <button
                                            className="hover:text-primary transition-colors hover:underline"
                                            onClick={() => loadDirectory(breadcrumbs.slice(0, i + 1).join("/"))}
                                        >
                                            {part}
                                        </button>
                                        {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                                    </React.Fragment>
                                ))}
                            </>
                        ) : (
                            <span className="text-muted-foreground/60 italic">Root Directory</span>
                        )}
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-0.5">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-50">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="text-xs font-mono uppercase tracking-[0.2em] animate-pulse text-primary">Scanning Remote Storage...</span>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="p-3 bg-destructive/10 rounded-full border border-destructive/20">
                                    <X className="h-6 w-6 text-destructive" />
                                </div>
                                <span className="text-xs font-mono text-destructive text-center max-w-[250px]">{error}</span>
                                <Button variant="outline" size="sm" onClick={() => loadDirectory(currentPath)} className="mt-2 h-7 text-[10px] font-mono">
                                    RETRY
                                </Button>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-2 opacity-30">
                                <Folder className="h-10 w-10" />
                                <span className="text-xs font-mono">This folder is empty</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-px">
                                {currentPath !== "" && (
                                    <button
                                        onClick={handleBackClick}
                                        className="flex items-center gap-3 p-2 hover:bg-muted/10 transition-colors group border-b border-border/50 text-left"
                                    >
                                        <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <span className="text-[11px] font-mono font-bold text-muted-foreground uppercase">.. Parent Directory</span>
                                    </button>
                                )}

                                {items.map((item) => (
                                    <div
                                        key={item.rel_path}
                                        className="flex items-center justify-between p-2 hover:bg-primary/5 transition-colors group border-b border-border/30 last:border-b-0"
                                    >
                                        <div
                                            className="flex items-center gap-3 cursor-pointer flex-1"
                                            onClick={() => item.is_dir ? handleFolderClick(item.rel_path) : downloadFile(item)}
                                        >
                                            {item.is_dir ? (
                                                <Folder className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                                            ) : (
                                                <File className="h-4 w-4 text-primary/60" />
                                            )}

                                            <div className="flex flex-col">
                                                <span className={cn(
                                                    "text-[11px] font-mono truncate max-w-[350px]",
                                                    item.is_dir ? "font-bold text-foreground/90" : "text-foreground/70"
                                                )}>
                                                    {item.name}
                                                </span>
                                                {!item.is_dir && (
                                                    <span className="text-[8px] text-muted-foreground/60 font-mono tracking-tighter">
                                                        {formatSize(item.size)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {item.is_dir ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary"
                                                    onClick={() => syncFolder(item, { isQuickSync: false })}
                                                    disabled={isTransferring}
                                                >
                                                    <HardDriveDownload className="h-4 w-4" />
                                                    Sync Folder
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-primary hover:bg-primary/10"
                                                    onClick={() => downloadFile(item)}
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Quick Sync / Bottom Bar */}
                {transferStatus === "IDLE" && !isLoading && lastSyncInfo && directoryHandleRef.current && (
                    <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Quick Sync Active</span>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono lowercase overflow-hidden whitespace-nowrap">
                                <span className="text-amber-500/80 truncate dir-ltr" title={lastSyncInfo.rel_path}>{lastSyncInfo.rel_path}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                <span className="text-primary/70 truncate" title={directoryHandleRef.current.name}>{directoryHandleRef.current.name}</span>
                            </div>
                        </div>

                        {quickSyncStatus?.status === 'checking' ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded border border-border/50">
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                <span className="text-[10px] font-mono text-muted-foreground uppercase">Checking...</span>
                            </div>
                        ) : quickSyncStatus?.status === 'synchronized' ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded border border-green-500/20">
                                <Check className="h-3 w-3 text-green-500" />
                                <span className="text-[10px] font-mono text-green-500 uppercase font-bold">Synchronized</span>
                            </div>
                        ) : quickSyncStatus?.status === 'ready' ? (
                            <Button
                                size="sm"
                                onClick={() => syncFolder({ ...lastSyncInfo, is_dir: true, size: 0 } as any, { isQuickSync: true })}
                                className="h-8 text-[10px] font-bold font-mono px-4"
                            >
                                <RefreshCw className="h-3 w-3 mr-2" />
                                SYNC NOW ({quickSyncStatus.newFiles} NEW)
                            </Button>
                        ) : quickSyncStatus?.status === 'needs_permission' ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGrantPermission}
                                className="h-8 text-[10px] font-bold font-mono px-4 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                            >
                                <LockOpen className="h-3 w-3 mr-2" />
                                GRANT ACCESS
                            </Button>
                        ) : null}
                    </div>
                )}

                <div className="p-3 border-t border-border bg-muted/10 flex flex-col gap-3 flex-shrink-0">
                    {(isTransferring || isPaused || transferStatus === "COMPLETE") && transferInfo && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[9px] font-bold",
                                        isPaused ? "bg-amber-500/10 text-amber-500" :
                                            transferStatus === "COMPLETE" ? "bg-emerald-500/10 text-emerald-500" :
                                                "bg-primary/10 text-primary animate-pulse"
                                    )}>
                                        {isPaused ? "PAUSED" :
                                            transferStatus === "ZIPPING" ? "ZIPPING" : // ZIPPING is for old transferFolder, might not be used now
                                                transferStatus === "COMPLETE" ? "COMPLETED" : "TRANSFERRING"}
                                    </span>
                                    <span className="text-foreground/70 truncate max-w-[150px]">{transferInfo.filename}</span>

                                    {(transferStatus === "TRANSFERRING" || isPaused) && transferInfo.fileCount && (
                                        <span className="text-muted-foreground ml-1 text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded">
                                            {transferInfo.completedFiles}/{transferInfo.fileCount} FILES
                                        </span>
                                    )}

                                    {transferStatus === "ZIPPING" && (
                                        <span className="text-muted-foreground ml-1">
                                            ({zippingProgress.processed}/{zippingProgress.total} items)
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-muted-foreground">
                                        {transferStatus === "COMPLETE" ? (
                                            `Total: ${formatSize(transferInfo.received)}`
                                        ) : (
                                            `${formatSize(transferInfo.received)} / ${formatSize(transferInfo.total)}`
                                        )}
                                    </span>
                                    <span className="font-bold text-primary">
                                        {transferStatus === "COMPLETE" ? (
                                            <span className="text-emerald-500">DONE</span>
                                        ) : (
                                            `${Math.round(transferProgress)}%`
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Progress value={Math.min(transferProgress, 100)} className="h-2 flex-1 bg-primary/5" />
                                <div className="flex items-center gap-1">
                                    {transferStatus !== "COMPLETE" && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7 border-border hover:bg-muted/20"
                                                onClick={handlePauseToggle}
                                            >
                                                {isPaused ? <Play className="h-3.5 w-3.5 fill-primary text-primary" /> : <Pause className="h-3.5 w-3.5" />}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7 border-border hover:bg-destructive/10 hover:text-destructive"
                                                onClick={cancelTransfer}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/60 border-t border-border/5 pt-1.5 mt-0.5">
                                <div className="flex items-center gap-2">
                                    <span>ELAPSED: {formatTime(elapsedTime)}</span>
                                    {transferStatus === "COMPLETE" && finalDuration !== null && (
                                        <span className="text-emerald-500 font-bold ml-2">
                                            COMPLETED IN {formatTime(Math.round(finalDuration))}
                                        </span>
                                    )}
                                </div>
                                {!isPaused && transferStatus !== "COMPLETE" && (
                                    <span className="animate-pulse">Active Session</span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isConnected ? "bg-emerald-500" : "bg-destructive"
                            )} />
                            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                                Bridge Connection: {settings.host}:{settings.transferPort}
                            </span>
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground/40 italic">
                            {items.length} items in current path
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
