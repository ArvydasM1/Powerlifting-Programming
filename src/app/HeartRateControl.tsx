/** §13: heart icon, live BPM and connection state for the open session. */
import { useEffect, useRef, useState } from "react";
import { LiveVitalsRecorder } from "@/data/vitalsStore";
import { heartRate, type HeartRateState } from "@/native/heartRate";
import { repo } from "./hooks";
import { Button } from "./ui";

export function useLiveHeartRate(sessionId: string | undefined, active: boolean) {
  const [bpm, setBpm] = useState<number | null>(null);
  const [state, setState] = useState<HeartRateState>(heartRate.state);
  const recorder = useRef<LiveVitalsRecorder | null>(null);

  useEffect(() => {
    if (!sessionId || !active) return;
    recorder.current = new LiveVitalsRecorder(repo.db, sessionId, `ble:${heartRate.deviceName ?? "device"}`);
    const offSample = heartRate.onSample((s) => {
      setBpm(s.bpm);
      recorder.current?.push(s.ts, s.bpm);
    });
    const offState = heartRate.onState(setState);
    return () => {
      offSample();
      offState();
      void recorder.current?.flush();
    };
  }, [sessionId, active]);

  return { bpm: state === "connected" ? bpm : null, state, flush: () => recorder.current?.flush() ?? Promise.resolve() };
}

export function HeartRateButton({ state }: { state: HeartRateState }) {
  const [error, setError] = useState<string | null>(null);
  if (!heartRate.available()) return null;
  const connected = state === "connected" || state === "reconnecting";
  return (
    <span>
      <Button
        kind={connected ? "primary" : "default"}
        onClick={async () => {
          setError(null);
          try {
            if (connected) await heartRate.disconnect();
            else await heartRate.connect();
          } catch (e) {
            if ((e as Error).name !== "NotFoundError") setError((e as Error).message);
          }
        }}
      >
        {state === "scanning" ? "…" : state === "reconnecting" ? "♥ reconnecting" : connected ? "♥ on" : "♥"}
      </Button>
      {error && <span className="error small"> {error}</span>}
    </span>
  );
}
