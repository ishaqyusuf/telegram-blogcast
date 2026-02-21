import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function minuteToString(m?) {
  if (!m) return "--:--";
  return `${Math.floor(m / 60)}:${m % 60}`;
}
