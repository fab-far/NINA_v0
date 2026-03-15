/**
 * Utility for generating sounds using the Web Audio API.
 * This avoids the need for external audio files and works reliably in modern browsers.
 */
class SoundGenerator {
    private audioCtx: AudioContext | null = null;
    private alarmOscillator: OscillatorNode | null = null;
    private alarmGain: GainNode | null = null;
    private isAlarmRunning = false;

    private initContext() {
        console.log(`[AUDIO] initContext called. State: ${this.audioCtx?.state || 'null'}`);
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    /**
     * Play a short "beep" sound (used for end of exposure)
     */
    public async beep(frequency = 880, duration = 0.1) {
        console.log(`[AUDIO] beep() method entered (freq=${frequency}, dur=${duration})`);

        // Log explicitly that the physical sound is disabled to avoid confusion
        console.log(`[AUDIO] beep() fisico disabilitato (manteniamo solo log per ora).`);
    }

    /**
     * Start a continuous alarm sound (used for critical states)
     */
    public startAlarm() {
        console.log(`[AUDIO] startAlarm() method entered (Aesthetic version)`);
        if (this.isAlarmRunning) return;

        try {
            const ctx = this.initContext();
            this.alarmOscillator = ctx.createOscillator();
            this.alarmGain = ctx.createGain();

            // Usiamo un'onda sinusoidale (sine) invece che quadra (square) per un suono molto più morbido
            this.alarmOscillator.type = "sine";
            this.alarmOscillator.frequency.setValueAtTime(440, ctx.currentTime);

            // Iniziamo con volume a zero per evitare clic
            this.alarmGain.gain.setValueAtTime(0, ctx.currentTime);

            // Effetto "Heartbeat" / Pulsante: moduliamo il gain nel tempo
            // Invece di un tono fisso, creiamo un'onda di volume
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.type = "sine";
            lfo.frequency.value = 1.2; // 1.2 impulsi al secondo
            lfoGain.gain.value = 0.04; // Intensità della pulsazione

            // Colleghiamo l'LFO al parametro gain per farlo pulsare
            lfo.connect(lfoGain);
            lfoGain.connect(this.alarmGain.gain);

            // Impostiamo un guadagno base (offset)
            this.alarmGain.gain.setValueAtTime(0.06, ctx.currentTime);

            this.alarmOscillator.connect(this.alarmGain);
            this.alarmGain.connect(ctx.destination);

            this.alarmOscillator.start();
            lfo.start();

            // Memorizziamo lfo per fermarlo dopo
            (this as any).lfo = lfo;

            this.isAlarmRunning = true;
            console.log(`[AUDIO] Aesthetic Alarm started successfully (Sine wave @ 440Hz + 1.2Hz LFO).`);
        } catch (e) {
            console.warn('Failed to start alarm sound:', e);
        }
    }

    /**
     * Stop the continuous alarm sound
     */
    public stopAlarm() {
        console.log(`[AUDIO] stopAlarm() method entered`);
        if (!this.isAlarmRunning) return;

        try {
            if (this.alarmOscillator) {
                this.alarmOscillator.stop();
                this.alarmOscillator.disconnect();
                this.alarmOscillator = null;
            }
            if ((this as any).lfo) {
                (this as any).lfo.stop();
                (this as any).lfo.disconnect();
                (this as any).lfo = null;
            }
            if (this.alarmGain) {
                this.alarmGain.disconnect();
                this.alarmGain = null;
            }
            this.isAlarmRunning = false;
            console.log(`[AUDIO] Alarm stopped successfully.`);
        } catch (e) {
            console.warn('Failed to stop alarm sound:', e);
            this.isAlarmRunning = false;
        }
    }

    /**
     * Legge ad alta voce un messaggio usando Web Speech API (it-IT).
     */
    private lastSpokenSource: string | null = null;

    public speakMessage(text: string, source: string, lang = 'it-IT') {
        console.log(`[AUDIO] speakMessage called: "${text}" [Source: ${source}]`);
        if (typeof window === 'undefined' || !window.speechSynthesis) {
            console.warn(`[TTS] Web Speech API not available.`);
            return;
        }

        if (source !== "IMAGE_DONE" && this.lastSpokenSource === source) {
            console.log(`[TTS] Salto ripetizione per sorgente: ${source}`);
            return;
        }

        this.lastSpokenSource = source;

        try {
            this.initContext();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            utterance.onstart = () => {
                const isHidden = typeof document !== 'undefined' && document.hidden;
                console.log(`[TTS] Inizio parlato: "${text}" (Source: ${source}, Hidden: ${isHidden})`);
            };

            utterance.onerror = (e) => {
                console.warn(`[TTS ERROR] Error (${source}):`, e);
            };

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn(`[TTS FAILED] (${source}):`, e);
            this.lastSpokenSource = null;
        }
    }

    public resetTtsSource(source: string) {
        if (this.lastSpokenSource === source) {
            this.lastSpokenSource = null;
        }
    }
}

export const soundManager = new SoundGenerator();
