import "dotenv/config";
import path from "path";

const dataDir = process.env.AGENT_DATA_DIR || path.join(process.cwd(), "data");

export const config = {
  rpcUrl: process.env.PHAROS_RPC_URL || "https://rpc.pharos.testnet",
  wsUrl: process.env.PHAROS_WS_URL || "",
  privateKey: process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
  healthPort: Number(process.env.HEALTH_PORT || "8787"),
  loopIntervalMs: Number(process.env.AGENT_LOOP_INTERVAL_MS || "5000"),
  confirmationBlocks: Number(process.env.CONFIRMATION_BLOCKS || "1"),
  aiMode: process.env.BOUNTY_REVIEW_MODE || "manual",
  minAiScore: Number(process.env.MIN_AI_APPROVAL_SCORE || "80"),
  aiProvider: process.env.AI_PROVIDER || "gemini",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-pro",
  aiRateLimitPerHour: Number(process.env.AI_RATE_LIMIT_PER_HOUR || "30"),
  aiMaxProofChars: Number(process.env.AI_MAX_PROOF_CHARS || "6000"),
  databaseUrl: process.env.DATABASE_URL || `sqlite:${path.join(dataDir, "agent.sqlite")}`,
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  dataDir,
  logsFile: process.env.AGENT_LOG_FILE || path.join(dataDir, "agent-log.json"),
  stateFile: process.env.AGENT_STATE_FILE || path.join(dataDir, "agent-state.json"),
  contracts: {
    treasuryManager: process.env.TREASURY_MANAGER_ADDRESS || "",
    bountyManager: process.env.BOUNTY_MANAGER_ADDRESS || "",
    agentPaymentRouter: process.env.AGENT_PAYMENT_ROUTER_ADDRESS || "",
    ruleEngine: process.env.RULE_ENGINE_ADDRESS || ""
  }
};

export function requireConfig() {
  if (!config.privateKey) {
    throw new Error("AGENT_PRIVATE_KEY or PRIVATE_KEY is required");
  }
  for (const [name, value] of Object.entries(config.contracts)) {
    if (!value) throw new Error(`${name} address is required`);
  }
}
