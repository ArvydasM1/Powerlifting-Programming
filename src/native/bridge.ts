/**
 * Native capability bridges (§10.2/10.3). Every capability is behind feature detection so the
 * same bundle runs as a PWA with the feature hidden or degraded.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const hasPlugin = (name: string) => Capacitor.isPluginAvailable(name);

// ---- RestAlert (in-house, v1) -------------------------------------------------

export interface RestAlertPlugin {
  schedule(options: { atEpochMs: number; kind: "vibrate" | "sound" | "both" }): Promise<void>;
  cancel(): Promise<void>;
}

const RestAlertNative = registerPlugin<RestAlertPlugin>("RestAlert");

let webTimer: number | null = null;

export const restAlert = {
  available: () => hasPlugin("RestAlert") || typeof navigator !== "undefined",
  async schedule(atEpochMs: number, kind: "vibrate" | "sound" | "both" | "none"): Promise<void> {
    await this.cancel();
    if (kind === "none") return;
    if (hasPlugin("RestAlert")) {
      await RestAlertNative.schedule({ atEpochMs, kind });
      return;
    }
    // Web fallback: only fires while the page is visible (§9)
    const delay = Math.max(0, atEpochMs - Date.now());
    webTimer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      if ((kind === "vibrate" || kind === "both") && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      if (kind === "sound" || kind === "both") beep();
    }, delay);
  },
  async cancel(): Promise<void> {
    if (webTimer !== null) {
      clearTimeout(webTimer);
      webTimer = null;
    }
    if (hasPlugin("RestAlert")) await RestAlertNative.cancel();
  },
};

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.2;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {
    /* no audio */
  }
}

// ---- Keep awake -------------------------------------------------------------------

let wakeLock: WakeLockSentinel | null = null;

export const keepAwake = {
  async on(): Promise<void> {
    if (hasPlugin("KeepAwake")) {
      const { KeepAwake } = await import("@capacitor-community/keep-awake");
      await KeepAwake.keepAwake();
      return;
    }
    try {
      wakeLock = await navigator.wakeLock?.request("screen");
    } catch {
      /* not granted */
    }
  },
  async off(): Promise<void> {
    if (hasPlugin("KeepAwake")) {
      const { KeepAwake } = await import("@capacitor-community/keep-awake");
      await KeepAwake.allowSleep();
      return;
    }
    await wakeLock?.release();
    wakeLock = null;
  },
};

// ---- Share / download ----------------------------------------------------------------

export async function shareOrDownload(filename: string, content: string, mime: string, title: string): Promise<void> {
  if (hasPlugin("Filesystem") && hasPlugin("Share") && isNative()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const written = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title, files: [written.uri] });
    return;
  }
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
