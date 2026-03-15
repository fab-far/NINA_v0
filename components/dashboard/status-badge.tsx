"use client"

import { cn } from "@/lib/utils"

type StatusVariant = "running" | "idle" | "error" | "warning" | "success" | "disabled"

interface StatusBadgeProps {
  label: string
  variant?: StatusVariant
  pulse?: boolean
  className?: string
}

const variantStyles: Record<StatusVariant, string> = {
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  idle: "bg-muted text-muted-foreground border-border",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  disabled: "bg-muted/50 text-muted-foreground/60 border-border/50",
}

export function StatusBadge({
  label,
  variant = "idle",
  pulse = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 sm:gap-1.5 rounded-md border px-1 sm:px-2 py-0.5 text-[10px] sm:text-xs font-mono font-bold sm:font-medium whitespace-nowrap",
        variantStyles[variant],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              variant === "running" && "bg-emerald-400",
              variant === "error" && "bg-red-400",
              variant === "warning" && "bg-amber-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              variant === "running" && "bg-emerald-400",
              variant === "success" && "bg-emerald-400",
              variant === "error" && "bg-red-400",
              variant === "warning" && "bg-amber-400",
              variant === "idle" && "bg-muted-foreground",
              variant === "disabled" && "bg-muted-foreground/60"
            )}
          />
        </span>
      )}
      {label}
    </span>
  )
}
