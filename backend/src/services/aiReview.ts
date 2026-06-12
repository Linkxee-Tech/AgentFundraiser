import { config } from "../config.js";
import { recordReview } from "./storage.js";

export type ReviewResult = {
  score: number;
  recommend: "approve" | "review" | "reject";
  reasoning: string;
};

export type ReviewContext = {
  bountyId: string;
  submissionIndex: number;
  submitter: string;
};

let windowStartedAt = Date.now();
let requestsInWindow = 0;

function enforceRateLimit() {
  const now = Date.now();
  if (now - windowStartedAt >= 60 * 60 * 1000) {
    windowStartedAt = now;
    requestsInWindow = 0;
  }
  if (requestsInWindow >= config.aiRateLimitPerHour) {
    throw new Error("PVE rate limit exceeded; manual review required");
  }
  requestsInWindow += 1;
}

function buildPrompt(description: string, proof: string) {
  return `You are the Pharos Verification Engine (PVE), an internal bounty-review role for Agent Fundraiser.

Evaluate whether the submitted work satisfies the bounty.

Return strict JSON only:
{"score":0-100,"recommend":"approve|review|reject","reasoning":"short evidence-based explanation"}

Bounty:
${description.slice(0, config.aiMaxProofChars)}

Submission proof:
${proof.slice(0, config.aiMaxProofChars)}`;
}

function parseReview(text: string): ReviewResult {
  const jsonText = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(jsonText) as ReviewResult;
  const score = Math.max(0, Math.min(100, Number(parsed.score)));
  const recommend = ["approve", "review", "reject"].includes(parsed.recommend) ? parsed.recommend : "review";
  return {
    score,
    recommend: recommend as ReviewResult["recommend"],
    reasoning: String(parsed.reasoning || "PVE returned no reasoning.").slice(0, 1000)
  };
}

async function callGemini(description: string, proof: string) {
  if (!config.geminiApiKey) {
    return { score: 0, recommend: "review", reasoning: "PVE is in manual fallback because GEMINI_API_KEY is not configured." } satisfies ReviewResult;
  }

  enforceRateLimit();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(description, proof) }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`PVE Gemini request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("PVE Gemini response did not include review text");
  return parseReview(text);
}

export async function reviewSubmission(description: string, proof: string, context?: ReviewContext): Promise<ReviewResult> {
  if (config.aiMode === "manual") {
    return { score: 0, recommend: "review", reasoning: "Manual review mode is enabled." };
  }

  const result = await callGemini(description, proof);
  if (context) {
    await recordReview({
      bountyId: context.bountyId,
      submissionIndex: context.submissionIndex,
      submitter: context.submitter,
      score: result.score,
      recommendation: result.recommend,
      reasoning: result.reasoning
    });
  }
  return result;
}
