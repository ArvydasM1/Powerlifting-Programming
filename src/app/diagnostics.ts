/**
 * Startup health and breadcrumbs. Native SafeMode plugin counts process starts that never
 * reached a healthy app; the web fallback uses localStorage. Breadcrumbs are a small ring
 * buffer in localStorage so the recovery screen can show the last steps before a crash.
 */
import { registerPlugin } from "@capacitor/core";
import { hasPlugin } from "@/native/bridge";

interface SafeModePlugin {
  getStartInfo(): Promise<{ failedStarts: number }>;
  markHealthy(): Promise<void>;
}
const SafeMode = registerPlugin<SafeModePlugin>("SafeMode");

const FAILED_KEY = "531log.failedStarts";
const CRUMBS_KEY = "531log.breadcrumbs";
const FORCE_KEY = "531log.forceRecovery";

export async function failedStarts(): Promise<number> {
  if (hasPlugin("SafeMode")) {
    try {
      return (await SafeMode.getStartInfo()).failedStarts;
    } catch {
      /* fall through */
    }
  }
  try {
    const n = Number(localStorage.getItem(FAILED_KEY) ?? "0") + 1;
    localStorage.setItem(FAILED_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

export async function markHealthy(): Promise<void> {
  if (hasPlugin("SafeMode")) await SafeMode.markHealthy().catch(() => {});
  try {
    localStorage.setItem(FAILED_KEY, "0");
  } catch {
    /* ignore */
  }
}

export function forceRecoveryNextStart(on: boolean) {
  try {
    if (on) localStorage.setItem(FORCE_KEY, "1");
    else localStorage.removeItem(FORCE_KEY);
  } catch {
    /* ignore */
  }
}

export function recoveryForced(): boolean {
  try {
    return localStorage.getItem(FORCE_KEY) === "1";
  } catch {
    return false;
  }
}

export function crumb(step: string) {
  try {
    const list = JSON.parse(localStorage.getItem(CRUMBS_KEY) ?? "[]") as string[];
    list.push(`${new Date().toISOString().slice(11, 23)} ${step}`);
    localStorage.setItem(CRUMBS_KEY, JSON.stringify(list.slice(-40)));
  } catch {
    /* ignore */
  }
}

export function readCrumbs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CRUMBS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
