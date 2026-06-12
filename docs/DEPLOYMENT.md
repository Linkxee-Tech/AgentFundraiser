# Deployment Guide

## 1. Configure Secrets

Copy `.env.example` to `.env`, `frontend/.env.example` to `frontend/.env`, and `backend/.env.example` to `backend/.env`.

Required production values:

- `PRIVATE_KEY`: funded deployer wallet for Pharos Testnet.
- `AGENT_PRIVATE_KEY`: funded agent wallet for the off-chain service.
- `PHAROS_RPC_URL` and `PHAROS_WS_URL`.
- `GEMINI_API_KEY` when PVE auto-review is enabled.
- `DISCORD_WEBHOOK_URL` when alerts are enabled.

## 2. Deploy Contracts

```bash
npm run compile
npx hardhat run scripts/deploy.js --network pharos
```

The deployment script saves addresses to `deployments/<chainId>.json`.

## 3. Verify Contracts

```bash
npx hardhat run scripts/verify.ts --network pharos
```

## 4. Configure Frontend

Copy deployed addresses into `frontend/.env`:

- `VITE_TREASURY_MANAGER_ADDRESS`
- `VITE_BOUNTY_MANAGER_ADDRESS`
- `VITE_AGENT_PAYMENT_ROUTER_ADDRESS`
- `VITE_RULE_ENGINE_ADDRESS`

Then run:

```bash
cd frontend
npm run build
```

## 5. Run Agent Brain

```bash
cd backend
npm run build
npm start
```

PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Docker:

```bash
docker compose up -d --build
```
