"use client";

import { encodeEscPosBytesToBase64 } from "./escpos";

interface BluetoothCharacteristicPropertiesLike {
  write?: boolean;
  writeWithoutResponse?: boolean;
}

interface BluetoothRemoteGATTCharacteristicLike {
  uuid: string;
  properties?: BluetoothCharacteristicPropertiesLike;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
}

interface BluetoothRemoteGATTServiceLike {
  uuid: string;
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicLike[]>;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGATTServerLike>;
  disconnect: () => void;
  getPrimaryServices?: () => Promise<BluetoothRemoteGATTServiceLike[]>;
  getPrimaryService: (service: string) => Promise<BluetoothRemoteGATTServiceLike>;
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface NavigatorBluetoothLike {
  requestDevice: (options: {
    acceptAllDevices?: boolean;
    filters?: Array<{ services: string[] }>;
    optionalServices?: string[];
  }) => Promise<BluetoothDeviceLike>;
  getDevices?: () => Promise<BluetoothDeviceLike[]>;
}

export interface BluetoothPrinterState {
  status: "disconnected" | "connecting" | "connected" | "printing";
  deviceId: string | null;
  deviceName: string | null;
}

export interface BluetoothPrintCapabilities {
  webBluetoothSupported: boolean;
  isSecureContext: boolean;
  isAndroid: boolean;
  isIos: boolean;
}

const KNOWN_THERMAL_SERVICE_UUIDS: string[] = [
  "000018f0-0000-1000-8000-00805f9b34fb", // POS thermal BLE standar (RPP02N, Xprinter, Goojprt, Panda, Blueprint)
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC / Microchip transparent UART (Eppos, portable thermal)
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service (NUS)
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Custom serial printer BLE
  "0000ff00-0000-1000-8000-00805f9b34fb", // Generic serial printer FF00
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 / JDY serial BLE
  "0000ae30-0000-1000-8000-00805f9b34fb", // AE30 thermal BLE variant
  "0000af30-0000-1000-8000-00805f9b34fb", // AF30 thermal BLE variant
  "0000fee7-0000-1000-8000-00805f9b34fb", // FEE7 thermal BLE variant
];

const PREFERRED_WRITE_CHAR_UUIDS = new Set<string>([
  "00002af1-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "0000ae01-0000-1000-8000-00805f9b34fb",
]);

const PRINTER_STORAGE_KEY = "1621_bt_printer_meta";

interface ActivePrinterConnection {
  device: BluetoothDeviceLike;
  characteristic: BluetoothRemoteGATTCharacteristicLike;
  deviceName: string;
}

let activeConnection: ActivePrinterConnection | null = null;
let currentState: BluetoothPrinterState = {
  status: "disconnected",
  deviceId: null,
  deviceName: null,
};

const stateListeners = new Set<(state: BluetoothPrinterState) => void>();

function notifyState(next: BluetoothPrinterState) {
  currentState = next;
  for (const listener of stateListeners) {
    listener(next);
  }
}

function getNavigatorBluetooth(): NavigatorBluetoothLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { bluetooth?: NavigatorBluetoothLike };
  return nav.bluetooth ?? null;
}

export function getBluetoothPrintCapabilities(): BluetoothPrintCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      webBluetoothSupported: false,
      isSecureContext: false,
      isAndroid: false,
      isIos: false,
    };
  }

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);

  return {
    webBluetoothSupported: getNavigatorBluetooth() !== null,
    isSecureContext: Boolean(window.isSecureContext),
    isAndroid,
    isIos,
  };
}

export function getBluetoothPrinterState(): BluetoothPrinterState {
  return currentState;
}

export function subscribeBluetoothPrinterState(
  listener: (state: BluetoothPrinterState) => void
): () => void {
  stateListeners.add(listener);
  listener(currentState);
  return () => {
    stateListeners.delete(listener);
  };
}

function savePrinterMeta(deviceId: string, deviceName: string) {
  try {
    window.localStorage.setItem(
      PRINTER_STORAGE_KEY,
      JSON.stringify({ deviceId, deviceName })
    );
  } catch {
    // Abaikan jika storage terbatas
  }
}

