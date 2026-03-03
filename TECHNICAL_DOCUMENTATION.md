# NINA Monitor Technical Documentation

NINA Monitor is a high-performance web dashboard designed for real-time monitoring of astronomical imaging sessions managed by [N.I.N.A. (Nighttime Imaging 'N' Astronomy)](https://nighttime-imaging.eu/).

## Architecture Overview

The application is built using a modern React-based stack:
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **State Management**: React Context (`NinaContext`) for global settings and API logs.
- **Polling Engine**: Custom hook (`useNinaPolling`) using `AbortController` for efficient, non-blocking background updates.
- **Custom Analysis**: Modular TypeScript utilities for pixel-level image processing.

---

## API Integration

The app communicates with the **N.I.N.A. Advanced API (v2)**. All requests are handled via a centralized fetch wrapper in `lib/nina-api.ts`.

### Endpoints (v2/api)

| Feature | Endpoint | Purpose | JSON Source |
| :--- | :--- | :--- | :--- |
| **Camera** | `/equipment/camera/info` | Real-time sensor stats, temp, and state. | `CameraInfo` |
| **Guider** | `/equipment/guider/info` | Guiding status and pixel scale. | `GuiderInfo` |
| **Guider Graph** | `/equipment/guider/graph` | History of guide steps (RA/Dec pulses). | `GuiderGraphData` |
| **Mount** | `/equipment/mount/info` | Coordinates, tracking state, and Meridian flip timer. | `MountInfo` |
| **Sequence** | `/sequence/json` | Full hierarchical state of the Advanced Sequencer. | `SequenceState` |
| **History** | `/image-history?all=true` | Table of all captured frames in the current session. | `ImageHistoryItem[]` |
| **Images** | `/image/{id}` | Full resolution frame data (streamed). | Binary Blob |
| **Thumbnails**| `/image/thumbnail/{id}`| Fast-loading low-res preview. | Binary Blob |

### Data Models (`lib/nina-types.ts`)
The application defines strict TypeScript interfaces for all NINA responses, ensuring type safety during data transformation (e.g., converting HFR data for charts or calculating Meridian flip times).

---

## Key Functionalities

### 1. Real-Time Image Processing
The dashboard doesn't just display images; it analyzes them client-side:
- **Dynamic Debayering**: Automatically detects the `SensorType`. It toggles the `debayer` API parameter based on whether the camera is Color or Monochrome.
- **Blob Caching**: Fetches the full-resolution image once and creates a `blob:URL`, sharing it across multiple UI components (Main Panel, Fullscreen, Inspector) to minimize network traffic.
- **Client-Side Histogram**: Processes pixel data using an offscreen canvas to generate RGB/Grayscale histograms without server-side overhead.

### 2. Star Analysis Engine (`lib/star-analysis.ts`)
A custom-built utility for high-precision diagnostic analysis of "raw" frames:
- **Star Detection**: Uses a local-maxima search with background subtraction to identify stars in noisy backgrounds.
- **Eccentricity (ECC)**: Calculates star elongation using **Image Moments** ($\mu_{20}, \mu_{02}, \mu_{11}$). 
- **Aberration Inspector**: Divides the sensor into 9 sectors. It provides a 1:1 pixel view of the corners and center, mapping the average eccentricity to each sector to help identify sensor tilt or flattener issues.

### 3. Advanced Sequencer View
- **Hierarchical Visualization**: Renders the NINA sequence tree (Containers, Targets, Instructions).
- **Auto-Expansion**: The entire sequence structure is fully expanded by default for immediate visibility of the night's plan.
- **Live Status**: Color-coded badges and icons reflect the current execution state (Running, Finished, Skipped, etc.).

### 4. Guider Monitoring
- **Dual Units**: Allows toggling between Pixels and Arcseconds for all guiding data.
- **Header RMS**: Displays real-time RA, Dec, and Total RMS values prominently for quick health checks.
- **Smoothing & Windowing**: Supports configurable graph windows (50/100/400 points).

---

## File Structure

```
/
├── components/dashboard/     # Core UI Modules (ImagePanel, SequencePanel, etc.)
├── components/ui/            # Reusable UI Primitives (Cards, Buttons, Dialogs)
├── lib/
│   ├── nina-api.ts           # API Communication Layer
│   ├── nina-types.ts         # Type Definitions (Interfaces)
│   ├── star-analysis.ts      # Eccentricity & Star Analysis Logic
│   ├── nina-context.tsx      # Global State & API Polling Registry
│   └── use-nina-polling.ts   # Auto-refresh Hook
└── app/                      # Main application entry and router
```
