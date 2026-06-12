import http from "http";
import { Contract, JsonRpcProvider, Wallet, WebSocketProvider } from "ethers";
import { config, requireConfig } from "./config.js";
import { treasuryAbi, bountyAbi, paymentAbi, ruleAbi } from "./abis.js";
import { fetchRules } from "./skills/rules.js";
import { getTreasurySnapshot } from "./skills/treasury.js";
import { processExpiredBounties, reviewPendingSubmissions } from "./skills/bounty.js";
import { runDuePayments } from "./services/scheduler.js";
import { sendAlert } from "./services/alerts.js";
import { initStorage } from "./services/storage.js";
import { log } from "./utils/logger.js";
import { readJson, writeJson } from "./utils/jsonStore.js";

type AgentState = {
  startedAt: string;
  lastLoopAt?: string;
  loops: number;
  status: "starting" | "healthy" | "degraded";
  lastError?: string;
};

requireConfig();

const provider = config.wsUrl ? new WebSocketProvider(config.wsUrl) : new JsonRpcProvider(config.rpcUrl);
const wallet = new Wallet(config.privateKey, provider);
const treasury = new Contract(config.contracts.treasuryManager, treasuryAbi, wallet);
const bountyManager = new Contract(config.contracts.bountyManager, bountyAbi, wallet);
const paymentRouter = new Contract(config.contracts.agentPaymentRouter, paymentAbi, wallet);
const ruleEngine = new Contract(config.contracts.ruleEngine, ruleAbi, wallet);

let state = readJson<AgentState>(config.stateFile, {
  startedAt: new Date().toISOString(),
  loops: 0,
  status: "starting"
});

function saveState(next: Partial<AgentState>) {
  state = { ...state, ...next };
  writeJson(config.stateFile, state);
}

function startHealthServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(state.status === "healthy" ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...state, wallet: wallet.address }, null, 2));
  });
  server.listen(config.healthPort, () => log("info", "health", `Health endpoint listening on ${config.healthPort}`));
}

function attachEventListeners() {
  treasury.on("Deposited", (from, amount, token, event) => {
    log("info", "deposit", "Treasury deposit observed", { from, amount: amount.toString(), token, txHash: event.log.transactionHash });
  });
  treasury.on("Withdrawn", (to, amount, token, event) => {
    log("info", "withdrawal", "Treasury withdrawal observed", { to, amount: amount.toString(), token, txHash: event.log.transactionHash });
  });
  bountyManager.on("WorkSubmitted", (bountyId, submitter, proof, event) => {
    log("info", "work_submitted", "Bounty submission observed", {
      bountyId: bountyId.toString(),
      submitter,
      proof,
      txHash: event.log.transactionHash
    });
  });
  bountyManager.on("BountyApproved", (bountyId, winner, amount, token, event) => {
    log("info", "bounty_approved", "Bounty approval observed", {
      bountyId: bountyId.toString(),
      winner,
      amount: amount.toString(),
      token,
      txHash: event.log.transactionHash
    });
  });
  paymentRouter.on("AgentPayment", (fromAgent, toAgent, amount, memo, timestamp, token, event) => {
    log("info", "agent_payment", "Agent payment observed", {
      fromAgent,
      toAgent,
      amount: amount.toString(),
      memo,
      timestamp: timestamp.toString(),
      token,
      txHash: event.log.transactionHash
    });
  });
  paymentRouter.on("PaymentQueued", (paymentId, recipient, amount, token, key, event) => {
    log("warn", "payment_queued", "Large payment requires approval", {
      paymentId: paymentId.toString(),
      recipient,
      amount: amount.toString(),
      token,
      key,
      txHash: event.log.transactionHash
    });
  });
}

async function loopOnce() {
  const rules = await fetchRules(ruleEngine);
  const treasurySnapshot = await getTreasurySnapshot(treasury);
  await processExpiredBounties(bountyManager);
  await reviewPendingSubmissions(bountyManager, rules);
  await runDuePayments(paymentRouter, rules, treasurySnapshot.balance);
  saveState({ loops: state.loops + 1, lastLoopAt: new Date().toISOString(), status: "healthy", lastError: undefined });
}

async function main() {
  log("info", "startup", "Agent Fundraiser backend starting", { wallet: wallet.address });
  await initStorage();
  startHealthServer();
  attachEventListeners();

  while (true) {
    try {
      await loopOnce();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      saveState({ status: "degraded", lastError: message });
      log("error", "loop_failed", "Agent loop failed", message);
      await sendAlert("Agent Fundraiser loop failed", { message });
    }
    await new Promise((resolve) => setTimeout(resolve, config.loopIntervalMs));
  }
}

main().catch(async (error) => {
  log("error", "fatal", "Agent crashed", String(error));
  await sendAlert("Agent Fundraiser crashed", String(error));
  process.exit(1);
});
