# Agent Fundraiser Production Readiness Audit

Last local verification: `npm test`, `npm run build` in `backend`, and `npm run build` in `frontend`.

## Verified Locally

| Area | Status | Evidence |
| --- | --- | --- |
| Smart contract compilation | Verified | `npm test` compiles and runs all Hardhat tests |
| Treasury core flows | Verified | Deposits, withdrawals, reserve floor, daily limit, pause, emergency timelock, and multi-sig request tests pass |
| Bounty lifecycle | Verified | Create, submit, approve, cancel, expire, refund, duplicate submission prevention tests pass |
| Payment router | Verified | Registration, active-agent validation, payments, idempotency, large-payment queue tests pass |
| Rule engine | Verified | Numeric/bool/string defaults, owner/agent updates, created/changed/deleted events tests pass |
| Frontend build | Verified | `frontend` Vite production build passes |
| Backend build | Verified | TypeScript build passes |
| Secret handling | Verified locally | `.env`, backend data files, build outputs, and deployment artifacts are ignored |

## Coverage Status

`npm run coverage` is wired through `solidity-coverage`, but the current machine is running Node `v25.5.0`, which Hardhat explicitly warns is unsupported. Coverage failed inside a transitive `shelljs/glob` dependency under this unsupported runtime. The project now pins supported runtime guidance with `.nvmrc` and `package.json` engines (`>=18 <=22`). Re-run coverage under Node 20 before marking the `≥95%` coverage target complete.

## Implemented Controls

- `TreasuryManager` includes `ReentrancyGuard`, reserve floor, daily limits, pause/unpause aliases, emergency safe address, emergency withdrawal delay, remaining daily allowance, and multi-sig withdrawal requests.
- Multi-sig withdrawal requests include duplicate approval blocking, expiration, emergency cancellation, and checklist-compatible `Request*` events.
- `RuleEngine` emits `RuleCreated`, `RuleChanged`, and `RuleDeleted`, and supports delete functions for each rule type.
- `AgentPaymentRouter` supports registration, activation/deactivation, true removal, payment history, idempotency keys, daily recipient limits, and queued large payments.
- Frontend wallet role is derived from on-chain `owner`, `agent`, `approver`, and `verifier` roles; the Admin tab is protected.
- Frontend starts empty and loads live contract state only; demo seed state and fake heartbeat logs were removed.
- Backend agent uses the branded Pharos Verification Engine (PVE) with Gemini, rate limits, proof-size limits, manual fallback, SQLite review storage, health endpoint, PM2 config, and Docker support.

## Pharos Testnet Blockers

These items are not marked production-ready because they require live secrets, funded accounts, or third-party service credentials that are not present in the repository:

| Item | Required Input |
| --- | --- |
| Contract deployment on Pharos | Funded `PRIVATE_KEY`, supported Node 20/22 runtime, and confirmed `PHAROS_RPC_URL` |
| Explorer verification | `PHAROS_EXPLORER_API_KEY` and deployed contract addresses |
| PVE live Gemini requests | `GEMINI_API_KEY` and `BOUNTY_REVIEW_MODE=ai` or `hybrid` |
| Discord alert delivery | `DISCORD_WEBHOOK_URL` |
| Frontend live state | `frontend/.env` contract addresses from deployment |
| Agent live operation | `backend/.env` contract addresses and funded `AGENT_PRIVATE_KEY` |
| IPFS upload verification | A configured IPFS pinning/upload provider |

## Final Acceptance Status

The repository is locally buildable and tested, but it is not yet final-production accepted because Pharos deployment, explorer verification, live PVE, Discord, and IPFS checks have not been executed with real credentials.
