/**
 * Astronomical utility functions for coordinate conversion and altitude calculation.
 */

/**
 * Calculates the Local Sidereal Time (LST) in hours.
 * @param date The date object to calculate LST for
 * @param longitude Longitude in degrees (East positive)
 * @returns LST in hours (0-24)
 */
export function getLST(date: Date, longitude: number): number {
    const jdNow = (date.getTime() / 86400000) + 2440587.5;
    const jd0 = 2451545.0; // J2000.0
    const d = jdNow - jd0;

    // GMST calculation (simplified)
    let gmst = 18.697374558 + 24.06570982441908 * d;
    gmst = gmst % 24;
    if (gmst < 0) gmst += 24;

    let lst = gmst + longitude / 15.0;
    lst = lst % 24;
    if (lst < 0) lst += 24;

    return lst;
}

/**
 * Converts Equatorial coordinates (RA, Dec) to Horizontal coordinates (Alt, Az).
 * @param ra Right Ascension in hours
 * @param dec Declination in degrees
 * @param lat Latitude in degrees
 * @param lst Local Sidereal Time in hours
 * @returns { alt: number, az: number } in degrees
 */
export function equatorialToHorizontal(
    ra: number,
    dec: number,
    lat: number,
    lst: number
): { alt: number; az: number } {
    const ha = (lst - ra) * 15.0 * (Math.PI / 180.0); // Hour Angle in radians
    const decRad = dec * (Math.PI / 180.0);
    const latRad = lat * (Math.PI / 180.0);

    // Altitude
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(ha);
    const altRad = Math.asin(sinAlt);
    const alt = altRad * (180.0 / Math.PI);

    // Azimuth
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(altRad));
    let azRad = Math.acos(cosAz);
    let az = azRad * (180.0 / Math.PI);

    if (Math.sin(ha) > 0) {
        az = 360.0 - az;
    }

    return { alt, az };
}

/**
 * Simplified Sun position calculation.
 * Returns RA (hours) and Dec (degrees) for a given date.
 */
export function getSunPosition(date: Date): { ra: number; dec: number } {
    const jd = (date.getTime() / 86400000) + 2440587.5;
    const d = jd - 2451545.0;

    const g = (357.529 + 0.98560028 * d) % 360 * (Math.PI / 180);
    const q = (280.459 + 0.98564736 * d) % 360;
    const l = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) % 360 * (Math.PI / 180);

    const e = (23.439 - 0.00000036 * d) * (Math.PI / 180);
    const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) * (180 / Math.PI) / 15;
    const dec = Math.asin(Math.sin(e) * Math.sin(l)) * (180 / Math.PI);

    return { ra: ra < 0 ? ra + 24 : ra, dec };
}

/**
 * Generates altitude graph data points for a specific window.
 * @param ra RA of target
 * @param dec Dec of target
 * @param lat Site latitude
 * @param long Site longitude
 * @param start Absolute Date to start
 * @param durationHours Duration in hours
 */
export function generateAltitudeData(
    ra: number,
    dec: number,
    lat: number,
    long: number,
    start: Date,
    durationHours: number = 24
) {
    const data = [];
    const now = new Date();

    const step = durationHours / 96; // 96 segments (15 min per segment for 24h)

    for (let h = 0; h <= durationHours; h += step) {
        const dateAtTime = new Date(start.getTime() + h * 3600000);
        const lstAtTime = getLST(dateAtTime, long);

        // Target position
        const { alt } = equatorialToHorizontal(ra, dec, lat, lstAtTime);

        // Sun position for twilight shading
        const sunPos = getSunPosition(dateAtTime);
        const { alt: sunAlt } = equatorialToHorizontal(sunPos.ra, sunPos.dec, lat, lstAtTime);

        // relHour relative to "start"
        data.push({
            relHour: h,
            timestamp: dateAtTime,
            label: dateAtTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            altitude: Math.max(0, alt),
            sunAltitude: sunAlt,
            isNow: Math.abs(dateAtTime.getTime() - now.getTime()) < (step * 3600000) / 2
        });
    }

    return data;
}
