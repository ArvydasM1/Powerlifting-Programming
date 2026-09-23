/**
 * §13 live heart rate. Native: @capacitor-community/bluetooth-le plus the SessionKeepAlive
 * foreground service so the process survives screen lock. PWA: Web Bluetooth while visible.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { parseHeartRateMeasurement } from "@/domain/vitals";
import { hasPlugin, isNative } from "./bridge";

const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";

export interface HeartRateSample {
  ts: number;
  bpm: number;
}
type Listener = (s: HeartRateSample) => void;
type StateListener = (state: HeartRateState) => void;
export type HeartRateState = "unavailable" | "idle" | "scanning" | "connected" | "reconnecting";

interface SessionKeepAlivePlugin {
  start(options: { text: string }): Promise<void>;
  update(options: { text: string }): Promise<void>;
  stop(): Promise<void>;
}
const KeepAlive = registerPlugin<SessionKeepAlivePlugin>("SessionKeepAlive");

class HeartRateMonitor {
  private listeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private _state: HeartRateState = "idle";
  private deviceId: string | null = null;
  private webDevice: BluetoothDevice | null = null;
  private stopping = false;
  private lastDeviceKey = "hr:lastDevice";

  get state() {
    return this._state;
  }
  get deviceName(): string | null {
    return this.webDevice?.name ?? this.deviceId;
  }

  available(): boolean {
    if (isNative()) return hasPlugin("BluetoothLe");
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  onSample(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  onState(l: StateListener) {
    this.stateListeners.add(l);
    return () => this.stateListeners.delete(l);
  }
  private setState(s: HeartRateState) {
    this._state = s;
    for (const l of this.stateListeners) l(s);
  }
  private emit(bpm: number) {
    if (bpm <= 0 || bpm > 250) return;
    const s = { ts: Date.now(), bpm };
    for (const l of this.listeners) l(s);
    if (isNative() && hasPlugin("SessionKeepAlive")) void KeepAlive.update({ text: `${bpm} bpm` }).catch(() => {});
  }

  /** Opens the device picker (web) or scans (native). Remembers the device for one-tap reconnect. */
  async connect(): Promise<void> {
    this.stopping = false;
    if (!this.available()) {
      this.setState("unavailable");
      return;
    }
    this.setState("scanning");
    try {
      if (isNative()) await this.connectNative();
      else await this.connectWeb();
      this.setState("connected");
    } catch (e) {
      this.setState("idle");
      throw e;
    }
  }

  private async connectNative(): Promise<void> {
    const { BleClient } = await import("@capacitor-community/bluetooth-le");
    await BleClient.initialize({ androidNeverForLocation: true });
    let id: string | null = null;
    try {
      id = localStorage.getItem(this.lastDeviceKey);
    } catch {
      /* ignore */
    }
    if (!id) {
      const dev = await BleClient.requestDevice({ services: [HR_SERVICE] });
      id = dev.deviceId;
      try {
        localStorage.setItem(this.lastDeviceKey, id);
      } catch {
        /* ignore */
      }
    }
    this.deviceId = id;
    await BleClient.connect(id, () => {
      if (this.stopping) return;
      this.setState("reconnecting");
      void this.retryNative();
    });
    await BleClient.startNotifications(id, HR_SERVICE, HR_MEASUREMENT, (v) => this.emit(parseHeartRateMeasurement(v)));
    if (hasPlugin("SessionKeepAlive")) await KeepAlive.start({ text: "Heart rate connected" }).catch(() => {});
  }

  private async retryNative(): Promise<void> {
    const { BleClient } = await import("@capacitor-community/bluetooth-le");
    for (let i = 0; i < 20 && !this.stopping; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await BleClient.connect(this.deviceId!, () => {
          if (!this.stopping) void this.retryNative();
        });
        await BleClient.startNotifications(this.deviceId!, HR_SERVICE, HR_MEASUREMENT, (v) => this.emit(parseHeartRateMeasurement(v)));
        this.setState("connected");
        return;
      } catch {
        /* keep trying */
      }
    }
    this.setState("idle");
  }

  private async connectWeb(): Promise<void> {
    const bt = navigator.bluetooth;
    let device: BluetoothDevice | undefined;
    const getDevices = (bt as unknown as { getDevices?: () => Promise<BluetoothDevice[]> }).getDevices;
    if (getDevices) {
      const known = await getDevices.call(bt);
      device = known[0];
    }
    if (!device) device = await bt.requestDevice({ filters: [{ services: [HR_SERVICE] }] });
    this.webDevice = device;
    const subscribe = async () => {
      const server = await device!.gatt!.connect();
      const service = await server.getPrimaryService(HR_SERVICE);
      const ch = await service.getCharacteristic(HR_MEASUREMENT);
      await ch.startNotifications();
      ch.addEventListener("characteristicvaluechanged", (ev) => {
        const v = (ev.target as BluetoothRemoteGATTCharacteristic).value;
        if (v) this.emit(parseHeartRateMeasurement(v));
      });
    };
    device.addEventListener("gattserverdisconnected", async () => {
      if (this.stopping) return;
      this.setState("reconnecting");
      for (let i = 0; i < 10 && !this.stopping; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          await subscribe();
          this.setState("connected");
          return;
        } catch {
          /* retry */
        }
      }
      this.setState("idle");
    });
    await subscribe();
  }

  async disconnect(): Promise<void> {
    this.stopping = true;
    try {
      if (isNative() && this.deviceId) {
        const { BleClient } = await import("@capacitor-community/bluetooth-le");
        await BleClient.stopNotifications(this.deviceId, HR_SERVICE, HR_MEASUREMENT).catch(() => {});
        await BleClient.disconnect(this.deviceId).catch(() => {});
        if (hasPlugin("SessionKeepAlive")) await KeepAlive.stop().catch(() => {});
      } else {
        this.webDevice?.gatt?.disconnect();
      }
    } finally {
      this.setState("idle");
    }
  }

  forgetDevice() {
    try {
      localStorage.removeItem(this.lastDeviceKey);
    } catch {
      /* ignore */
    }
    this.deviceId = null;
    this.webDevice = null;
  }
}

export const heartRate = new HeartRateMonitor();
export const platformLabel = () => (Capacitor.isNativePlatform() ? "Android" : "browser");
