import { expect } from "chai";
import { ethers } from "hardhat";

describe("TreasuryManager", function () {
  async function deployFixture() {
    const [owner, agent, user, safe, recipient] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("TreasuryManager");
    const treasury = await Treasury.deploy(agent.address, ethers.parseEther("10"), ethers.parseEther("2"));
    await treasury.waitForDeployment();
    return { owner, agent, user, safe, recipient, treasury };
  }

  it("accepts deposits and enforces agent-only withdrawals", async function () {
    const { agent, user, recipient, treasury } = await deployFixture();
    await expect(treasury.connect(user).deposit({ value: ethers.parseEther("5") }))
      .to.emit(treasury, "Deposited")
      .withArgs(user.address, ethers.parseEther("5"), ethers.ZeroAddress);

    await expect(treasury.connect(user).withdraw(recipient.address, ethers.parseEther("1"))).to.be.revertedWith(
      "TreasuryManager: caller is not agent"
    );

    await expect(treasury.connect(agent).withdraw(recipient.address, ethers.parseEther("1")))
      .to.emit(treasury, "Withdrawn")
      .withArgs(recipient.address, ethers.parseEther("1"), ethers.ZeroAddress);
  });

  it("blocks reserve floor and daily limit breaches", async function () {
    const { agent, user, recipient, treasury } = await deployFixture();
    await treasury.connect(user).deposit({ value: ethers.parseEther("5") });

    await expect(treasury.connect(agent).withdraw(recipient.address, ethers.parseEther("4"))).to.be.revertedWith(
      "TreasuryManager: reserve floor breach"
    );

    await treasury.connect(agent).setReserveFloor(0);
    await treasury.connect(agent).setDailyLimit(ethers.parseEther("1"));
    await expect(treasury.connect(agent).withdraw(recipient.address, ethers.parseEther("2"))).to.be.revertedWith(
      "TreasuryManager: daily limit exceeded"
    );
  });

  it("supports emergency pause and safe withdrawal", async function () {
    const { agent, user, safe, treasury } = await deployFixture();
    await treasury.connect(user).deposit({ value: ethers.parseEther("3") });
    await treasury.connect(agent).setEmergencySafeAddress(safe.address);
    await treasury.connect(agent).setEmergencyPause(true);

    await expect(treasury.connect(agent).withdrawAll())
      .to.emit(treasury, "Withdrawn")
      .withArgs(safe.address, ethers.parseEther("3"), ethers.ZeroAddress);
  });

  it("queues large withdrawals for agent and owner approval", async function () {
    const { owner, agent, user, recipient, treasury } = await deployFixture();
    await treasury.connect(user).deposit({ value: ethers.parseEther("10") });
    await treasury.connect(owner).setMultiSigThreshold(ethers.parseEther("3"));

    await expect(treasury.connect(agent).withdraw(recipient.address, ethers.parseEther("3"))).to.be.revertedWith(
      "TreasuryManager: large withdrawal requires request"
    );

    await expect(treasury.connect(agent).submitWithdrawalRequest(recipient.address, ethers.parseEther("3")))
      .to.emit(treasury, "WithdrawalRequestSubmitted");
    await expect(treasury.connect(owner).approveRequest(1)).to.emit(treasury, "WithdrawalRequestApproved");
    await expect(treasury.connect(owner).executeRequest(1)).to.emit(treasury, "WithdrawalRequestExecuted");
  });
});
