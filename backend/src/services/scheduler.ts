import { config } from "../config.js";
import { readJson, writeJson } from "../utils/jsonStore.js";
import { log } from "../utils/logger.js";
import { executePayment, ScheduledPayment } from "../skills/payments.js";
import { Contract } from "ethers";
import { RuleSet } from "../skills/rules.js";

export function loadSchedules() {
  return readJson<ScheduledPayment[]>(config.schedulesFile, []);
}

export async function runDuePayments(paymentRouter: Contract, rules: RuleSet, treasuryBalance: bigint) {
  const schedules = loadSchedules();
  const nowSeconds = Math.floor(Date.now() / 1000);
  let changed = false;

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    const due = schedule.lastPaidAt === 0 || nowSeconds >= schedule.lastPaidAt + schedule.intervalSeconds;
    if (!due) continue;
    try {
      const paid = await executePayment(paymentRouter, rules, treasuryBalance, schedule);
      if (paid) {
        schedule.lastPaidAt = nowSeconds;
        changed = true;
      }
    } catch (error) {
      log("error", "scheduled_payment_failed", `Scheduled payment failed: ${schedule.id}`, String(error));
    }
  }

  if (changed) writeJson(config.schedulesFile, schedules);
}
