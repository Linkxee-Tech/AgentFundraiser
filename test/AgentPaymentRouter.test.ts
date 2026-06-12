import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("AgentPaymentRouter", function () {
  async function deployFixture() {
    const [owner, agent, recipient, approver, donor] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("TreasuryManager");
    const treasury = await Treasury.deploy(agent.address, ethers.parseEther("1000"), 0);
    await treasury.waitForDeployment();

    const Router = await ethers.getContractFactory("AgentPaymentRouter");
    const router = await Router.deploy(agent.address, await treasury.getAddress(), ethers.parseEther("100"));
    await router.waitForDeployment();

    await treasury.connect(owner).setAgent(await router.getAddress());
    await router.connect(owner).setApprover(approver.address);
    await treasury.connect(donor).deposit({ value: ethers.parseEther("500") });

    return { owner, agent, recipient, approver, donor, treasury, router };
  }

  it("registers active agents and pays through treasury", async function () {
    const { agent, recipient, router } = await deployFixture();
    await router.connect(agent).registerAgent(recipient.address, "Analytics Agent", "ipfs://analytics", ethers.parseEther("20"));

    await expect(router.connect(agent).payAgent(recipient.address, ethers.parseEther("5"), "daily report", ethers.ZeroAddress))
      .to.emit(router, "AgentPayment")
      .withArgs(agent.address, recipient.address, ethers.parseEther("5"), "daily report", anyValue, ethers.ZeroAddress);
  });

  it("queues large payments and requires approver", async function () {
    const { agent, recipient, approver, router } = await deployFixture();
    await router.connect(agent).registerAgent(recipient.address, "Research Agent", "ipfs://research", ethers.parseEther("200"));

    await expect(router.connect(agent).payAgent(recipient.address, ethers.parseEther("100"), "large", ethers.ZeroAddress))
      .to.emit(router, "PaymentQueued");

    await expect(router.connect(agent).approvePayment(1)).to.be.revertedWith("AgentPaymentRouter: caller is not approver");
    await expect(router.connect(approver).approvePayment(1)).to.emit(router, "PaymentApproved");
  });

  it("prevents duplicate idempotency keys", async function () {
    const { agent, recipient, router } = await deployFixture();
    await router.connect(agent).registerAgent(recipient.address, "Ops Agent", "ipfs://ops", ethers.parseEther("20"));
    const key = ethers.id("scheduled:1");
    await router.connect(agent).payAgentWithIdempotency(recipient.address, ethers.parseEther("1"), "first", ethers.ZeroAddress, key);
    await expect(
      router.connect(agent).payAgentWithIdempotency(recipient.address, ethers.parseEther("1"), "again", ethers.ZeroAddress, key)
    ).to.be.revertedWith("AgentPaymentRouter: duplicate payment key");
  });
});
