import { DatabaseSync } from "node:sqlite";
import { parentPort, workerData } from "node:worker_threads";
import { createApp } from "../src/app.js";

const port = parentPort;
if (!port) throw new Error("Booking worker requires a parent port");
const { path, url, options, releaseLock, start } = workerData;
using database = new DatabaseSync(path, { timeout: 5000 });
const app = createApp(database, {
  environment: {},
  now: () => {
    if (releaseLock) {
      // Hold the write transaction while the other connection tries to book.
      port.postMessage("validating");
      waitForSignal(releaseLock);
    }
    return new Date("2026-02-02T06:00:00Z");
  },
});
if (start) {
  port.postMessage("ready");
  waitForSignal(start);
}
const response = await app.request(url, options);
port.postMessage(response.status);

function waitForSignal(signal: SharedArrayBuffer) {
  if (Atomics.wait(new Int32Array(signal), 0, 0, 10_000) === "timed-out") {
    throw new Error("Timed out waiting for the competing booking");
  }
}
