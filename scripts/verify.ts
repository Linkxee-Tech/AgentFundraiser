import { run } from "hardhat";
import fs from "fs";
import path from "path";

function deployment() {
  const chainId = process.env.PHAROS_CHAIN_ID || "12345";
  const file = process.env.DEPLOYMENT_FILE || path.join(__dirname, "..", "deployments", `${chainId}.json`);
  if (!fs.existsSync(file)) throw new Error(`Deployment file not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function verifyContract(address: string, constructorArguments: unknown[]) {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`Verified ${address}`);
  } catch (error: any) {
    const message = error?.message || String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log(`Already verified ${address}`);
      return;
    }
    throw error;
  }
}

async function main() {
  const d = deployment();
  await verifyContract(d.ruleEngine, [d.agent]);
  await verifyContract(d.treasuryManager, [
    d.agent,
    BigInt(process.env.DAILY_LIMIT_WEI || "1000000000000000000000"),
    BigInt(process.env.RESERVE_FLOOR_WEI || "200000000000000000000")
  ]);
  await verifyContract(d.bountyManager, [d.agent, BigInt(process.env.SUBMISSION_BOND_WEI || "1000000000000000000")]);
  await verifyContract(d.agentPaymentRouter, [
    d.agent,
    d.treasuryManager,
    BigInt(process.env.MULTISIG_THRESHOLD_WEI || "100000000000000000000")
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
