import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely converts a value to a number.
 * Returns defaultVal if result is NaN.
 */
export function toNumber(val: any, defaultVal: number = 0): number {
  if (val === null || val === undefined) return defaultVal
  const num = Number(val)
  return isNaN(num) ? defaultVal : num
}

/**
 * Safely formats a number to fixed precision.
 * Handles strings, null, and NaN by returning "--" or a default.
 */
export function formatNumber(val: any, precision: number = 2, placeholder: string = "--"): string {
  if (val === null || val === undefined) return placeholder
  const num = Number(val)
  if (isNaN(num)) return placeholder
  return num.toFixed(precision)
}
