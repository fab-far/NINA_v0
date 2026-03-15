/**
 * alarm-engine.ts
 * Logica pura di analisi dello stato della sessione di ripresa.
 * Zero dipendenze React – completamente testabile in isolamento.
 */
import type {
    CameraInfo,
    GuiderInfo,
    ImageHistoryItem,
    NinaConnectionSettings,
    AlarmEntry,
    AlarmLevel,
    AlarmSource,
    SequenceState,
    BatteryResponse,
} from "./nina-types"

// Soglia fissa per escalation CRITICAL sull'RMS
const RMS_CRITICAL_MULTIPLIER = 1.5

export interface EngineInput {
    camera: CameraInfo | null
    guider: GuiderInfo | null
    imageHistory: ImageHistoryItem[] | null
    sequence: SequenceState | null
    battery: BatteryResponse | null
    settings: NinaConnectionSettings
    consecutiveHighRmsCount: number
}

export interface EngineOutput {
    /** Allarmi rilevati in questo ciclo (uno per source al massimo) */
    detectedSources: AlarmSource[]
    /** Entries complete (da passare a raiseAlarm) */
    alarms: Omit<AlarmEntry, "id" | "acked" | "resolved">[]
    /** Contatore aggiornato di letture RMS consecutive alte */
    newConsecutiveRmsCount: number
}

function alarm(
    source: AlarmSource,
    level: AlarmLevel,
    message: string
): Omit<AlarmEntry, "id" | "acked" | "resolved"> {
    return { source, level, message, timestamp: new Date() }
}

interface SequenceScanResult {
    isRunning: boolean
    guidingRequested: boolean
}

function scanSequence(items: SequenceState | null): SequenceScanResult {
    if (!items) return { isRunning: false, guidingRequested: false }

    let isRunning = false
    let guidingRequested = false

    for (const item of items) {
        const status = item.Status?.toUpperCase()
        if (status === "RUNNING") isRunning = true

        // Se l'istruzione "Start Guiding" è terminata, la guida è considerata richiesta
        if (item.Name === "Start Guiding" && status === "FINISHED") {
            guidingRequested = true
        }

        // Se c'è un'istruzione "Stop Guiding" terminata, azzeriamo la richiesta
        if (item.Name === "Stop Guiding" && status === "FINISHED") {
            guidingRequested = false
        }

        if (item.Items) {
            const sub = scanSequence(item.Items)
            if (sub.isRunning) isRunning = true
            // La richiesta di guida si propaga se non già resettata
            if (sub.guidingRequested) guidingRequested = true
        }
    }

    return { isRunning, guidingRequested }
}

/**
 * Valuta lo stato corrente e restituisce gli allarmi attivi per questo ciclo.
 * Se una source NON è presente in `detectedSources`, significa che la condizione
 * è rientrata e il chiamante deve invocare `resolveAlarm(source)`.
 */
