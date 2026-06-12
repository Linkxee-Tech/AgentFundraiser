import { Contract, ethers } from "ethers";
import { RuleSet, canPayCategory } from "./rules.js";
import { log } from "../utils/logger.js";

export type ScheduledPayment = {
  id: string;
  recipient: string;
  amountPros: string;
  token: string;
  memo: string;
  category: string;
  intervalSeconds: number;
  lastPaidAt: number;
  enabled: boolean;
};

export async function executePayment(
  paymentRouter: Contract,
  rules: RuleSet,
  treasuryBalance: bigint,
  schedule: ScheduledPayment
) {
  const amount = ethers.parseEther(schedule.amountPros);
  const violation = canPayCategory(rules, schedule.category, treasuryBalance, amount);
  if (violation) {
    log("warn", "rule_violation", violation, { scheduleId: schedule.id });
    return false;
  }

  const token = schedule.token === "native" ? ethers.ZeroAddress : schedule.token;
  const dueBucket = Math.floor(Date.now() / 1000 / Math.max(1, schedule.intervalSeconds));
  const key = ethers.id(`${schedule.id}:${schedule.recipient}:${schedule.amountPros}:${dueBucket}`);
  const tx = await paymentRouter.payAgentWithIdempotency(schedule.recipient, amount, schedule.memo, token, key);
  log("info", "scheduled_payment_sent", `Payment transaction submitted for ${schedule.id}`, { hash: tx.hash });
  await tx.wait();
  return true;
}
