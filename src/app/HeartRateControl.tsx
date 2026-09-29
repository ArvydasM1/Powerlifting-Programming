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
            const err = e as Error;
            const notFound = err.name === "NotFoundError" || /no device|not found|cancel/i.test(err.message);
            setError(
              notFound
                ? "No heart-rate broadcast found. The sensor must advertise the standard Bluetooth heart-rate service; on a Fitbit that means turning on heart-rate broadcast (in the device's Exercise settings) during a workout, and not every Fitbit offers it. Without a broadcast, heart rate is read from Health Connect after the session instead."
                : err.message,
            );
          }
        }}
      >
        {state === "scanning" ? "…" : state === "reconnecting" ? "♥ reconnecting" : connected ? "♥ on" : "♥"}
      </Button>
      {error && <span className="error small"> {error}</span>}
    </span>
  );
}
