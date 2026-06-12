const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const SECP256K1_ORDER = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");

function isValidPrivateKey(privateKey) {
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return false;
  }

  const keyValue = BigInt(privateKey);
  return keyValue > 0n && keyValue < SECP256K1_ORDER;
}

function validateDeploymentKey() {
  if (network.name === "hardhat" || network.name === "localhost") {
    return;
  }

  if (!isValidPrivateKey(process.env.PRIVATE_KEY)) {
    throw new Error(
      "Set PRIVATE_KEY in .env to a funded Pharos deployer private key formatted as 0x followed by 64 hex characters."
    );
  }
}

async function main() {
  validateDeploymentKey();
  const [deployer] = await ethers.getSigners();
  const agentAddress = process.env.AGENT_ADDRESS || deployer.address;
  const emergencySafe = process.env.EMERGENCY_SAFE_ADDRESS || deployer.address;
  const dailyLimit = ethers.parseEther(process.env.DAILY_LIMIT_PROS || "1000");
  const reserveFloor = ethers.parseEther(process.env.RESERVE_FLOOR_PROS || "200");
  const submissionBond = ethers.parseEther(process.env.SUBMISSION_BOND_PROS || "1");
  const paymentMultiSigThreshold = ethers.parseEther(process.env.MULTISIG_THRESHOLD_PROS || "100");
  const treasuryMultiSigThreshold = ethers.parseEther(process.env.TREASURY_MULTISIG_THRESHOLD_PROS || "0");

  console.log(`Deploying Agent Fundraiser with ${deployer.address}`);
  console.log(`Agent address: ${agentAddress}`);

  const TreasuryManager = await ethers.getContractFactory("TreasuryManager");
  const treasuryManager = await TreasuryManager.deploy(agentAddress, dailyLimit, reserveFloor);
  await treasuryManager.waitForDeployment();

  const BountyManager = await ethers.getContractFactory("BountyManager");
  const bountyManager = await BountyManager.deploy(agentAddress, submissionBond);
  await bountyManager.waitForDeployment();

  const AgentPaymentRouter = await ethers.getContractFactory("AgentPaymentRouter");
  const agentPaymentRouter = await AgentPaymentRouter.deploy(
    agentAddress,
    await treasuryManager.getAddress(),
    paymentMultiSigThreshold
  );
  await agentPaymentRouter.waitForDeployment();

  const RuleEngine = await ethers.getContractFactory("RuleEngine");
  const ruleEngine = await RuleEngine.deploy(agentAddress);
  await ruleEngine.waitForDeployment();

  await (await treasuryManager.setEmergencySafeAddress(emergencySafe)).wait();
  if (treasuryMultiSigThreshold > 0n) {
    await (await treasuryManager.setMultiSigThreshold(treasuryMultiSigThreshold)).wait();
  }
  await (await treasuryManager.setAgent(await agentPaymentRouter.getAddress())).wait();

  const network = await ethers.provider.getNetwork();
  const addresses = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    agent: agentAddress,
    emergencySafe,
    treasuryManager: await treasuryManager.getAddress(),
    bountyManager: await bountyManager.getAddress(),
    agentPaymentRouter: await agentPaymentRouter.getAddress(),
    ruleEngine: await ruleEngine.getAddress()
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${addresses.chainId}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(addresses, null, 2));

  console.log("Deployed contracts:");
  console.table(addresses);
  console.log(`Saved deployment to ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
