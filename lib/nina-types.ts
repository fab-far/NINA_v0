// ============================================
// N.I.N.A. Advanced API TypeScript Interfaces
// ============================================

// -- Generic API Response wrapper --
export interface NinaApiResponse<T> {
  Response: T
  StatusCode: number
  Error?: string
  Success: boolean
  Type: string
}

// -- Camera --
export type CameraState =
  | "Idle"
  | "Waiting"
  | "Exposing"
  | "Reading"
  | "Download"
  | "NoState"

export interface CameraInfo {
  Connected: boolean
  Name: string
  DisplayName: string
  CameraState: CameraState
  IsExposing: boolean
  ExposureTime: number
  ExposureEndTime: string
  Temperature: number
  TemperatureSetPoint: number
  CoolerOn: boolean
  CoolerPower: number
  Gain: number
  Offset: number
  BinX: number
  BinY: number
  Battery: number
  BitDepth: number
  ElectronsPerADU: number
  ExposureMin: number
  ExposureMax: number
  PixelSize: number
  SensorType: string
  CanSetTemperature: boolean
  HasShutter: boolean
  ReadoutMode: number
  ReadoutModeForNormalImages: number
  ReadoutModeForSnapImages: number
  ReadoutModes: string[]
  USBLimit: number
}

// -- Guider --
export interface GuideStep {
  RADistanceRaw: number
  DECDistanceRaw: number
  RADuration: number
  DECDuration: number
  RADistanceGuide?: number
  DECDistanceGuide?: number
  Timestamp?: string
}

export interface RMSValue {
  Pixel: number
  Arcseconds: number
}

export interface RMSError {
  RA: RMSValue
  Dec: RMSValue
  Total: RMSValue
  PeakRA?: RMSValue
  PeakDec?: RMSValue
}

export interface GuiderInfo {
  Connected: boolean
  Name: string
  DisplayName: string
  State: string
  PixelScale: number
  RMSError: RMSError
  LastGuideStep?: GuideStep
}

export interface GuiderGraphData {
  GuideSteps: GuideStep[]
}

// -- Mount --
export interface MountInfo {
  Connected: boolean
  Name: string
  DisplayName: string
  RightAscension: number
  RightAscensionString: string
  Declination: number
  DeclinationString: string
  Azimuth: number
  AzimuthString: string
  Altitude: number
  AltitudeString: string
  SideOfPier: string
  Slewing: boolean
  TrackingEnabled: boolean
  TrackingMode: string
  SiderealTime: number
  SiderealTimeString: string
  TimeToMeridianFlip: number
  TimeToMeridianFlipString: string
  HoursToMeridianString?: string
  SiteLatitude: number
  SiteLongitude: number
  SiteElevation: number
}

// -- Sequence --
export type SequenceItemStatus =
  | "Created"
  | "Running"
  | "Finished"
  | "Skipped"
  | "Failed"
  | "Disabled"

export interface SequenceItem {
  Name: string
  Status: SequenceItemStatus
  Category?: string
  Description?: string
  Items?: SequenceItem[]
  Conditions?: SequenceItem[]
  Triggers?: SequenceItem[]
  Attempts?: number
  Progress?: {
    Current: number
    Total: number
  }
  // Extra fields from JSON
  Text?: string
  ExposureTime?: number
  ExposureCount?: number
  Gain?: number
  Offset?: number
  Type?: string
  Binning?: {
    Name: string
    X: number
    Y: number
  }
  Coordinates?: any
  TargetName?: string
  RemainingTime?: string
  TargetTime?: string
  TrackingMode?: string
  ForceCalibration?: boolean
  GlobalTriggers?: any[]
  [key: string]: any
}

export type SequenceState = SequenceItem[]

// -- Image History --
export interface ImageHistoryItem {
  Id: number
  ExposureTime: number
  Filter: string
  Temperature: number
  Stars: number
  HFR: number
  HFRStDev: number
  Mean: number
  Median: number
  StDev: number
  Min: number
  Max: number
  TargetName: string
  Gain: number
  Offset: number
  Date: string
  RmsText: string
  IsBayered: boolean
  Filename: string
  ImageType?: string
  Frame?: number
  ADUStDev?: number
  ADUMean?: number
  ADUMedian?: number
  ADUMin?: number
  ADUMax?: number
  DetectedStars?: number
  Rms?: number
  FocuserPosition?: number
  FocuserTemperature?: number
  RotatorPosition?: number
  PierSide?: string
  GuidingRMSArcSec?: number
  GuidingRMSRAArcSec?: number
  GuidingRMSDECArcSec?: number
}

// -- API Log Entry --
export interface ApiLogEntry {
  id: number
  timestamp: Date
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  status: number | null
  statusText: string
  durationMs: number
  ok: boolean
  errorMessage?: string
}

// -- Connection Settings --
export interface NinaConnectionSettings {
  host: string
  port: number
  pollingInterval: number
  imagePollingInterval: number
  guideGraphPoints: number
  guideUnit: "px" | "arcsec"
  // Transfer Parameters
  enableTransfer: boolean
  transferPort: number
  showBatteryPanel: boolean
  // Image Load Parameters
  imageResize: boolean
  imageWidth: number
  imageHeight: number
  imageQuality: number
  imageDebayer: boolean
  imageAutoprepared: boolean
  showApiLog: boolean
}

export const DEFAULT_SETTINGS: NinaConnectionSettings = {
  host: "localhost",
  port: 1888,
  pollingInterval: 2000,
  imagePollingInterval: 5000,
  guideGraphPoints: 100,
  guideUnit: "arcsec",
  enableTransfer: true,
  transferPort: 8181,
  showBatteryPanel: true,
  imageResize: false,
  imageWidth: 640,
  imageHeight: 480,
  imageQuality: 80,
  imageDebayer: true,
  imageAutoprepared: true,
  showApiLog: true,
}

// -- LiveStack --

export interface LiveStackStatusResponse {
  Response: "Running" | "Stopped" | string
  Error: string
  StatusCode: number
  Success: boolean
  Type: string
}

export interface LiveStackAvailableTarget {
  Filter: string
  Target: string
}

export interface LiveStackAvailableResponse {
  Response: LiveStackAvailableTarget[]
  Error: string
  StatusCode: number
  Success: boolean
  Type: string
}

export interface LiveStackInfo {
  IsMonochrome: boolean
  RedStackCount: number
  GreenStackCount: number
  BlueStackCount: number
  Filter: string
  Target: string
}

export interface LiveStackInfoResponse {
  Response: LiveStackInfo
  Error: string
  StatusCode: number
  Success: boolean
  Type: string
}
