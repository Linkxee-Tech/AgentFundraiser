import fs from "fs";
import path from "path";

export function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(filePath: string, value: T) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function appendJsonArray<T>(filePath: string, value: T, limit = 5000) {
  const existing = readJson<T[]>(filePath, []);
  existing.push(value);
  writeJson(filePath, existing.slice(-limit));
}
