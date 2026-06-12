import fs from "fs";
import path from "path";
import { config } from "../config.js";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
};

type ReviewRecord = {
  bountyId: string;
  submissionIndex: number;
  submitter: string;
  score: number;
  recommendation: string;
  reasoning: string;
};

let sqliteDb: SqliteDatabase | null = null;
let initialized = false;

async function loadSqlite() {
  const sqlitePath = config.databaseUrl.replace(/^sqlite:/, "");
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const dynamicImport = Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  const sqliteModule = await dynamicImport("node:sqlite") as { DatabaseSync: new (filename: string) => SqliteDatabase };
  sqliteDb = new sqliteModule.DatabaseSync(sqlitePath);
}

export async function initStorage() {
  if (initialized) return;
  if (!config.databaseUrl.startsWith("sqlite:")) {
    throw new Error("Only sqlite: DATABASE_URL is currently supported by the bundled production agent.");
  }
  await loadSqlite();
  sqliteDb?.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_id TEXT NOT NULL,
      submission_index INTEGER NOT NULL,
      submitter TEXT NOT NULL,
      score INTEGER NOT NULL,
      recommendation TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (bounty_id, submission_index)
    );
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      amount_pros TEXT NOT NULL,
      token TEXT NOT NULL,
      memo TEXT NOT NULL,
      category TEXT NOT NULL,
      interval_seconds INTEGER NOT NULL,
      last_paid_at INTEGER NOT NULL,
      enabled INTEGER NOT NULL
    );
  `);
  initialized = true;
}

export async function recordReview(review: ReviewRecord) {
  await initStorage();
  sqliteDb?.prepare(`
    INSERT INTO reviews (bounty_id, submission_index, submitter, score, recommendation, reasoning)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (bounty_id, submission_index) DO UPDATE SET
      score = excluded.score,
      recommendation = excluded.recommendation,
      reasoning = excluded.reasoning,
      created_at = CURRENT_TIMESTAMP
  `).run(review.bountyId, review.submissionIndex, review.submitter, review.score, review.recommendation, review.reasoning);
}

export async function loadScheduleRows<T>() {
  await initStorage();
  return (sqliteDb?.prepare("SELECT * FROM schedules WHERE enabled = 1").all() || []) as T[];
}

export async function updateScheduleLastPaid(id: string, lastPaidAt: number) {
  await initStorage();
  sqliteDb?.prepare("UPDATE schedules SET last_paid_at = ? WHERE id = ?").run(lastPaidAt, id);
}
