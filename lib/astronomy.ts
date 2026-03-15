/**
 * Utility per calcoli astronomici di base per la NINA Dashboard
 */

export interface Star {
    name: string
    ra: number // ore decimali
    dec: number // gradi decimali
}

// Database di 15 stelle luminose (Invernali ed Estive)
export const FAMOUS_STARS: Star[] = [
    { name: "SIRIUS", ra: 6.752, dec: -16.716 },
    { name: "VEGA", ra: 18.615, dec: 38.783 },
    { name: "ARCTURUS", ra: 14.261, dec: 19.182 },
    { name: "RIGEL", ra: 5.242, dec: -8.201 },
    { name: "BETELGEUSE", ra: 5.919, dec: 7.407 },
    { name: "CAPELLA", ra: 5.278, dec: 45.997 },
    { name: "ALTAIR", ra: 19.846, dec: 8.868 },
    { name: "ALDEBARAN", ra: 4.598, dec: 16.509 },
    { name: "ANTARES", ra: 16.490, dec: -26.432 },
    { name: "SPICA", ra: 13.419, dec: -11.161 },
    { name: "POLLUX", ra: 7.755, dec: 28.026 },
    { name: "DENEB", ra: 20.690, dec: 45.353 },
    { name: "PROCYON", ra: 7.655, dec: 5.224 },
    { name: "REGULUS", ra: 10.139, dec: 11.967 },
    { name: "FOMALHAUT", ra: 22.960, dec: -29.622 },
]

/**
 * Converte le coordinate RA/Dec in Alt/Az
 * @param ra Ore decimali
 * @param dec Gradi decimali
 * @param lat Gradi decimali (latitudine osservatore)
 * @param lst Ore decimali (tempo siderale locale)
 */
export function calculateAltAz(ra: number, dec: number, lat: number, lst: number) {
    const latRad = (lat * Math.PI) / 180
    const decRad = (dec * Math.PI) / 180

    // Hour Angle (HA) in ore, convertito in radianti
    let ha = lst - ra
    if (ha < 0) ha += 24
    if (ha > 24) ha -= 24
    const haRad = (ha * 15 * Math.PI) / 180

    // Calcolo Altitudine
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
    const altRad = Math.asin(sinAlt)
    const alt = (altRad * 180) / Math.PI

    // Calcolo Azimuth
    const cosAz = (Math.sin(decRad) - Math.sin(altRad) * Math.sin(latRad)) / (Math.cos(altRad) * Math.cos(latRad))
    let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)))
    let az = (azRad * 180) / Math.PI

    // Se sin(ha) > 0, l'oggetto è a Ovest (Az > 180)
    if (Math.sin(haRad) > 0) {
        az = 360 - az
    }

    return { alt, az }
}

/**
 * Genera una serie di punti Alt/Az per la traiettoria di un oggetto
 * Calcola la posizione per un intervallo di 12 ore centrato sull'LST attuale
 */
export function calculateTrajectory(ra: number, dec: number, lat: number, currentLst: number) {
    const points: { alt: number; az: number }[] = []

    // Calcoliamo punti per 24 ore (un intero giro) per coprire tutto l'arco visibile
    // Step di 15 minuti (0.25 ore)
    for (let i = -12; i <= 12; i += 0.25) {
        let lst = currentLst + i
        if (lst < 0) lst += 24
        if (lst >= 24) lst -= 24

        const pos = calculateAltAz(ra, dec, lat, lst)
        if (pos.alt >= 0) {
            points.push(pos)
        }
    }

    return points
}
