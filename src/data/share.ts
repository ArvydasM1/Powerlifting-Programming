/** §14 sharing: text summaries, PNG cards, CSV/JSON payloads. Nothing here sends anything; callers use shareOrDownload. */
import { formatRest } from "@/domain/calc";
import type { Program, Session, SessionVitals, SetGroup, WorkoutSet } from "@/domain/types";
import { setsToCsv } from "./backup";

export interface ShareOptions {
  includeHealth: boolean;
}

export function sessionText(session: Session, groups: SetGroup[], sets: WorkoutSet[], vitals: SessionVitals | null, opts: ShareOptions): string {
  const lines: string[] = [];
  lines.push(`${session.plannedLabel}`);
  lines.push(`${session.date ?? session.plannedDate ?? ""}${session.dateApproximate ? " (approx.)" : ""}`);
  if (session.startedAt && session.finishedAt) lines.push(`Duration ${formatRest(Math.floor((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 1000))}`);
  for (const g of groups) {
    const gs = sets.filter((s) => s.groupId === g.id && (s.completedAt || s.backfilled));
    if (gs.length === 0) continue;
    lines.push("");
    lines.push(g.label);
    for (const s of gs) {
      const pr = s.isRepPR ? " PR" : s.isE1rmPR ? " e1RM PR" : "";
      const rest = s.actualRestSec !== null ? ` · ${formatRest(s.actualRestSec)}` : "";
      lines.push(`${s.exerciseName} ${s.actualWeight ?? ""}×${s.actualReps ?? ""} (${s.prescribedReps})${pr}${rest}`);
    }
  }
  if (opts.includeHealth && vitals && (vitals.hrAvg || vitals.hrMax)) {
    lines.push("");
    lines.push(`Heart rate avg ${vitals.hrAvg ?? "—"} · max ${vitals.hrMax ?? "—"}`);
  }
  if (session.notes) {
    lines.push("");
    lines.push(session.notes);
  }
  return lines.join("\n");
}

/** Render a simple PNG card with the Canvas API (no dependency). */
export async function textToPngBlob(title: string, body: string): Promise<Blob> {
  const lines = body.split("\n");
  const width = 720;
  const lineH = 28;
  const pad = 32;
  const height = pad * 2 + 44 + lines.length * lineH;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#f97316";
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.fillText(title, pad, pad + 28);
  ctx.fillStyle = "#f2f2f2";
  ctx.font = "20px system-ui, sans-serif";
  lines.forEach((l, i) => {
    ctx.fillStyle = l.includes(" PR") ? "#22c55e" : l.trim() === "" || /^[A-Z]/.test(l) && !/×/.test(l) ? "#9a9a9f" : "#f2f2f2";
    ctx.fillText(l, pad, pad + 44 + 22 + i * lineH);
  });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG failed"))), "image/png"));
}

/** Rasterise an SVG element (e.g. the Recharts chart) to a PNG blob. */
export async function svgToPngBlob(svg: SVGSVGElement, background = "#111111"): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = svg.clientWidth * 2 || 800;
    canvas.height = svg.clientHeight * 2 || 400;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function stripHealth<T extends { vitals?: unknown; sessionVitals?: unknown }>(payload: T): T {
  const copy = { ...payload };
  delete (copy as { vitals?: unknown }).vitals;
  delete (copy as { sessionVitals?: unknown }).sessionVitals;
  return copy;
}

export function programJson(program: Program, sessions: Session[], groups: SetGroup[], sets: WorkoutSet[], vitals: SessionVitals[], opts: ShareOptions): string {
  const payload: Record<string, unknown> = { schemaVersion: 1, exportedAt: new Date().toISOString(), program, sessions, setGroups: groups, sets };
  if (opts.includeHealth) payload.sessionVitals = vitals;
  return JSON.stringify(payload, null, 1);
}

export function sessionsCsv(sessions: Session[], sets: WorkoutSet[]): string {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return setsToCsv(
    sets
      .filter((s) => s.completedAt || s.backfilled)
      .map((s) => ({ ...s, date: byId.get(s.sessionId)?.date ?? "", session: byId.get(s.sessionId)?.plannedLabel ?? "", exercise: s.exerciseName })),
  );
}

export const shareFileName = (template: string, date: string, kind: string, ext: string) => `${template.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}-${kind}.${ext}`;
