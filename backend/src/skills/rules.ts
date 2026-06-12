import { Contract, ethers } from "ethers";

export type RuleSet = {
  numeric: Record<string, bigint>;
  bool: Record<string, boolean>;
  string: Record<string, string>;
};

export const RULE_KEYS = {
  numeric: [
    "MAX_DAILY_SPEND_PERCENT",
    "MIN_BALANCE_FOR_MARKETING",
    "MAX_SINGLE_BOUNTY_REWARD",
    "MULTISIG_THRESHOLD",
    "RESERVE_FLOOR",
    "SUBMISSION_BOND",
    "RATE_LIMIT_WINDOW_HOURS",
    "MARKETING_BUDGET_PERCENT",
    "COMMUNITY_BUDGET_PERCENT"
  ],
  bool: [
    "ALLOW_BOUNTY_PAYMENTS",
    "ALLOW_AGENT_TO_AGENT_PAYMENTS",
    "ALLOW_MARKETING_PAYMENTS",
    "ALLOW_COMMUNITY_PAYMENTS",
    "REQUIRE_MANUAL_BOUNTY_APPROVAL",
    "REQUIRE_SENTIMENT_CHECK",
    "ENFORCE_MARKETING_HOURS",
    "EMERGENCY_PAUSE"
  ],
  string: ["REQUIRED_TAG", "ALERT_WEBHOOK", "EMERGENCY_SAFE_ADDR", "GEMINI_MODEL", "AGENT_VERSION", "PHAROS_RPC_URL"]
};

export async function fetchRules(ruleEngine: Contract): Promise<RuleSet> {
  const numeric: Record<string, bigint> = {};
  const bool: Record<string, boolean> = {};
  const string: Record<string, string> = {};

  for (const key of RULE_KEYS.numeric) numeric[key] = await ruleEngine.getNumericRule(ethers.id(key));
  for (const key of RULE_KEYS.bool) bool[key] = await ruleEngine.getBoolRule(ethers.id(key));
  for (const key of RULE_KEYS.string) string[key] = await ruleEngine.getStringRule(ethers.id(key));

  return { numeric, bool, string };
}

export function canPayCategory(rules: RuleSet, category: string, treasuryBalance: bigint, amount: bigint) {
  if (rules.bool.EMERGENCY_PAUSE) return "Rule violation: emergency pause is active";
  if (category === "bounty" && !rules.bool.ALLOW_BOUNTY_PAYMENTS) return "Rule violation: bounty payments disabled";
  if (category === "a2a" && !rules.bool.ALLOW_AGENT_TO_AGENT_PAYMENTS) return "Rule violation: agent payments disabled";
  if (category === "community" && !rules.bool.ALLOW_COMMUNITY_PAYMENTS) return "Rule violation: community payments disabled";
  if (category === "marketing") {
    if (!rules.bool.ALLOW_MARKETING_PAYMENTS) return "Rule violation: marketing payments disabled";
    const hour = new Date().getUTCHours();
    if (rules.bool.ENFORCE_MARKETING_HOURS && (hour < 9 || hour >= 17)) {
      return "Rule violation: marketing payments allowed only between 09:00 and 17:00 UTC";
    }
    if (treasuryBalance < rules.numeric.MIN_BALANCE_FOR_MARKETING) {
      return "Rule violation: treasury below marketing minimum";
    }
  }
  const maxPercent = rules.numeric.MAX_DAILY_SPEND_PERCENT || 0n;
  if (maxPercent > 0n && treasuryBalance > 0n && amount > (treasuryBalance * maxPercent) / 100n) {
    return "Rule violation: payment exceeds max daily spend percent";
  }
  return null;
}
