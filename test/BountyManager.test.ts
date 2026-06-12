import { expect } from "chai";
import { ethers } from "hardhat";

describe("BountyManager", function () {
  async function deployFixture() {
    const [owner, agent, submitter, other] = await ethers.getSigners();
    const Bounty = await ethers.getContractFactory("BountyManager");
    const bounty = await Bounty.deploy(agent.address, ethers.parseEther("1"));
    await bounty.waitForDeployment();
    return { owner, agent, submitter, other, bounty };
  }

  it("creates native bounties and accepts one submission per user", async function () {
    const { agent, submitter, bounty } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await expect(
      bounty.connect(agent).createBounty(ethers.toUtf8Bytes("write a thread #bounty"), deadline, {
        value: ethers.parseEther("5")
      })
    ).to.emit(bounty, "BountyCreated");

    await expect(
      bounty.connect(submitter).submitWork(1, ethers.toUtf8Bytes("ipfs://proof"), { value: ethers.parseEther("1") })
    ).to.emit(bounty, "WorkSubmitted");

    await expect(
      bounty.connect(submitter).submitWork(1, ethers.toUtf8Bytes("ipfs://proof2"), { value: ethers.parseEther("1") })
    ).to.be.revertedWith("BountyManager: duplicate submission");
  });

  it("approves a submitted bounty and pays the winner", async function () {
    const { agent, submitter, bounty } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    await bounty.connect(agent).createBounty(ethers.toUtf8Bytes("build demo"), deadline, { value: ethers.parseEther("5") });
    await bounty.connect(submitter).submitWork(1, ethers.toUtf8Bytes("https://demo"), { value: ethers.parseEther("1") });

    await expect(() => bounty.connect(agent).approveBounty(1, submitter.address)).to.changeEtherBalances(
      [submitter, bounty],
      [ethers.parseEther("6"), ethers.parseEther("-6")]
    );
  });

  it("cancels before submissions and expires after deadline", async function () {
    const { agent, bounty } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    await bounty.connect(agent).createBounty(ethers.toUtf8Bytes("cancel me"), deadline, { value: ethers.parseEther("2") });
    await expect(bounty.connect(agent).cancelBounty(1)).to.emit(bounty, "BountyCancelled");

    await bounty.connect(agent).createBounty(ethers.toUtf8Bytes("expire me"), deadline, { value: ethers.parseEther("2") });
    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine", []);
    await expect(bounty.connect(agent).expireAndRefund(2)).to.emit(bounty, "BountyExpired");
  });
});
