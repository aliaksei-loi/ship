import { EventEmitter } from "events";

// Singleton across Next.js dev HMR reloads via globalThis.
const g = globalThis as unknown as { _shipBus?: EventEmitter };

if (!g._shipBus) {
  g._shipBus = new EventEmitter();
  g._shipBus.setMaxListeners(50);
}

export const bus = g._shipBus;

export const SHIP_EVENT = "shipEvent";
