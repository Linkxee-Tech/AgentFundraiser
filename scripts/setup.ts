import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

const numericRules: Record<string, bigint> = {
  MAX_DAILY_SPEND_PERCENT: 20n,
  MIN_BALANCE_FOR_MARKETING: ethers.parseEther("500"),
  MAX_SINGLE_BOUNTY_REWARD: ethers.parseEther("500"),
  MULTISIG_THRESHOLD: ethers.parseEther("100"),
  RESERVE_FLOOR: ethers.parseEther("200"),
  SUBMISSION_BOND: ethers.parseEther("1"),
  RATE_LIMIT_WINDOW_HOURS: 24n,
  MARKETING_BUDGET_PERCENT: 25n,
  COMMUNITY_BUDGET_PERCENT: 25n
};

const boolRules: Record<string, boolean> = {
  ALLOW_BOUNTY_PAYMENTS: true,
  ALLOW_AGENT_TO_AGENT_PAYMENTS: true,
  ALLOW_MARKETING_PAYMENTS: true,
  ALLOW_COMMUNITY_PAYMENTS: true,
  REQUIRE_MANUAL_BOUNTY_APPROVAL: true,
  REQUIRE_SENTIMENT_CHECK: true,
  ENFORCE_MARKETING_HOURS: true,
  EMERGENCY_PAUSE: false
};

const stringRules: Record<string, string> = {
  REQUIRED_TAG: "#bounty",
  ALERT_WEBHOOK: process.env.DISCORD_WEBHOOK_URL || "",
  EMERGENCY_SAFE_ADDR: process.env.EMERGENCY_SAFE_ADDRESS || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-1.5-pro",
  AGENT_VERSION: "v1.0.0-non-upgradeable",
  PHAROS_RPC_URL: process.env.PHAROS_WS_URL || process.env.PHAROS_RPC_URL || "wss://rpc.pharos.testnet/ws"
};

function loadDeployment(chainId: bigint) {
  const explicit = process.env.DEPLOYMENT_FILE;
  const file = explicit || path.join(__dirname, "..", "deployments", `${Number(chainId)}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment file not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const deployment = loadDeployment(network.chainId);
  const ruleEngine = await ethers.getContractAt("RuleEngine", deployment.ruleEngine, signer);
  const paymentRouter = await ethers.getContractAt("AgentPaymentRouter", deployment.agentPaymentRouter, signer);

  console.log(`Setting rules with ${signer.address}`);
  for (const [name, value] of Object.entries(numericRules)) {
    await (await ruleEngine.setNumericRule(ethers.id(name), value)).wait();
    console.log(`numeric ${name}=${value}`);
  }
  for (const [name, value] of Object.entries(boolRules)) {
    await (await ruleEngine.setBoolRule(ethers.id(name), value)).wait();
    console.log(`bool ${name}=${value}`);
  }
  for (const [name, value] of Object.entries(stringRules)) {
    await (await ruleEngine.setStringRule(ethers.id(name), value)).wait();
    console.log(`string ${name}=${value}`);
  }

  const sampleAgent = process.env.SAMPLE_AGENT_ADDRESS;
  if (sampleAgent) {
    await (
      await paymentRouter.registerAgent(
        sampleAgent,
        process.env.SAMPLE_AGENT_NAME || "Demo Agent",
        process.env.SAMPLE_AGENT_METADATA_URI || "ipfs://demo-agent",
        ethers.parseEther(process.env.SAMPLE_AGENT_DAILY_LIMIT_PROS || "25")
      )
    ).wait();
    console.log(`Registered sample agent ${sampleAgent}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
