export interface StarStats {
    x: number;
    y: number;
    brightness: number;
    eccentricity: number;
    fwhm?: number;
}

export interface ImageAnalysisResult {
    globalAverage: number;
    starCount: number;
    regions: {
        center: number;
        topLeft: number;
        topRight: number;
        bottomLeft: number;
        bottomRight: number;
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

/**
 * Analyzes an astronomical image for star eccentricity.
 * Uses image moments to calculate the shape of the brightest detected stars.
 */
export async function analyzeImageStars(blobUrl: string): Promise<ImageAnalysisResult | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                resolve(null);
                return;
            }

            // We don't need full resolution for a good statistical estimate,
            // but higher resolution helps with accuracy. Let's use a max dimension of 2048 for high-res monitors.
            const maxDim = 2048;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
                const ratio = Math.min(maxDim / width, maxDim / height);
                width *= ratio;
                height *= ratio;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // 1. Find local maxima (crude star detection)
            // Convert to grayscale first for easier processing
            const gray = new Uint8Array(width * height);
            for (let i = 0; i < data.length; i += 4) {
                // Luminance formula
                gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            }

            const stars: StarStats[] = [];
            const threshold = 60; // Lowered significantly to catch faint aberration tails
            const boxSize = 21;    // Increased to 21x21 to capture wide "C" or "Donut" shapes

            // Simple grid search for candidates to avoid overlapping and for speed
            const step = 20;
            for (let y = step; y < height - step; y += step) {
                for (let x = step; x < width - step; x += step) {
                    const idx = y * width + x;
                    const val = gray[idx];

                    if (val > threshold) {
                        // Refine peak: find local 7x7 max
                        let peakX = x;
                        let peakY = y;
                        let maxVal = val;

                        for (let dy = -3; dy <= 3; dy++) {
                            for (let dx = -3; dx <= 3; dx++) {
                                const v = gray[(y + dy) * width + (x + dx)];
                                if (v > maxVal) {
                                    maxVal = v;
                                    peakX = x + dx;
                                    peakY = y + dy;
                                }
                            }
                        }

                        // Check if already found a star nearby
                        const alreadyFound = stars.some(s => Math.abs(s.x - peakX) < step && Math.abs(s.y - peakY) < step);
                        if (!alreadyFound) {
                            const ecc = calculateEccentricity(gray, peakX, peakY, width, boxSize);
                            if (ecc !== null && ecc >= 0 && ecc < 1) {
                                stars.push({ x: peakX, y: peakY, brightness: maxVal, eccentricity: ecc });
                            }
                        }
                    }
                }
            }

            if (stars.length === 0) {
                console.warn("[StarAnalysis] No stars detected above threshold:", threshold);
                resolve(null);
                return;
            }
            console.log(`[StarAnalysis] Detected ${stars.length} stars for analysis (Threshold: ${threshold}, Box: ${boxSize})`);

            // 2. Average results and group by regions
            const result: ImageAnalysisResult = {
                globalAverage: stars.reduce((sum, s) => sum + s.eccentricity, 0) / stars.length,
                starCount: stars.length,
                regions: {
                    center: getRegionAverage(stars, width * 0.33, height * 0.33, width * 0.66, height * 0.66),
                    topLeft: getRegionAverage(stars, 0, 0, width * 0.33, height * 0.33),
                    topRight: getRegionAverage(stars, width * 0.66, 0, width, height * 0.33),
                    bottomLeft: getRegionAverage(stars, 0, height * 0.66, width * 0.33, height),
                    bottomRight: getRegionAverage(stars, width * 0.66, height * 0.66, width, height),
                    left: getRegionAverage(stars, 0, height * 0.33, width * 0.33, height * 0.66),
                    right: getRegionAverage(stars, width * 0.66, height * 0.33, width, height * 0.66),
                    top: getRegionAverage(stars, width * 0.33, 0, width * 0.66, height * 0.33),
                    bottom: getRegionAverage(stars, width * 0.33, height * 0.66, width * 0.66, height),
                }
            };

            resolve(result);
        };
        img.onerror = () => resolve(null);
        img.src = blobUrl;
    });
}

function calculateEccentricity(gray: Uint8Array, cx: number, cy: number, width: number, size: number): number | null {
    const r = Math.floor(size / 2);

    // 1. Find local background (minimum in the box)
    let minVal = 255;
    let peakVal = 0;
    for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
            const v = gray[y * width + x];
            if (v < minVal) minVal = v;
            if (v > peakVal) peakVal = v;
        }
    }

    const signalThreshold = minVal + (peakVal - minVal) * 0.05; // 5% above background (lowered for complex tails)

    let m00 = 0, m10 = 0, m01 = 0;

    // First pass: center of mass using background-subtracted values
    for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
            const rawVal = gray[y * width + x];
            if (rawVal <= signalThreshold) continue;

            const val = rawVal - minVal;
            m00 += val;
            m10 += val * x;
            m01 += val * y;
        }
    }

    if (m00 === 0) return null;
    const x0 = m10 / m00;
    const y0 = m01 / m00;

    // Second pass: central moments mu20, mu02, mu11
    let mu20 = 0, mu02 = 0, mu11 = 0;
    for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
            const rawVal = gray[y * width + x];
            if (rawVal <= signalThreshold) continue;

            const val = rawVal - minVal;
            mu20 += val * Math.pow(x - x0, 2);
            mu02 += val * Math.pow(y - y0, 2);
            mu11 += val * (x - x0) * (y - y0);
        }
    }

    // Covariance matrix eigenvalues
    // Normalized moments
    const u20 = mu20 / m00;
    const u02 = mu02 / m00;
    const u11 = mu11 / m00;

    const common = Math.sqrt(Math.pow(u20 - u02, 2) + 4 * Math.pow(u11, 2));
    const lambda1 = (u20 + u02 + common) / 2;
    const lambda2 = (u20 + u02 - common) / 2;

    if (lambda1 <= 0 || lambda2 < 0 || lambda2 > lambda1) return null;

    // Eccentricity = sqrt(1 - lambda2 / lambda1)
    return Math.sqrt(1 - lambda2 / lambda1);
}

function getRegionAverage(stars: StarStats[], x1: number, y1: number, x2: number, y2: number): number {
    const regionStars = stars.filter(s => s.x >= x1 && s.x < x2 && s.y >= y1 && s.y < y2);
    if (regionStars.length === 0) return 0;
    return regionStars.reduce((sum, s) => sum + s.eccentricity, 0) / regionStars.length;
}
