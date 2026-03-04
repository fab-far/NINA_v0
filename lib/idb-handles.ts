/**
 * Simple IndexedDB wrapper to store and retrieve FileSystemFileHandles
 */
const DB_NAME = "nina_transfer_db"
const STORE_NAME = "handles"

function getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME)
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

export async function saveFileHandle(key: string, handle: FileSystemHandle) {
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(handle, key)
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
    })
}

export async function getFileHandle(key: string): Promise<FileSystemHandle | null> {
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, "readonly")
    const request = tx.objectStore(STORE_NAME).get(key)
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
    })
}

export async function removeFileHandle(key: string) {
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(key)
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
    })
}
