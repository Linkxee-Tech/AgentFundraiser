# Agent Fundraiser — Pharos Skill-to-Agent Hackathon

> An autonomous on-chain community treasury agent built on the Pharos blockchain. Receives donations, creates bounties, pays other agents, and enforces spending rules — all transparently on-chain.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Features Implemented](#features-implemented)
- [Project Structure](#project-structure)
- [Frontend Setup](#frontend-setup)
- [Tech Stack](#tech-stack)
- [Smart Contract Skills (Phase 1)](#smart-contract-skills-phase-1)
- [Off-chain Agent Brain (Phase 2)](#off-chain-agent-brain-phase-2)
- [Role Separation](#role-separation)
- [Rule Engine](#rule-engine)
- [Multi-Token Support](#multi-token-support)
- [Multi-Sig Approval](#multi-sig-approval)
- [Security Design](#security-design)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Testing](#testing)
- [Demo Flow](#demo-flow)

---

## Architecture Overview

```
[User / Bot] ─── tip / donate PROS / USDC-P / ETH-P ──▶ [Agent Fundraiser]
                                                              │
                                              ┌───────────────▼───────────────┐
                                              │         Rule Engine           │
                                              │  (guardrails before every tx) │
                                              └───────────┬───────────────────┘
                                                          │
                          ┌───────────────────┬───────────┴──────────────┐
                          ▼                   ▼                          ▼
                 ┌────────────────┐  ┌────────────────┐        ┌─────────────────┐
                 │ Treasury Mgr   │  │  Bounty Mgr    │        │ Payment Router  │
                 │ (multi-token)  │  │  (multi-sub,   │        │ (A2A, scheduled,│
                 │ reserve floor  │  │   AI review)   │        │  idempotency)   │
                 └────────────────┘  └────────────────┘        └─────────────────┘
                          │                   │                          │
                          └───────────────────┴──────────────────────────┘
                                              │
                                     On-chain events
                                              │
                                              ▼
                                 [Off-chain Agent Brain]
                              Node.js / TypeScript process
                              listens → decides → executes
                                              │
                                              ▼
                                  [React Frontend Dashboard]
                              8 tabs: Overview / Treasury / Bounties /
                              Payments / Rule Engine / Admin / Audit / Commands
```

---

## Features Implemented

### ✅ All Prompt Requirements

| Feature | Status |
|---|---|
| Treasury Manager (deposit, withdraw, balance, events) | ✅ |
| Multi-token treasury (PROS + USDC-P + ETH-P) | ✅ |
| Reserve floor — treasury minimum that cannot be spent | ✅ |
| Daily withdrawal limit with reset | ✅ |
| Emergency pause and emergency withdrawal | ✅ |
| Bounty Manager (create, submit, approve, reject, expire, cancel) | ✅ |
| Multi-submission per bounty | ✅ |
| Duplicate submission prevention (anti-spam) | ✅ |
| Submission bond (anti-spam, refundable) | ✅ |
| Extend deadline, update reward, cancel bounty | ✅ |
| Gemini AI review (manual / AI / hybrid modes) | ✅ |
| Sentiment check on submissions | ✅ |
| Agent Payment Router (register, pay, revoke, per-agent limits) | ✅ |
| Payment categories: bounty / A2A / marketing / community / other | ✅ |
| Scheduled payments with idempotency protection | ✅ |
| Marketing payment window enforcement (09:00–17:00 UTC) | ✅ |
| Rate-limit rule (cooldown between payouts to same address) | ✅ |
| Rule Engine — numeric, boolean, and string rules | ✅ |
| Multi-sig approval for large payments (above threshold) | ✅ |
| Role separation: Owner / Agent / Verifier / User | ✅ |
| Emergency controls (Owner-only pause/resume) | ✅ |
| Audit log with filtering and search | ✅ |
| Real-time agent terminal (live event feed) | ✅ |
| Notification bell with unread count | ✅ |
| Command console (/tip, /balance, /create_bounty, etc.) | ✅ |
| Agent health monitor | ✅ |
| Version declared as non-upgradeable | ✅ |

---

## Project Structure

```
agent-fundraiser/
├── frontend/                    # React dashboard (this package)
│   ├── src/
│   │   ├── App.jsx              # Full dashboard (all 8 tabs)
│   │   └── main.jsx             # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── contracts/                   # Solidity smart contracts (Phase 1)
│   ├── TreasuryManager.sol      # Skill 1: multi-token, daily limits, reserve floor
│   ├── BountyManager.sol        # Skill 2: multi-submission, escrow, AI-assisted
│   ├── AgentPaymentRouter.sol   # Skill 3: A2A payments, per-agent limits
│   └── RuleEngine.sol           # Skill 4: numeric / bool / string rules
│
├── agent/                       # Off-chain agent brain (Phase 2)
│   ├── index.ts                 # Main agent loop
│   ├── skills/
│   │   ├── treasury.ts          # Treasury skill interface
│   │   ├── bounty.ts            # Bounty skill interface
│   │   ├── payments.ts          # Payment routing
│   │   └── rules.ts             # Rule evaluation
│   ├── services/
│   │   ├── gemini.ts            # Gemini AI review integration
│   │   ├── scheduler.ts         # Scheduled payment executor
│   │   └── alerts.ts            # Telegram / Discord webhook alerts
│   └── utils/
│       ├── nonce.ts             # Nonce management for reliability
│       └── gas.ts               # Gas price adjustment
│
├── scripts/                     # Hardhat deployment scripts
│   ├── deploy.ts                # Deploy all 4 Skills
│   ├── setup.ts                 # Initialize agent address and rules
│   └── verify.ts                # Verify contracts on Pharos explorer
│
├── test/                        # Unit and integration tests
│   ├── TreasuryManager.test.ts
│   ├── BountyManager.test.ts
│   ├── AgentPaymentRouter.test.ts
│   ├── RuleEngine.test.ts
│   └── integration.test.ts      # Full flow: deposit → bounty → approve → pay
│
├── .env.example                 # Environment variable template
├── hardhat.config.ts
└── README.md
```

---

## Frontend Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Install and run

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Build for production

```bash
npm run build
npm run preview
```

### Wallet-derived roles

Roles are derived from the connected wallet and the deployed contract role getters:

| Role | Access Level |
|---|---|
| Owner | Full access — rules, emergency, multi-sig, treasury |
| Agent | Operational — bounties, payments, agents |
| Verifier | Review — AI review, flag submissions |
| User | Public — deposit, submit work, view state |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.x + OpenZeppelin |
| Contract Tooling | Hardhat + ethers.js v6 |
| Blockchain | Pharos Testnet |
| Off-chain Agent | TypeScript / Node.js |
| AI Review | Google Gemini 1.5 Pro API |
| Frontend | React 18 + Vite |
| Web3 Integration | ethers.js v6 |
| Process Manager | PM2 |
| Alerts | Discord Webhook / Telegram Bot API |

---

## Smart Contract Skills (Phase 1)

### Skill 1: TreasuryManager.sol

```solidity
// Key interface
function deposit() external payable;
function depositERC20(address token, uint256 amount) external;
function withdraw(address to, uint256 amount) external onlyAgent;
function withdrawERC20(address token, address to, uint256 amount) external onlyAgent;
function withdrawAll() external onlyAgent emergencyOnly;
function balance() external view returns (uint256);
function setDailyLimit(uint256 newLimit) external onlyAgent;
function setEmergencyPause(bool paused) external onlyAgent;
function setReserveFloor(uint256 floor) external onlyAgent;
function setEmergencyWithdrawAddress(address safeAddress) external onlyAgent;

event Deposited(address indexed from, uint256 amount, address token);
event Withdrawn(address indexed to, uint256 amount, address token);
```

**Security:** `ReentrancyGuard`, `onlyAgent` modifier, daily spend tracking with timestamp reset, reserve floor enforcement.

### Skill 2: BountyManager.sol

```solidity
function createBounty(string calldata description, uint256 reward, uint256 deadline) external onlyAgent;
function submitWork(uint256 bountyId, bytes calldata proof) external;
function approveBounty(uint256 bountyId, address winner) external onlyAgent;
function rejectBounty(uint256 bountyId, bytes32 submissionId) external onlyAgent;
function expireAndRefund(uint256 bountyId) external onlyAgent;
function cancelBounty(uint256 bountyId) external onlyAgent;
function extendDeadline(uint256 bountyId, uint256 newDeadline) external onlyAgent;
function updateReward(uint256 bountyId, uint256 newAmount) external onlyAgent;

mapping(uint256 => Bounty) public bounties;
mapping(uint256 => Submission[]) public submissions;
```

**Anti-spam:** Requires a small submission bond. Bond is refunded on approval, 50% forfeited on rejection.

### Skill 3: AgentPaymentRouter.sol

```solidity
function registerAgent(address agentAddr, string calldata name, string calldata metadataURI) external onlyAgent;
function updateAgentStatus(address agentAddr, bool isActive) external onlyAgent;
function setAgentDailyLimit(address agentAddr, uint256 limit) external onlyAgent;
function payAgent(address recipient, uint256 amount, string calldata memo) external onlyAgent;
function getAgentInfo(address agentAddr) external view returns (AgentInfo memory);
function listAgents(uint256 offset, uint256 limit) external view returns (AgentInfo[] memory);

event AgentPayment(address indexed from, address indexed to, uint256 amount, string memo, uint256 timestamp);
```

### Skill 4: RuleEngine.sol

```solidity
function setNumericRule(bytes32 key, uint256 value) external onlyAgent;
function setBoolRule(bytes32 key, bool value) external onlyAgent;
function setStringRule(bytes32 key, string calldata value) external onlyAgent;
function getNumericRule(bytes32 key) external view returns (uint256);
function getBoolRule(bytes32 key) external view returns (bool);
function getStringRule(bytes32 key) external view returns (string memory);

mapping(bytes32 => uint256) public numericRules;
mapping(bytes32 => bool) public boolRules;
mapping(bytes32 => string) public stringRules;
```

---

## Off-chain Agent Brain (Phase 2)

### Core Loop (agent/index.ts)

```typescript
while (true) {
  // 1. Read latest rules from RuleEngine contract
  const rules = await ruleEngine.fetchAllRules();

  // 2. Check for new deposits
  const deposits = await treasury.getNewDeposits(lastBlock);

  // 3. Scan open bounties for expired ones — auto-refund
  await bountySkill.processExpiredBounties(rules);

  // 4. Review new bounty submissions
  const pending = await bountySkill.getPendingSubmissions();
  for (const sub of pending) {
    const decision = await geminiReview(sub, rules); // Gemini 1.5 Pro
    if (decision.approve && !rules.REQUIRE_MANUAL_BOUNTY_APPROVAL) {
      await bountySkill.approveBounty(sub.bountyId, sub.submitter);
    }
  }

  // 5. Execute scheduled payments (with idempotency check)
  await scheduler.runDuePayments(rules, treasury);

  // 6. Validate each action against Rule Engine
  // 7. Execute approved transactions with nonce management
  // 8. Log all actions + send webhook alerts if needed
  // 9. Sleep 5 seconds and repeat

  await sleep(5000);
}
```

### Gemini AI Review (agent/services/gemini.ts)

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

async function reviewBountySubmission(task: string, proof: string): Promise<ReviewResult> {
  const prompt = `
    You are a smart contract bounty verifier. 
    Task description: "${task}"
    Submitted proof: "${proof}"
    
    Evaluate if the submission matches the task requirements.
    Respond ONLY with JSON: { score: 0-100, recommend: "approve"|"review"|"reject", reasoning: "..." }
  `;
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
```

---

## Role Separation

| Permission | Owner | Agent | Verifier | User |
|---|:---:|:---:|:---:|:---:|
| Set rules | ✅ | ❌ | ❌ | ❌ |
| Emergency pause | ✅ | ❌ | ❌ | ❌ |
| Multi-sig approve | ✅ | ❌ | ❌ | ❌ |
| Set reserve floor | ✅ | ❌ | ❌ | ❌ |
| Create bounties | ✅ | ✅ | ❌ | ❌ |
| Approve/reject submissions | ✅ | ✅ | ❌ | ❌ |
| Pay agents | ✅ | ✅ | ❌ | ❌ |
| Register agents | ✅ | ✅ | ❌ | ❌ |
| Run Gemini AI review | ✅ | ✅ | ✅ | ❌ |
| Deposit funds | ✅ | ✅ | ✅ | ✅ |
| Submit bounty work | ✅ | ✅ | ✅ | ✅ |
| View all activity | ✅ | ✅ | ✅ | ✅ |

---

## Rule Engine

### Default Rules

| Key | Type | Default | Description |
|---|---|---|---|
| MAX_DAILY_SPEND_PERCENT | numeric | 20 | Max % of treasury spendable per day |
| MIN_BALANCE_FOR_MARKETING | numeric | 500 | Min PROS before marketing unlocks |
| MAX_SINGLE_BOUNTY_REWARD | numeric | 500 | Cap per bounty (PROS) |
| MULTISIG_THRESHOLD | numeric | 100 | Payments above this need 2-of-2 approval |
| RESERVE_FLOOR | numeric | 200 | Minimum PROS permanently locked |
| SUBMISSION_BOND | numeric | 1 | Anti-spam bond per submission |
| RATE_LIMIT_WINDOW_HOURS | numeric | 24 | Cooldown between payouts to same address |
| ALLOW_BOUNTY_PAYMENTS | bool | true | Enable/disable bounty payouts |
| ALLOW_AGENT_TO_AGENT_PAYMENTS | bool | true | Enable/disable A2A payments |
| ALLOW_MARKETING_PAYMENTS | bool | true | Enable/disable marketing spend |
| ENFORCE_MARKETING_HOURS | bool | true | Restrict marketing to 09:00–17:00 UTC |
| EMERGENCY_PAUSE | bool | false | Halt all outgoing payments |
| REQUIRE_SENTIMENT_CHECK | bool | true | Run Gemini NLP on social submissions |
| REQUIRED_TAG | string | #pharos | Required hashtag in social bounties |
| GEMINI_MODEL | string | gemini-1.5-pro | AI model for bounty review |
| AGENT_VERSION | string | v1.0.0-non-upgradeable | Version (non-upgradeable by design) |
| PHAROS_RPC_URL | string | wss://rpc.pharos.testnet/ws | WebSocket RPC endpoint |

---

## Multi-Token Support

The treasury tracks three tokens independently:

| Token | Symbol | Type | Notes |
|-------|--------|------|-------|
| Pharos Native | PROS | Native | Primary governance + payment token |
| Pharos USDC | USDC-P | ERC-20 | Stable value payments |
| Pharos ETH | ETH-P | ERC-20 | Bridge wrapped ETH |

- Reserve floor applies to PROS only
- Daily spend cap applies to PROS only
- Bounties and payments can be denominated in any token
- Multi-sig threshold applies to PROS payments

---

## Multi-Sig Approval

Payments of **100 PROS or more** are automatically routed to the multi-sig queue. Both Agent and Owner must sign before execution.

```
Request created by Agent
    │
    ▼
Pending queue (status: pending)
    │
    ▼ Owner approves in Admin panel
    │
    ▼
Executed on-chain (status: approved)
```

The threshold is configurable via `MULTISIG_THRESHOLD` in the Rule Engine.

---

## Security Design

1. **`onlyAgent` modifier** — all state-changing functions are restricted
2. **`ReentrancyGuard`** — all external calls protected
3. **Checks-Effects-Interactions** — state updated before any transfer
4. **Reserve floor** — minimum balance that can never be withdrawn
5. **Daily spend cap** — resets after 24-hour window
6. **Multi-sig for large payments** — 2-of-2 approval above threshold
7. **Rate limit** — prevents repeated payouts to the same address
8. **Emergency pause** — Owner can halt all outgoing transactions instantly
9. **Emergency safe address** — pre-set destination for emergency withdrawal
10. **Submission bonds** — anti-spam for bounty submissions
11. **Non-upgradeable** — v1.0.0 is explicitly non-upgradeable for simplicity and safety
12. **Role separation** — Owner, Agent, Verifier, User with distinct permission sets

---

## Environment Variables

Create `.env` in the project root:

```env
# Pharos Network
PHAROS_RPC_URL=https://rpc.pharos.testnet
PHAROS_WS_URL=wss://rpc.pharos.testnet/ws
PHAROS_CHAIN_ID=

# Wallet
OWNER_PRIVATE_KEY=0x...
AGENT_PRIVATE_KEY=0x...

# Contract Addresses (fill after deployment)
TREASURY_CONTRACT=0x...
BOUNTY_CONTRACT=0x...
PAYMENT_ROUTER_CONTRACT=0x...
RULE_ENGINE_CONTRACT=0x...

# AI
GEMINI_API_KEY=AIza...

# Alerts
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Optional
PHAROS_EXPLORER_API_KEY=...
```

---

## Deployment

### 1. Install dependencies

```bash
npm install
```

### 2. Compile contracts

```bash
npx hardhat compile
```

### 3. Deploy Skills to Pharos testnet

```bash
npx hardhat run scripts/deploy.ts --network pharos
```

### 4. Initialize rules and agent address

```bash
npx hardhat run scripts/setup.ts --network pharos
```

### 5. Verify contracts on Pharos explorer

```bash
npx hardhat run scripts/verify.ts --network pharos
```

### 6. Start the agent

```bash
cd agent
npm install
npm run start
```

### 7. Start with PM2 (production)

```bash
pm2 start agent/index.js --name agent-fundraiser
pm2 save
pm2 startup
```

---

## Testing

```bash
# Run all tests
npx hardhat test

# Run specific skill tests
npx hardhat test test/TreasuryManager.test.ts
npx hardhat test test/BountyManager.test.ts
npx hardhat test test/AgentPaymentRouter.test.ts
npx hardhat test test/RuleEngine.test.ts

# Run full integration test
npx hardhat test test/integration.test.ts

# Coverage
npx hardhat coverage
```

### Integration test flow

```
deposit 100 PROS
  → create bounty (50 PROS, 7 days)
    → submit work (with proof)
      → Gemini AI review (score check)
        → approve bounty (50 PROS + bond released)
          → pay analytics agent 5 PROS (scheduled)
            → verify all events emitted on-chain
              → verify balances match
```

---

## Demo Flow

1. **Connect wallet** → Pharos testnet
2. **Deposit 100 PROS** via Treasury tab or `/tip 100 PROS` command
3. **Create a bounty** — "Write a thread about Pharos AI agents" — 50 PROS, 7 days
4. **Submit work** — provide IPFS hash or URL as proof
5. **AI Review** — click Gemini Review → see score, sentiment, recommendation
6. **Approve bounty** — 50 PROS + bond released to winner
7. **Pay Analytics Agent** — 5 PROS scheduled payment
8. **Multi-sig demo** — attempt 150 PROS payment → routes to multi-sig queue → Owner approves
9. **View Audit Log** — full transparent history of all agent actions

All transactions visible on Pharos explorer.

---

## Live Contract Addresses

| Contract | Address |
|---|---|
| TreasuryManager | TBD after deployment |
| BountyManager | TBD after deployment |
| AgentPaymentRouter | TBD after deployment |
| RuleEngine | TBD after deployment |

> Update this section after deploying to Pharos testnet.

---

## Version

`v1.0.0-non-upgradeable`

This first version is intentionally non-upgradeable. The contracts do not use proxy patterns. Upgrades in future versions will use a fresh deployment with state migration scripts, preserving auditability and simplicity.

---

## License

MIT