export function analyzeState({
    camera,
    guider,
    imageHistory,
    sequence,
    battery,
    settings,
    consecutiveHighRmsCount,
}: EngineInput): EngineOutput {
    const detectedSources: AlarmSource[] = []
    const alarms: Omit<AlarmEntry, "id" | "acked" | "resolved">[] = []
    let newConsecutiveRmsCount = consecutiveHighRmsCount

    const isConnected = camera?.Connected === true
    const isExposing =
        camera?.IsExposing === true || camera?.CameraState === "Exposing"

    // Scansione unica della sequenza
    const seqInfo = scanSequence(sequence)
    const isRunning = seqInfo.isRunning
    const guidingRequested = seqInfo.guidingRequested

    // Solo se la camera è connessa controlliamo le condizioni critiche
    if (isConnected) {
        // ─── 1. PELTIER / COOLING OFF ─────────────────────────────────────────
        // Se la camera sta esponendo E la sequenza è in corso E il cooler è OFF.
        if (isExposing && isRunning && camera && camera.CoolerOn === false) {
            const level: AlarmLevel = camera.CanSetTemperature === false ? "WARNING" : "CRITICAL"

            detectedSources.push("COOLING_OFF")
            alarms.push(
                alarm(
                    "COOLING_OFF",
                    level,
                    level === "CRITICAL"
                        ? "Attenzione! Peltier OFF durante sequenza attiva."
                        : "Avviso: Peltier OFF durante sequenza (controllo temp non supportato)."
                )
            )
        }

        // ─── 2. GUIDER STATE ─────────────────────────────────────────────────
        if (guider?.Connected) {
            const state = (guider.State || "").toLowerCase()

            // Logica allarme Guida: 
            // 1. Stato esplicito di errore/lost
            // 2. [NUOVO] Se la sequenza ha richiesto la guida (Start Guiding FINISHED) ma lo stato non è Guiding/Settling/Pulse
            const isActuallyGuiding = state.includes("guiding") || state.includes("settling") || state.includes("dithering")

            const isLost =
                state.includes("lost") ||
                state.includes("lostlock") ||
                (guidingRequested && isRunning && !isActuallyGuiding)

            if (isLost) {
                detectedSources.push("GUIDING_LOST")
                alarms.push(
                    alarm(
                        "GUIDING_LOST",
                        "CRITICAL",
                        state.includes("lost")
                            ? "Guida persa! Verifica il guider immediatamente."
                            : "Guida non attiva! (Richiesta da sequenza ma guider fermo/idle)."
                    )
                )
            } else if (isExposing) {
                // ─── 3. GUIDER RMS ───────────────────────────────────────────────
                // Controlliamo l'RMS solo se stiamo esponendo
                const totalRms = guider.RMSError?.Total?.Arcseconds ?? 0
                const criticalThreshold = settings.guidingRmsThreshold * RMS_CRITICAL_MULTIPLIER

                if (totalRms > criticalThreshold) {
                    newConsecutiveRmsCount = consecutiveHighRmsCount + 1
                } else if (totalRms > settings.guidingRmsThreshold) {
                    // WARNING range: sopra soglia ma sotto CRITICAL
                    newConsecutiveRmsCount = 0
                    detectedSources.push("GUIDING_HIGH_RMS")
                    alarms.push(
                        alarm(
                            "GUIDING_HIGH_RMS",
                            "WARNING",
                            `RMS di guida elevato: ${totalRms.toFixed(2)}" (soglia: ${settings.guidingRmsThreshold}")`
                        )
                    )
                } else {
                    newConsecutiveRmsCount = 0
                }

                // Scala a CRITICAL dopo 3 letture consecutive sopra soglia critica
                if (newConsecutiveRmsCount >= 3) {
                    detectedSources.push("GUIDING_HIGH_RMS")
                    alarms.push(
                        alarm(
                            "GUIDING_HIGH_RMS",
                            "CRITICAL",
                            `RMS critico da ${newConsecutiveRmsCount} letture: ${totalRms.toFixed(2)}" (soglia critica: ${criticalThreshold.toFixed(2)}")`
                        )
                    )
                }
            }
        }

        // ─── 4. STAR DROP ────────────────────────────────────────────────────
        if (imageHistory && imageHistory.length >= 2) {
            // NINA history is ascending (newest is last)
            const latest = imageHistory[imageHistory.length - 1].Stars ?? 0
            const olderImages = imageHistory.slice(0, -1)
            const slice = olderImages.slice(-10) // up to 10 previous images
            const avg =
                slice.reduce((acc, img) => acc + (img.Stars ?? 0), 0) / slice.length

            if (avg > 2) {
                const dropPct = ((avg - latest) / avg) * 100
                const isDrasticDrop = dropPct > settings.starCountDropThreshold * 1.5
                const isAlmostZero = latest < 3 && dropPct > 70

                if (isDrasticDrop || isAlmostZero) {
                    detectedSources.push("STAR_DROP_CRITICAL")
                    alarms.push(
                        alarm(
                            "STAR_DROP_CRITICAL",
                            "CRITICAL",
                            isAlmostZero
                                ? `Perdita totale stelle! Solo ${latest} rilevate (media: ${avg.toFixed(0)})`
                                : `Calo drastico stelle: −${dropPct.toFixed(0)}% (media: ${avg.toFixed(0)}, ultima: ${latest})`
                        )
                    )
                } else if (dropPct > settings.starCountDropThreshold) {
                    detectedSources.push("STAR_DROP_WARNING")
                    alarms.push(
                        alarm(
                            "STAR_DROP_WARNING",
                            "WARNING",
                            `Calo stelle: −${dropPct.toFixed(0)}% (media: ${avg.toFixed(0)}, ultima: ${latest})`
                        )
                    )
                }
            }

            // Allarme specifico se il conteggio è < 3 (allerto l'utente anche senza calo % enorme)
            if (latest < 3 && !detectedSources.includes("STAR_DROP_CRITICAL")) {
                detectedSources.push("STAR_DROP_WARNING")
                alarms.push(
                    alarm(
                        "STAR_DROP_WARNING",
                        "WARNING",
                        `Conteggio stelle criticamente basso: ${latest} (media: ${avg.toFixed(0)})`
                    )
                )
            }
        }

    }

    // ─── 5. BATTERY MONITORING ──────────────────────────────────────────────
    if (battery && battery.status === "running") {
        const voltage = battery.battery_voltage
        const wh = battery.consumed_wh
        const consumedAh = wh / 13 // Formula usata in BatteryPanel
        const totalCapacityAh = 50 // Capacità nominale hardcoded in BatteryPanel
        const remainingAh = Math.max(0, totalCapacityAh - consumedAh)
        const batteryPercentage = (remainingAh / totalCapacityAh) * 100

        const isLowVoltage = voltage < settings.batteryVoltageThreshold
        const isCriticalVoltage = voltage < (settings.batteryVoltageThreshold - 0.3)
        const isLowBattery = batteryPercentage < 15

        if (isLowVoltage || isLowBattery) {
            detectedSources.push("BATTERY_LOW")
            const level: AlarmLevel = (isCriticalVoltage || isLowBattery) ? "CRITICAL" : "WARNING"
            const msg = isLowBattery
                ? `Batteria scarica! Residuo: ${batteryPercentage.toFixed(0)}% (${voltage.toFixed(2)}V)`
                : `${level === "CRITICAL" ? "Tensione CRITICA" : "Tensione bassa"} batteria: ${voltage.toFixed(2)}V (soglia: ${settings.batteryVoltageThreshold}V)`

            alarms.push(alarm("BATTERY_LOW", level, msg))
        }
    }

    return { detectedSources, alarms, newConsecutiveRmsCount }
}

/** Tutte le AlarmSource gestite dal motore, utili per il cleanup */
export const ALL_SOURCES: AlarmSource[] = [
    "COOLING_OFF",
    "GUIDING_LOST",
    "GUIDING_HIGH_RMS",
    "STAR_DROP_WARNING",
    "STAR_DROP_CRITICAL",
    "BATTERY_LOW",
]
