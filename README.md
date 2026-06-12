# Agent Fundraiser

Agent Fundraiser is a production-minded hackathon project for the Pharos Skill-to-Agent Hackathon. It combines reusable on-chain “Skills” with an off-chain agent that receives community funds, manages bounties, pays approved agents, and enforces transparent spending rules.

## Architecture

- `contracts/` contains four reusable Solidity skills: `TreasuryManager`, `BountyManager`, `AgentPaymentRouter`, and `RuleEngine`.
- `backend/` contains the TypeScript off-chain agent loop for event listening, rule checks, bounty review, scheduled payments, logging, alerts, and health checks.
- `frontend/` contains the React/Vite dashboard for demo interaction and partial on-chain integration.
- `scripts/` contains Hardhat deploy, setup, and verification scripts.
- `test/` contains unit and integration tests for the core contract flows.

## Implemented Highlights

- Native PROS deposits, ERC-20 deposits, reserve floor, daily limits, pause, emergency safe withdrawal.
- Bounty creation, escrow, bonded multi-submissions, duplicate prevention, approval, rejection, cancellation, expiration, and ERC-20 rewards.
- Agent registry, revocation, per-agent daily limits, payment history, idempotency keys, and multi-approval queue for large payments.
- Numeric, boolean, and string rule storage with seeded defaults and clear getters.
- Backend event listeners, local JSON state/logs, scheduled payments, rule enforcement, AI/manual review hook, retry-safe loop, alerts, and `/health`.
- Non-upgradeable v1 strategy for simplicity and auditability.

## Setup

```bash
npm install
cp .env.example .env
npm run compile
npm test
```

For the backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

For the frontend:

```bash
cd frontend
npm install
npm run dev
```

## Deployment

```bash
npm run deploy -- --network pharos
npx hardhat run scripts/setup.ts --network pharos
npm run seed
npx hardhat run scripts/verify.ts --network pharos
```

After deployment, copy contract addresses and any token contract addresses into `.env`, `backend/.env`, and `frontend/.env`.

`TREASURY_MULTISIG_THRESHOLD_PROS=0` keeps direct Treasury withdrawals compatible with the Payment Router queue. Set it above `0` to force large direct Treasury withdrawals through `submitWithdrawalRequest()`, `approveRequest()`, and `executeRequest()`.

## Test Flow

The integration test covers:

1. Deposit funds into treasury.
2. Create a bounty.
3. Submit bounty work.
4. Approve bounty payout.
5. Register another agent.
6. Pay that agent.
7. Queue a large payment for approval.

Validation commands used:

```bash
npm run compile
npm test
cd frontend && npm run build
cd backend && npm run build
```

## Security Notes

- Contracts use explicit role checks and `ReentrancyGuard`.
- Treasury withdrawals use checks-effects-interactions and safe low-level native transfers.
- Large agent payments are queued for a second approver.
- Scheduled backend payments use deterministic idempotency keys.
- This version is intentionally non-upgradeable; future upgrades should use fresh deployments and migration scripts.
