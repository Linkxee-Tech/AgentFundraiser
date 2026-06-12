import { Contract } from "ethers";

export async function getTreasurySnapshot(treasury: Contract) {
  const [balance, spentToday, dailyLimit, paused] = await Promise.all([
    treasury.balance(),
    treasury.spentToday(),
    treasury.dailyLimit(),
    treasury.emergencyPause()
  ]);
  return { balance: balance as bigint, spentToday: spentToday as bigint, dailyLimit: dailyLimit as bigint, paused: paused as boolean };
}
