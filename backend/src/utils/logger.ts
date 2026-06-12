import { config } from "../config.js";
import { appendJsonArray } from "./jsonStore.js";

export type AgentLog = {
  level: "info" | "warn" | "error";
  type: string;
  message: string;
  timestamp: string;
  data?: unknown;
};

export function log(level: AgentLog["level"], type: string, message: string, data?: unknown) {
  const entry: AgentLog = { level, type, message, timestamp: new Date().toISOString(), data };
  const line = `[${entry.timestamp}] ${level.toUpperCase()} ${type}: ${message}`;
  if (level === "error") console.error(line, data || "");
  else if (level === "warn") console.warn(line, data || "");
  else console.log(line, data || "");
  appendJsonArray(config.logsFile, entry);
  return entry;
}
