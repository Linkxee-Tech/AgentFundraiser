import { task } from "hardhat/config";
import fs from "fs";
import path from "path";

function deployment(chainId: bigint) {
  const file = process.env.DEPLOYMENT_FILE || path.join(__dirname, "..", "deployments", `${Number(chainId)}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment file not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

task("seed", "Seeds Agent Fundraiser demo data on the selected network").setAction(async (_, hre) => {
  const { ethers } = hre;
  const [signer, sampleAgent, submitter] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const d = deployment(network.chainId);

  const treasury = await ethers.getContractAt("TreasuryManager", d.treasuryManager, signer);
  const bounty = await ethers.getContractAt("BountyManager", d.bountyManager, signer);
  const router = await ethers.getContractAt("AgentPaymentRouter", d.agentPaymentRouter, signer);
  const rules = await ethers.getContractAt("RuleEngine", d.ruleEngine, signer);

  const treasurySeed = ethers.parseEther(process.env.SEED_TREASURY_PROS || "25");
  await (await treasury.deposit({ value: treasurySeed })).wait();
  console.log(`Deposited ${ethers.formatEther(treasurySeed)} PROS into treasury`);

  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const bountyReward = ethers.parseEther(process.env.SEED_BOUNTY_REWARD_PROS || "2");
  await (await bounty.createBounty(ethers.toUtf8Bytes("Create a Pharos Agent Fundraiser demo post #bounty"), deadline, { value: bountyReward })).wait();
  console.log(`Created bounty with ${ethers.formatEther(bountyReward)} PROS reward`);

  await (
    await router.registerAgent(
      sampleAgent.address,
      "Seed Monitoring Agent",
      "ipfs://seed-monitoring-agent",
      ethers.parseEther("10")
    )
  ).wait();
  console.log(`Registered sample agent ${sampleAgent.address}`);

  await (await rules.setBoolRule(ethers.id("ALLOW_AGENT_TO_AGENT_PAYMENTS"), true)).wait();
  await (await rules.setBoolRule(ethers.id("ALLOW_BOUNTY_PAYMENTS"), true)).wait();
  await (await rules.setNumericRule(ethers.id("MULTISIG_THRESHOLD"), ethers.parseEther("100"))).wait();
  console.log("Seeded core rules");

  if (process.env.SEED_SUBMISSION === "true") {
    await (
      await bounty.connect(submitter).submitWork(1, ethers.toUtf8Bytes("https://example.com/demo-proof #bounty"), {
        value: ethers.parseEther("1")
      })
    ).wait();
    console.log(`Submitted demo proof from ${submitter.address}`);
  }
});