function loadSavedPrinterMeta(): { deviceId: string; deviceName: string } | null {
  try {
    const raw = window.localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { deviceId?: unknown; deviceName?: unknown };
    if (
      typeof parsed.deviceId === "string" &&
      typeof parsed.deviceName === "string"
    ) {
      return { deviceId: parsed.deviceId, deviceName: parsed.deviceName };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveWritableCharacteristic(
  server: BluetoothRemoteGATTServerLike
): Promise<BluetoothRemoteGATTCharacteristicLike> {
  const discoveredServices: BluetoothRemoteGATTServiceLike[] = [];

  if (typeof server.getPrimaryServices === "function") {
    try {
      const allServices = await server.getPrimaryServices();
      discoveredServices.push(...allServices);
    } catch {
      // Lanjut probe service UUID dikenal
    }
  }

  if (discoveredServices.length === 0) {
    for (const serviceUuid of KNOWN_THERMAL_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        discoveredServices.push(service);
      } catch {
        // Service UUID ini tidak ada di printer
      }
    }
  }

  let fallbackChar: BluetoothRemoteGATTCharacteristicLike | null = null;

  for (const service of discoveredServices) {
    try {
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        const canWrite = Boolean(
          ch.properties?.writeWithoutResponse || ch.properties?.write
        );
        if (!canWrite) continue;

        if (PREFERRED_WRITE_CHAR_UUIDS.has(ch.uuid.toLowerCase())) {
          return ch;
        }
        if (!fallbackChar) {
          fallbackChar = ch;
        }
      }
    } catch {
      // Lanjut ke service berikutnya
    }
  }

  if (fallbackChar) {
    return fallbackChar;
  }

  throw new Error(
    "Printer terhubung, tetapi layanan cetak GATT (BLE) tidak ditemukan. Jika ini printer Bluetooth Classic (SPP), gunakan tombol Cetak via RawBT (Android) atau Cetak Browser."
  );
}

async function attachDeviceConnection(
  device: BluetoothDeviceLike
): Promise<ActivePrinterConnection> {
  if (!device.gatt) {
    throw new Error("Perangkat Bluetooth ini tidak mendukung koneksi GATT BLE.");
  }

  const server = device.gatt.connected
    ? device.gatt
    : await device.gatt.connect();
  const characteristic = await resolveWritableCharacteristic(server);
  const deviceName = device.name?.trim() || "Printer Thermal Bluetooth";

  const onDisconnect = () => {
    if (activeConnection?.device.id === device.id) {
      activeConnection = null;
      notifyState({
        status: "disconnected",
        deviceId: null,
        deviceName: null,
      });
    }
    device.removeEventListener?.("gattserverdisconnected", onDisconnect);
  };

  device.addEventListener?.("gattserverdisconnected", onDisconnect);

  activeConnection = {
    device,
    characteristic,
    deviceName,
  };
  savePrinterMeta(device.id, deviceName);

  notifyState({
    status: "connected",
    deviceId: device.id,
    deviceName,
  });

  return activeConnection;
}

/**
 * Mencoba menyambungkan ulang printer Bluetooth yang sebelumnya sudah diizinkan browser.
 */
export async function tryReconnectSavedBluetoothPrinter(): Promise<BluetoothPrinterState> {
  if (activeConnection?.device.gatt?.connected) {
    return currentState;
  }

  const bt = getNavigatorBluetooth();
  if (!bt || typeof bt.getDevices !== "function") {
    return currentState;
  }

  const saved = loadSavedPrinterMeta();
  if (!saved) {
    return currentState;
  }

  try {
    const permittedDevices = await bt.getDevices();
    const matched = permittedDevices.find((d) => d.id === saved.deviceId);
    if (!matched) return currentState;

    notifyState({
      status: "connecting",
      deviceId: matched.id,
      deviceName: matched.name?.trim() || saved.deviceName,
    });
    await attachDeviceConnection(matched);
  } catch {
    notifyState({
      status: "disconnected",
      deviceId: null,
      deviceName: null,
    });
  }

  return currentState;
}

/**
 * Membuka dialog pairing Web Bluetooth dan menghubungkan ke printer thermal BLE.
 */
export async function connectBluetoothPrinter(): Promise<BluetoothPrinterState> {
  const capabilities = getBluetoothPrintCapabilities();
  if (!capabilities.isSecureContext) {
    throw new Error(
      "Web Bluetooth hanya berjalan di HTTPS atau localhost. Buka aplikasi lewat HTTPS atau gunakan RawBT / Cetak Browser."
    );
  }

  const bt = getNavigatorBluetooth();
  if (!bt) {
    if (capabilities.isIos) {
      throw new Error(
        "Safari iOS tidak mendukung Web Bluetooth secara langsung. Gunakan Cetak Browser / AirPrint atau buka lewat browser Bluefy di iOS."
      );
    }
    throw new Error(
      "Browser ini belum mendukung Web Bluetooth. Gunakan Google Chrome / Microsoft Edge di Android atau Desktop, atau gunakan RawBT di Android."
    );
  }

  notifyState({
    status: "connecting",
    deviceId: activeConnection?.device.id ?? null,
    deviceName: activeConnection?.deviceName ?? null,
  });

  try {
    const device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_THERMAL_SERVICE_UUIDS,
    });
    await attachDeviceConnection(device);
    return currentState;
  } catch (err) {
    notifyState(
      activeConnection
        ? {
            status: "connected",
            deviceId: activeConnection.device.id,
            deviceName: activeConnection.deviceName,
          }
        : {
            status: "disconnected",
            deviceId: null,
            deviceName: null,
          }
    );

    if (err instanceof Error && err.name === "NotFoundError") {
      throw new Error("Pemilihan printer Bluetooth dibatalkan.");
    }
    throw err instanceof Error
      ? err
      : new Error("Gagal menghubungkan ke printer Bluetooth.");
  }
}

