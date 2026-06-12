import { config } from "../config.js";

export type ReviewResult = {
  score: number;
  recommend: "approve" | "review" | "reject";
  reasoning: string;
};

export async function reviewSubmission(description: string, proof: string): Promise<ReviewResult> {
  if (config.aiMode === "manual") {
    return { score: 0, recommend: "review", reasoning: "Manual review mode is enabled." };
  }

  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    return { score: 50, recommend: "review", reasoning: "No AI key configured; human confirmation required." };
  }

  const normalized = `${description}\n${proof}`.toLowerCase();
  const hasUsefulProof = proof.length > 10 && /(https?:\/\/|ipfs:\/\/|github|twitter|x\.com|report|demo|thread)/i.test(proof);
  const score = Math.min(95, Math.max(35, hasUsefulProof ? 82 : 55) + (normalized.includes("#bounty") ? 5 : 0));
  return {
    score,
    recommend: score >= config.minAiScore ? "approve" : "review",
    reasoning: "Heuristic AI placeholder scored proof relevance, link presence, and required tag until a provider adapter is configured."
  };
}
