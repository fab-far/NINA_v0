"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useNina } from "@/lib/nina-context"

import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectionDialog({ open, onOpenChange }: ConnectionDialogProps) {
  const { settings, updateSettings } = useNina()
  const [host, setHost] = useState(settings.host)
  const [port, setPort] = useState(String(settings.port))
  const [pollingInterval, setPollingInterval] = useState(
    String(settings.pollingInterval / 1000)
  )
  const [guideGraphPoints, setGuideGraphPoints] = useState(
    String(settings.guideGraphPoints)
  )
  const [transferPort, setTransferPort] = useState(String(settings.transferPort))
  const [enableTransfer, setEnableTransfer] = useState(settings.enableTransfer)
  const [showBatteryPanel, setShowBatteryPanel] = useState(settings.showBatteryPanel)
  const [showApiLog, setShowApiLog] = useState(settings.showApiLog)
  const [enableAudioAlarms, setEnableAudioAlarms] = useState(settings.enableAudioAlarms)
  const [enableAudioNotifications, setEnableAudioNotifications] = useState(settings.enableAudioNotifications)
  const [batteryVoltageThreshold, setBatteryVoltageThreshold] = useState(String(settings.batteryVoltageThreshold))

  // Image Load Parameters State
  const [imageResize, setImageResize] = useState(settings.imageResize)
  const [imageWidth, setImageWidth] = useState(String(settings.imageWidth))
  const [imageHeight, setImageHeight] = useState(String(settings.imageHeight))
  const [imageQuality, setImageQuality] = useState(String(settings.imageQuality))
  const [imageDebayer, setImageDebayer] = useState(settings.imageDebayer)
  const [imageAutoprepared, setImageAutoprepared] = useState(settings.imageAutoprepared)

  // Alarm Thresholds State
  const [guidingRmsThreshold, setGuidingRmsThreshold] = useState(String(settings.guidingRmsThreshold))
  const [starCountDropThreshold, setStarCountDropThreshold] = useState(String(settings.starCountDropThreshold))

  useEffect(() => {
    if (open) {
      setHost(settings.host)
      setPort(String(settings.port))
      setPollingInterval(String(settings.pollingInterval / 1000))
      setGuideGraphPoints(String(settings.guideGraphPoints))
      setImageResize(settings.imageResize)
      setImageWidth(String(settings.imageWidth))
      setImageHeight(String(settings.imageHeight))
      setImageQuality(String(settings.imageQuality))
      setImageDebayer(settings.imageDebayer)
      setImageAutoprepared(settings.imageAutoprepared)
      setTransferPort(String(settings.transferPort))
      setEnableTransfer(settings.enableTransfer)
      setShowBatteryPanel(settings.showBatteryPanel)
      setShowApiLog(settings.showApiLog)
      setGuidingRmsThreshold(String(settings.guidingRmsThreshold))
      setStarCountDropThreshold(String(settings.starCountDropThreshold))
      setEnableAudioAlarms(settings.enableAudioAlarms)
      setEnableAudioNotifications(settings.enableAudioNotifications)
      setBatteryVoltageThreshold(String(settings.batteryVoltageThreshold))
    }
  }, [open, settings])

  function handleSave() {
    updateSettings({
      host: host.trim() || "localhost",
      port: Number.parseInt(port, 10) || 1888,
      pollingInterval: Math.max(1, Number.parseFloat(pollingInterval) || 2) * 1000,
      guideGraphPoints: Math.max(20, Number.parseInt(guideGraphPoints, 10) || 100),
      imageResize,
      imageWidth: Number.parseInt(imageWidth, 10) || 640,
      imageHeight: Number.parseInt(imageHeight, 10) || 480,
      imageQuality: Math.max(1, Math.min(100, Number.parseInt(imageQuality, 10) || 80)),
      imageDebayer,
      imageAutoprepared,
      enableTransfer,
      transferPort: Number.parseInt(transferPort, 10) || 8181,
      showBatteryPanel,
      showApiLog,
      guidingRmsThreshold: Number.parseFloat(guidingRmsThreshold) || 8.0,
      starCountDropThreshold: Number.parseInt(starCountDropThreshold, 10) || 50,
      enableAudioAlarms,
      enableAudioNotifications,
      batteryVoltageThreshold: Number.parseFloat(batteryVoltageThreshold) || 11.8,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-card text-card-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-foreground uppercase tracking-wider">Dashboard Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Configure connection and image processing parameters.
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-2">
            {/* Left Column: Connection & Transfer */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">NINA Connection</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="host" className="text-[10px] uppercase font-bold text-muted-foreground">Host</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="text-[10px] max-w-[200px]">
                          IP or Hostname of the NINA PC
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input id="host" value={host} onChange={(e) => setHost(e.target.value)} className="h-8 font-mono text-xs" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="port" className="text-[10px] uppercase font-bold text-muted-foreground">Port</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                          Active ADVANCED_API port <br />(Default 1888, Require Advanced_API N.I.N.A Plugin)
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input id="port" type="number" value={port} onChange={(e) => setPort(e.target.value)} className="h-8 font-mono text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="polling" className="text-[10px] uppercase font-bold text-muted-foreground">Polling (sec)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                          Refresh rate of the dashboard data (seconds)
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input id="polling" type="number" step="0.5" min="1" value={pollingInterval} onChange={(e) => setPollingInterval(e.target.value)} className="h-8 font-mono text-xs" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="guidePoints" className="text-[10px] uppercase font-bold text-muted-foreground">Guide Points</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                          Max PHD2 points to display in the guiding graph
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input id="guidePoints" type="number" min="20" max="1000" step="50" value={guideGraphPoints} onChange={(e) => setGuideGraphPoints(e.target.value)} className="h-8 font-mono text-xs" />
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Transfer & Telemetry</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium">Enable File Transfer</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                            Enable connection to NINATransfer service for remote file browsing.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Remote file management</p>
                    </div>
                    <Switch checked={enableTransfer} onCheckedChange={setEnableTransfer} />
                  </div>

                  {enableTransfer && (
                    <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200 bg-muted/20 p-2 rounded border border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="transferPort" className="text-[10px] uppercase font-bold text-muted-foreground">Bridge Port</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] max-w-[250px] border-amber-500/50">
                            Port for the file transfer service. <br /><span className="text-amber-500 font-bold">NOTE: Requires extra software (NINATransfer.py) on remote PC.</span>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input id="transferPort" type="number" value={transferPort} onChange={(e) => setTransferPort(e.target.value)} className="h-8 font-mono text-xs" />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium">Battery Panel</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                            Display battery monitoring panel. <br /><span className="text-primary font-bold">Requires Victron MPPT Controller.</span>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Victron MPPT monitoring</p>
                    </div>
                    <Switch checked={showBatteryPanel} onCheckedChange={setShowBatteryPanel} />
                  </div>
                </div>
              </div>

              <Separator className="bg-border/50" />

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">DEBUG & UI</h4>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Show API Log</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                          Enable the API logging console at the bottom of the dashboard for diagnostics.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Debugging console panel</p>
                  </div>
                  <Switch checked={showApiLog} onCheckedChange={setShowApiLog} />
                </div>
              </div>
            </div>

            {/* Right Column: Alarms & Image Parameters */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Alarms & Thresholds</h4>


                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="rmsThreshold" className="text-[10px] uppercase font-bold text-muted-foreground">Guiding RMS</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                          Trigger alarm if Guiding Total RMS (arcsec) exceeds this value during exposure.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input id="rmsThreshold" type="number" step="0.1" value={guidingRmsThreshold} onChange={(e) => setGuidingRmsThreshold(e.target.value)} className="h-8 font-mono text-xs" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="starThreshold" className="text-[10px] uppercase font-bold text-muted-foreground">Star Drop (%)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                          Trigger alarm if star count drops by more than this percentage vs average.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input id="starThreshold" type="number" min="1" max="100" value={starCountDropThreshold} onChange={(e) => setStarCountDropThreshold(e.target.value)} className="h-8 font-mono text-xs" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="batteryThreshold" className="text-[10px] uppercase font-bold text-muted-foreground">Battery Voltage (V)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                        If battery monitoring is active, trigger WARNING alarm if voltage drops below this threshold. CRITICAL if it drops further by 0.3V.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input id="batteryThreshold" type="number" step="0.1" value={batteryVoltageThreshold} onChange={(e) => setBatteryVoltageThreshold(e.target.value)} className="h-8 font-mono text-xs max-w-[120px]" />
                </div>
              </div>

              <Separator className="bg-border/50" />

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Sounds and TTS notifications</h4>

                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md border border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-medium">Enable Audio Alarms</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                        Enable voice alerts and continuous sound alarms. Visual monitoring remains always active.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch checked={enableAudioAlarms} onCheckedChange={setEnableAudioAlarms} />
                </div>

                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md border border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-medium">Enable Notification Audio</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                        Enable voice alerts for session events like completed exposures.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch checked={enableAudioNotifications} onCheckedChange={setEnableAudioNotifications} />
                </div>
              </div>

              <Separator className="bg-border/50" />

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Image Load Parameters</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Resize Image</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                          Reduces image resolution on the server before transmission to save bandwidth.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Downsample on server</p>
                  </div>
                  <Switch checked={imageResize} onCheckedChange={setImageResize} />
                </div>

                {imageResize && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200 bg-muted/20 p-2 rounded border border-border/50">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="width" className="text-[10px] uppercase font-bold text-muted-foreground">Width</Label>
                      <Input id="width" type="number" value={imageWidth} onChange={(e) => setImageWidth(e.target.value)} className="h-8 font-mono text-xs" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="height" className="text-[10px] uppercase font-bold text-muted-foreground">Height</Label>
                      <Input id="height" type="number" value={imageHeight} onChange={(e) => setImageHeight(e.target.value)} className="h-8 font-mono text-xs" />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Debayer</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="text-[10px] max-w-[200px]">
                          Converts raw sensor data into a color image (required for OSC cameras).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Color interpolation</p>
                  </div>
                  <Switch checked={imageDebayer} onCheckedChange={setImageDebayer} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Autoprepared</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                          Automatically applies background extraction and MTF stretch on the server.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Auto-stretch and process</p>
                  </div>
                  <Switch checked={imageAutoprepared} onCheckedChange={setImageAutoprepared} />
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="quality" className="text-xs font-medium">Quality</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="text-[10px] max-w-[200px]">
                          JPEG compression quality (higher is better detail but larger file size).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-[10px] font-mono text-primary font-bold">{imageQuality}%</span>
                  </div>
                  <Input
                    id="quality"
                    type="range"
                    min="1"
                    max="100"
                    value={imageQuality}
                    onChange={(e) => setImageQuality(e.target.value)}
                    className="h-4"
                  />
                </div>
              </div>
            </div>
          </div>
        </TooltipProvider>

        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="text-xs px-4 font-bold">
            Apply Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
