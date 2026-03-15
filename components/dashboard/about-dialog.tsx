"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Telescope } from "lucide-react"

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border shadow-2xl">
        <DialogHeader className="flex flex-col items-center gap-2 pt-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Telescope className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight font-mono">
            N.I.N.A. Dashboard
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-mono">Version 0.1.1</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">© 2026 Fabrizio Farina.</p>
          </div>

          <ScrollArea className="h-[200px] w-full rounded-md border border-border/50 bg-muted/30 p-4">
            <div className="text-[10px] leading-relaxed text-muted-foreground font-mono whitespace-pre-wrap">
              Permission is hereby granted, free of charge, to any person obtaining a copy
              of this software and associated documentation files (the "Software"), to deal
              in the Software without restriction, including without limitation the rights
              to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
              copies of the Software, and to permit persons to whom the Software is
              furnished to do so, subject to the following conditions:{"\n\n"}

              The above copyright notice and this permission notice shall be included in all
              copies or substantial portions of the Software.{"\n\n"}

              THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
              AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
              LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
              OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
              SOFTWARE.
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
