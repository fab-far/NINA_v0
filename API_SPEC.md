# NINATrasfer API Specification

Questa specifica descrive gli endpoint e la sequenza di comunicazione per lo sviluppo di una Single Page Application (SPA) dedicata al trasferimento remoto di file astronomici da N.I.N.A.

## 1. Directory Browsing
**Endpoint:** `GET /api/browse?path={rel_path}`

Permette di esplorare ricorsivamente le cartelle generate da N.I.N.A.

- **Request Query Params:**
  - `path`: (string) Percorso relativo alla `BASE_DIR`. Vuoto per la root.
- **Response Format (JSON):**
```json
{
  "current_rel_path": "Target/Date",
  "items": [
    {
      "name": "SubFolder",
      "is_dir": true,
      "rel_path": "Target/Date/SubFolder",
      "size": 0
    },
    {
      "name": "light_001.tif",
      "is_dir": false,
      "rel_path": "Target/Date/light_001.tif",
      "size": 52428800
    }
  ]
}
```

## 2. Direct File Download
**Endpoint:** `GET /api/download?path={rel_path}`

Download standard di un singolo file. Supporta HTTP Range (Resume) gestito dal browser.

- **Request Query Params:**
  - `path`: (string) Percorso relativo del file.
- **Response:**
  - Stream binario (`application/octet-stream`).

---

## 3. Folder Transfer (WebSocket)
**Endpoint:** `WS /ws/transfer`

Streaming di una intera cartella compressa in formato ZIP (Store mode) per minimizzare l'uso della CPU.

### Sequenza di Comunicazione:

| Step | Mittente | Messaggio (JSON / Binary) | Descrizione |
| :--- | :--- | :--- | :--- |
| **1. Init** | SPA | `{"folder_rel_path": "Target/Date"}` | La SPA invia il path della cartella. |
| **2. Ack** | Server | `{"type": "START", "filename": "Date.zip", "total_size": 12345, "file_count": 50}` | Il server conferma l'inizio e fornisce i metadati per la progress bar. |
| **3. Stream** | Server | `[Binary Data (Chunk)]` | Il server invia lo ZIP a pezzi (default 1MB). |
| **4. End** | Server | `{"type": "COMPLETE"}` | Segnala la fine del trasferimento. |

### Note per lo Sviluppatore SPA:
- **Gestione Binaria**: Su browser, gestire i messaggi binari concatenandoli in un `Blob` o usando le `Stream API`.
- **Progress**: Calcolare la percentuale basandosi sui byte binari ricevuti rispetto a `total_size`.
- **Errori**: Il server può inviare `{"type": "ERROR", "message": "..."}` in qualsiasi momento se il path non è valido o il file system non è accessibile.
