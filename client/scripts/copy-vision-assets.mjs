import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(clientRoot, "node_modules/@mediapipe/tasks-vision/wasm");
const destination = resolve(clientRoot, "public/vendor/mediapipe/wasm");

await rm(destination, { recursive: true, force: true });
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });
