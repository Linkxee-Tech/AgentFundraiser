import { expect } from "chai";
import { ethers } from "hardhat";

describe("RuleEngine", function () {
  it("seeds defaults and restricts updates to agent or owner", async function () {
    const [owner, agent, other] = await ethers.getSigners();
    const RuleEngine = await ethers.getContractFactory("RuleEngine");
    const rules = await RuleEngine.deploy(agent.address);
    await rules.waitForDeployment();

    expect(await rules.getNumericRule(ethers.id("MAX_DAILY_SPEND_PERCENT"))).to.equal(20);
    expect(await rules.getBoolRule(ethers.id("ALLOW_BOUNTY_PAYMENTS"))).to.equal(true);
    expect(await rules.getStringRule(ethers.id("AGENT_VERSION"))).to.equal("v1.0.0-non-upgradeable");

    await expect(rules.connect(other).setNumericRule(ethers.id("X"), 1)).to.be.revertedWith("RuleEngine: caller is not authorized");
    await expect(rules.connect(agent).setNumericRule(ethers.id("X"), 42)).to.emit(rules, "RuleCreated");
    expect(await rules.getNumericRule(ethers.id("X"))).to.equal(42);
    await expect(rules.connect(owner).setNumericRule(ethers.id("X"), 100)).to.emit(rules, "RuleChanged");
    await expect(rules.connect(owner).deleteNumericRule(ethers.id("X"))).to.emit(rules, "RuleDeleted");
  });
});