export function disconnectBluetoothPrinter(): void {
  if (activeConnection?.device.gatt?.connected) {
    activeConnection.device.gatt.disconnect();
  }
  activeConnection = null;
  notifyState({
    status: "disconnected",
    deviceId: null,
    deviceName: null,
  });
}

async function writeChunk(
  characteristic: BluetoothRemoteGATTCharacteristicLike,
  chunk: Uint8Array
): Promise<void> {
  const payload = chunk.slice().buffer;
  if (
    characteristic.properties?.writeWithoutResponse &&
    typeof characteristic.writeValueWithoutResponse === "function"
  ) {
    await characteristic.writeValueWithoutResponse(payload);
    return;
  }
  if (typeof characteristic.writeValueWithResponse === "function") {
    await characteristic.writeValueWithResponse(payload);
    return;
  }
  if (typeof characteristic.writeValue === "function") {
    await characteristic.writeValue(payload);
    return;
  }
  throw new Error("Karakteristik GATT printer tidak mendukung operasi tulis.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendChunkedPayload(
  characteristic: BluetoothRemoteGATTCharacteristicLike,
  bytes: Uint8Array,
  chunkSize: number
): Promise<void> {
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    await writeChunk(characteristic, chunk);
    await delay(18);
  }
}

/**
 * Mengirim payload ESC/POS ke printer Bluetooth yang sedang terhubung (atau meminta pairing dulu).
 */
export async function printEscPosOverBluetooth(
  bytes: Uint8Array
): Promise<{ deviceName: string }> {
  if (!activeConnection) {
    await connectBluetoothPrinter();
  }

  let connection = activeConnection;
  if (!connection) {
    throw new Error("Printer Bluetooth belum terhubung.");
  }

  if (connection.device.gatt && !connection.device.gatt.connected) {
    connection = await attachDeviceConnection(connection.device);
  }

  notifyState({
    status: "printing",
    deviceId: connection.device.id,
    deviceName: connection.deviceName,
  });

  try {
    try {
      await sendChunkedPayload(connection.characteristic, bytes, 96);
    } catch {
      // Fallback aman untuk printer BLE dengan MTU default 20 byte
      await sendChunkedPayload(connection.characteristic, bytes, 20);
    }

    return { deviceName: connection.deviceName };
  } finally {
    if (activeConnection) {
      notifyState({
        status: "connected",
        deviceId: activeConnection.device.id,
        deviceName: activeConnection.deviceName,
      });
    } else {
      notifyState({
        status: "disconnected",
        deviceId: null,
        deviceName: null,
      });
    }
  }
}

/**
 * Membangun URI intent RawBT untuk printer Bluetooth Classic (SPP) di Android.
 */
export function buildRawBtPrintUrl(bytes: Uint8Array): string {
  return `rawbt:base64,${encodeEscPosBytesToBase64(bytes)}`;
}

/**
 * Memicu cetak melalui aplikasi RawBT di Android (untuk printer Bluetooth Classic SPP).
 */
export function triggerRawBtPrint(bytes: Uint8Array): void {
  if (typeof window === "undefined") return;
  const url = buildRawBtPrintUrl(bytes);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
