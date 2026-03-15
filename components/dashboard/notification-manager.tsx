"use client"

import { useCallback, useEffect, useRef } from "react"
import { useNina } from "@/lib/nina-context"
import { soundManager } from "@/lib/audio"
import { analyzeState, ALL_SOURCES } from "@/lib/alarm-engine"
import type { AlarmSource } from "@/lib/nina-types"

/**
 * NotificationManager (v2 – Alarm System)
 * Componente headless che:
 * 1. Fa polling di camera, guider, imageHistory
 * 2. Chiama analyzeState() ogni ciclo
 * 3. Chiama raiseAlarm / resolveAlarm sul contesto
 * 4. Gestisce audio (loop per CRITICAL) e TTS (singolo per WARNING)
 * 5. Beep su nuova immagine
 */
export function NotificationManager() {
    const {
        settings,
        addApiLog,
        raiseAlarm,
        resolveAlarm,
        activeAlarms,
        hasActiveCritical,
        camera,
        guider,
        imageHistory,
        sequence,
        battery,
    } = useNina()

    const prevImageIdsRef = useRef<Set<any>>(new Set())
    const consecutiveHighRmsRef = useRef(0)
    // Tenere traccia delle sources già in allarme per evitare TTS duplicati
    const spokenSourcesRef = useRef<Set<AlarmSource>>(new Set())


    // ─── BEEP su nuova immagine ───────────────────────────────────────────────
    useEffect(() => {
        if (!imageHistory) return

        // Usiamo Filename || Id perché i log mostrano collisioni/undefined su Id
        const newItems = imageHistory.filter(
            (img) => !prevImageIdsRef.current.has(img.Filename || img.Id)
        )

        if (imageHistory.length > 0) {
            const last = imageHistory[imageHistory.length - 1]
            console.log(`[NotificationManager] Poll History: Totale=${imageHistory.length}, Nuovi=${newItems.length}, PrevSize=${prevImageIdsRef.current.size}, LastImgId=${last.Id}, LastFile=${last.Filename?.split(/[\\/]/).pop()}`)
        }

        if (newItems.length > 0) {
            const lastImg = newItems[newItems.length - 1]

            // Prova a recuperare un numero di frame sensato (NINA Id o Frame # o Indice)
            let frameId: string | number = ""

            // Tenta prima l'indice nell'array attuale (è quello che usiamo nel pannello Immagine come "Frame #X")
            const index = imageHistory.findIndex(img => (img.Filename || img.Id) === (lastImg.Filename || lastImg.Id))

            if (index !== -1) {
                frameId = index
            } else if (typeof lastImg.Frame === 'number') {
                frameId = lastImg.Frame
            } else if (typeof lastImg.Id === 'number') {
                frameId = lastImg.Id
            }

            console.log(`[TTS] !!! TRIGGER TTS Foto #${frameId !== "" ? frameId : '?'}`)

            if (settings.enableAudioNotifications) {
                const message = frameId !== ""
                    ? `Foto numero ${frameId} terminata`
                    : `Nuova foto terminata`

                soundManager.speakMessage(message, "IMAGE_DONE")
            }
        }

        const newSet = new Set<any>()
        imageHistory.forEach((img) => newSet.add(img.Filename || img.Id))
        prevImageIdsRef.current = newSet
    }, [imageHistory])


    // ─── Motore allarmi ───────────────────────────────────────────────────────
    useEffect(() => {
        const result = analyzeState({
            camera,
            guider,
            imageHistory,
            sequence,
            battery,
            settings,
            consecutiveHighRmsCount: consecutiveHighRmsRef.current,
        })

        consecutiveHighRmsRef.current = result.newConsecutiveRmsCount

        // Tutte le sources rilevate in questo ciclo
        const detected = new Set<AlarmSource>(result.detectedSources)

        // 1. Risolvi le sources non più attive
        for (const src of ALL_SOURCES) {
            if (!detected.has(src)) {
                resolveAlarm(src)
                spokenSourcesRef.current.delete(src)
                soundManager.resetTtsSource(src)
            }
        }

        // 2. Alza i nuovi allarmi
        for (const entry of result.alarms) {
            raiseAlarm(entry)

            // TTS (solo se abilitati globalmente) - Il suono continuo è gestito separatamente via effect
            if (settings.enableAudioAlarms) {
                if (entry.level === "CRITICAL" || entry.level === "WARNING") {
                    // TTS per CRITICAL e WARNING (una volta sola per source)
                    if (!spokenSourcesRef.current.has(entry.source)) {
                        soundManager.speakMessage(entry.message, entry.source)
                        spokenSourcesRef.current.add(entry.source)
                    }
                }
            }
        }

        // NOTA: Lo start/stop dell'allarme sonoro continuo è gestito primariamente 
        // dall'useEffect sotto, ma chiamiamo startAlarm() anche qui per robustezza:
        // se il browser blocca l'audio all'avvio (autoplay policy), i cicli di polling 
        // successivi proveranno a riavviarlo non appena l'utente interagisce.
        if (settings.enableAudioAlarms && hasActiveCritical) {
            soundManager.startAlarm()
        }
    }, [camera, guider, imageHistory, sequence, battery, settings, raiseAlarm, resolveAlarm, hasActiveCritical])

    // --- CONTROLLO SONORO CENTRALIZZATO ---
    // Gestisce lo start/stop dell'allarme in base allo stato globale (acked/active)
    useEffect(() => {
        if (settings.enableAudioAlarms && hasActiveCritical) {
            soundManager.startAlarm()
        } else {
            soundManager.stopAlarm()
        }
    }, [hasActiveCritical, settings.enableAudioAlarms])

    // Cleanup al dismount
    useEffect(() => {
        return () => {
            soundManager.stopAlarm()
            if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel()
            }
        }
    }, [])

    // ─── Debug Hook ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (typeof window !== "undefined") {
            (window as any).__ninaAlarmDebug = {
                triggerCritical: (source: AlarmSource = "COOLING_OFF") => {
                    raiseAlarm({
                        source,
                        level: "CRITICAL",
                        message: "TEST ALLARME CRITICO: Esempio di messaggio di emergenza",
                        timestamp: new Date(),
                    })
                    soundManager.startAlarm()
                    soundManager.speakMessage("Allarme di test critico attivato", source)
                },
                triggerWarning: (source: AlarmSource = "GUIDING_HIGH_RMS") => {
                    const msg = "TEST WARNING: RMS elevato rilevato"
                    raiseAlarm({
                        source,
                        level: "WARNING",
                        message: msg,
                        timestamp: new Date(),
                    })
                    soundManager.speakMessage(msg, source)
                },
                resolveAll: () => {
                    ALL_SOURCES.forEach(src => resolveAlarm(src))
                    soundManager.stopAlarm()
                }
            }
        }
        return () => {
            if (typeof window !== "undefined") delete (window as any).__ninaAlarmDebug
        }
    }, [raiseAlarm, resolveAlarm])

    return null
}
