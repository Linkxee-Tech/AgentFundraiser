import { log } from "../utils/logger.js";
import { executePayment } from "../skills/payments.js";
import { Contract } from "ethers";
import { RuleSet } from "../skills/rules.js";
import { loadScheduleRows, updateScheduleLastPaid } from "./storage.js";

type ScheduleRow = {
  id: string;
  recipient: string;
  amount_pros: string;
  token: string;
  memo: string;
  category: string;
  interval_seconds: number;
  last_paid_at: number;
  enabled: number;
};

export async function loadSchedules() {
  const rows = await loadScheduleRows<ScheduleRow>();
  return rows.map((row) => ({
    id: row.id,
    recipient: row.recipient,
    amountPros: row.amount_pros,
    token: row.token,
    memo: row.memo,
    category: row.category,
    intervalSeconds: row.interval_seconds,
    lastPaidAt: row.last_paid_at,
    enabled: Boolean(row.enabled)
  }));
}

export async function runDuePayments(paymentRouter: Contract, rules: RuleSet, treasuryBalance: bigint) {
  const schedules = await loadSchedules();
  const nowSeconds = Math.floor(Date.now() / 1000);

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    const due = schedule.lastPaidAt === 0 || nowSeconds >= schedule.lastPaidAt + schedule.intervalSeconds;
    if (!due) continue;
    try {
      const paid = await executePayment(paymentRouter, rules, treasuryBalance, schedule);
      if (paid) {
        schedule.lastPaidAt = nowSeconds;
        await updateScheduleLastPaid(schedule.id, nowSeconds);
      }
    } catch (error) {
      log("error", "scheduled_payment_failed", `Scheduled payment failed: ${schedule.id}`, String(error));
    }
  }
}
