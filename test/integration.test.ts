import { expect } from "chai";
import { ethers } from "hardhat";

describe("Agent Fundraiser integration", function () {
  it("runs deposit, bounty, submission, approval, agent payment, and multisig queue", async function () {
    const [owner, agent, donor, submitter, worker, approver] = await ethers.getSigners();

    const Treasury = await ethers.getContractFactory("TreasuryManager");
    const treasury = await Treasury.deploy(agent.address, ethers.parseEther("1000"), ethers.parseEther("10"));
    await treasury.waitForDeployment();

    const Bounty = await ethers.getContractFactory("BountyManager");
    const bounty = await Bounty.deploy(agent.address, ethers.parseEther("1"));
    await bounty.waitForDeployment();

    const Rules = await ethers.getContractFactory("RuleEngine");
    const rules = await Rules.deploy(agent.address);
    await rules.waitForDeployment();

    const Router = await ethers.getContractFactory("AgentPaymentRouter");
    const router = await Router.deploy(agent.address, await treasury.getAddress(), ethers.parseEther("50"));
    await router.waitForDeployment();

    await treasury.connect(owner).setAgent(await router.getAddress());
    await router.connect(owner).setApprover(approver.address);

    await expect(treasury.connect(donor).deposit({ value: ethers.parseEther("100") })).to.emit(treasury, "Deposited");

    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = Number(latestBlock!.timestamp) + 3600;
    await expect(bounty.connect(agent).createBounty(ethers.toUtf8Bytes("make a demo #bounty"), deadline, { value: ethers.parseEther("5") }))
      .to.emit(bounty, "BountyCreated");
    await expect(bounty.connect(submitter).submitWork(1, ethers.toUtf8Bytes("https://example.com/demo"), { value: ethers.parseEther("1") }))
      .to.emit(bounty, "WorkSubmitted");
    await expect(bounty.connect(agent).approveBounty(1, submitter.address)).to.emit(bounty, "BountyApproved");

    await router.connect(agent).registerAgent(worker.address, "Monitoring Agent", "ipfs://monitor", ethers.parseEther("100"));
    await expect(router.connect(agent).payAgent(worker.address, ethers.parseEther("5"), "monitoring", ethers.ZeroAddress))
      .to.emit(router, "AgentPayment");
    await expect(router.connect(agent).payAgent(worker.address, ethers.parseEther("50"), "large monitoring", ethers.ZeroAddress))
      .to.emit(router, "PaymentQueued");

    expect(await rules.getBoolRule(ethers.id("ALLOW_AGENT_TO_AGENT_PAYMENTS"))).to.equal(true);
  });
});
