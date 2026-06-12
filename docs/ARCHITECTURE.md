# Architecture

Agent Fundraiser is split into four production layers:

- `contracts/`: Treasury, bounty, payment-router, and rule-engine Skills.
- `frontend/`: Vite React app that connects to MetaMask and reads/writes deployed contracts.
- `backend/`: Pharos Verification Engine and scheduled-payment agent.
- `scripts/` and `tasks/`: deployment, verification, setup, and seeding automation.

## On-Chain Skills

- `TreasuryManager`: native/ERC-20 deposits, withdrawals, limits, pause, emergency safe, timelock, and multi-sig withdrawal requests.
- `BountyManager`: escrowed bounties, bonded submissions, approval/rejection, cancellation, expiry, and refunds.
- `AgentPaymentRouter`: agent registry, active-agent validation, idempotent payments, history, and large-payment queueing.
- `RuleEngine`: numeric, boolean, and string guardrails with lifecycle events.

## Off-Chain Agent

The backend process listens to contract events, reviews bounty submissions through PVE, stores reviews and schedules in SQLite, executes due payments with idempotency, exposes `/health`, and emits alerts.

## Frontend

The UI derives roles from on-chain contracts, protects admin routes, subscribes to contract events, and only displays state fetched from deployed contracts or user-submitted transactions.
