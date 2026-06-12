import { Contract, ethers } from "ethers";
import { RuleSet } from "./rules.js";
import { reviewSubmission } from "../services/aiReview.js";
import { log } from "../utils/logger.js";
import { config } from "../config.js";

const STATUS = {
  Open: 0,
  Submitted: 1
};

export async function processExpiredBounties(bountyManager: Contract) {
  const nextBountyId = Number(await bountyManager.nextBountyId());
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (let id = 1; id < nextBountyId; id++) {
    const bounty = await bountyManager.bounties(id);
    if ((Number(bounty.status) === STATUS.Open || Number(bounty.status) === STATUS.Submitted) && Number(bounty.deadline) < nowSeconds) {
      try {
        const tx = await bountyManager.expireAndRefund(id);
        log("info", "bounty_expire_submitted", `Expiring bounty ${id}`, { hash: tx.hash });
        await tx.wait();
      } catch (error) {
        log("warn", "bounty_expire_failed", `Could not expire bounty ${id}`, String(error));
      }
    }
  }
}

export async function reviewPendingSubmissions(bountyManager: Contract, rules: RuleSet) {
  if (rules.bool.REQUIRE_MANUAL_BOUNTY_APPROVAL || config.aiMode === "manual") return;
  const nextBountyId = Number(await bountyManager.nextBountyId());
  for (let bountyId = 1; bountyId < nextBountyId; bountyId++) {
    const bounty = await bountyManager.bounties(bountyId);
    if (Number(bounty.status) !== STATUS.Submitted) continue;
    const count = Number(await bountyManager.getSubmissionCount(bountyId));
    const description = ethers.toUtf8String(bounty.description);
    for (let index = 0; index < count; index++) {
      const submission = await bountyManager.getSubmission(bountyId, index);
      if (submission.approved || submission.rejected) continue;
      const proof = ethers.toUtf8String(submission.proof);
      const result = await reviewSubmission(description, proof, {
        bountyId: String(bountyId),
        submissionIndex: index,
        submitter: submission.submitter
      });
      log("info", "bounty_pve_review", `PVE reviewed bounty ${bountyId} submission ${index}`, result);
      if (result.recommend === "approve" && result.score >= config.minAiScore) {
        const tx = await bountyManager.approveBounty(bountyId, submission.submitter);
        log("info", "bounty_approve_submitted", `Approving bounty ${bountyId}`, { hash: tx.hash });
        await tx.wait();
        break;
      }
    }
  }
}
