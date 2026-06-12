import { ethers } from "ethers";

const addresses = {
  treasuryManager: import.meta.env.VITE_TREASURY_MANAGER_ADDRESS || "",
  bountyManager: import.meta.env.VITE_BOUNTY_MANAGER_ADDRESS || "",
  agentPaymentRouter: import.meta.env.VITE_AGENT_PAYMENT_ROUTER_ADDRESS || "",
  ruleEngine: import.meta.env.VITE_RULE_ENGINE_ADDRESS || "",
  usdcToken: import.meta.env.VITE_USDC_TOKEN_ADDRESS || "",
  ethToken: import.meta.env.VITE_ETH_TOKEN_ADDRESS || ""
};

export const pharosNetwork = {
  chainId: import.meta.env.VITE_PHAROS_CHAIN_ID || "",
  chainName: import.meta.env.VITE_PHAROS_CHAIN_NAME || "Pharos Testnet",
  rpcUrl: import.meta.env.VITE_PHAROS_RPC_URL || "",
  explorerUrl: import.meta.env.VITE_PHAROS_BLOCK_EXPLORER_URL || ""
};

const ERC20_ABI = [
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)"
];

const STATUS_LABELS = ["open", "submitted", "approved", "expired", "refunded", "cancelled"];
const ETHER_RULE_KEYS = new Set([
  "MIN_BALANCE_FOR_MARKETING",
  "MAX_SINGLE_BOUNTY_REWARD",
  "MULTISIG_THRESHOLD",
  "RESERVE_FLOOR",
  "SUBMISSION_BOND"
]);

const ABIS = {
  treasuryManager: [
    "event Deposited(address indexed from,uint256 amount,address indexed token)",
    "event Withdrawn(address indexed to,uint256 amount,address indexed token)",
    "event WithdrawalRequestSubmitted(uint256 indexed requestId,address indexed to,uint256 amount,address indexed token)",
    "event WithdrawalRequestApproved(uint256 indexed requestId,address indexed approver)",
    "event WithdrawalRequestRejected(uint256 indexed requestId,address indexed rejector)",
    "event WithdrawalRequestExecuted(uint256 indexed requestId,address indexed to,uint256 amount,address indexed token)",
    "event RequestExpired(uint256 indexed requestId)",
    "event EmergencyPaused(bool paused)",
    "function deposit() external payable",
    "function depositERC20(address token, uint256 amount) external",
    "function withdraw(address to, uint256 amount) external",
    "function withdrawERC20(address token, address to, uint256 amount) external",
    "function withdrawAll() external",
    "function withdrawAllERC20(address token) external",
    "function submitWithdrawalRequest(address to, uint256 amount) external returns (uint256)",
    "function submitWithdrawalRequest(address to, uint256 amount, address token) external returns (uint256)",
    "function approveRequest(uint256 requestId) external",
    "function rejectRequest(uint256 requestId) external",
    "function executeRequest(uint256 requestId) external",
    "function withdrawalRequests(uint256 requestId) external view returns (address to,uint256 amount,address token,address requester,bool agentApproved,bool ownerApproved,bool executed,bool rejected,bool expired,uint256 createdAt)",
    "function nextWithdrawalRequestId() external view returns (uint256)",
    "function balance() external view returns (uint256)",
    "function tokenBalance(address token) external view returns (uint256)",
    "function remainingDailyAllowance() external view returns (uint256)",
    "function setDailyLimit(uint256 newLimit) external",
    "function setMultiSigThreshold(uint256 newThreshold) external",
    "function setEmergencyPause(bool paused) external",
    "function setReserveFloor(uint256 floor) external",
    "function setEmergencySafeAddress(address safeAddress) external",
    "function setEmergencyWithdrawAddress(address safeAddress) external",
    "function emergencyPause() external view returns (bool)",
    "function reserveFloor() external view returns (uint256)",
    "function dailyLimit() external view returns (uint256)",
    "function agent() external view returns (address)",
    "function owner() external view returns (address)"
  ],
  bountyManager: [
    "event BountyCreated(uint256 indexed bountyId,address indexed creator,uint256 reward,address indexed token,uint256 deadline)",
    "event WorkSubmitted(uint256 indexed bountyId,address indexed submitter,bytes proof)",
    "event BountyApproved(uint256 indexed bountyId,address indexed winner,uint256 amount,address indexed token)",
    "event BountyRejected(uint256 indexed bountyId,address indexed rejector)",
    "function createBounty(bytes description, uint256 deadline) external payable",
    "function createTokenBounty(address token, bytes description, uint256 rewardAmount, uint256 deadline) external",
    "function submitWork(uint256 bountyId, bytes proof) external payable",
    "function approveBounty(uint256 bountyId, address winner) external",
    "function rejectBounty(uint256 bountyId, uint256 submissionIndex) external",
    "function expireAndRefund(uint256 bountyId) external",
    "function cancelBounty(uint256 bountyId) external",
    "function extendDeadline(uint256 bountyId, uint256 newDeadline) external",
    "function updateReward(uint256 bountyId) external payable",
    "function updateTokenReward(uint256 bountyId, uint256 addedAmount) external",
    "function nextBountyId() external view returns (uint256)",
    "function agent() external view returns (address)",
    "function verifier() external view returns (address)",
    "function owner() external view returns (address)",
    "function bounties(uint256 bountyId) external view returns (address creator,uint256 reward,uint256 deadline,bytes description,address token,address verifier,uint8 status,uint256 submissionBond,uint256 escrowed)",
    "function getSubmissionCount(uint256 bountyId) external view returns (uint256)",
    "function getSubmission(uint256 bountyId, uint256 index) external view returns (tuple(address submitter,bytes proof,uint256 timestamp,bool approved,bool rejected))"
  ],
  agentPaymentRouter: [
    "event AgentRegistered(address indexed agentAddr,string name,string metadataURI)",
    "event AgentStatusUpdated(address indexed agentAddr,bool active)",
    "event AgentRemoved(address indexed agentAddr)",
    "event AgentPayment(address indexed fromAgent,address indexed toAgent,uint256 amount,string memo,uint256 timestamp,address indexed token)",
    "event PaymentQueued(uint256 indexed paymentId,address indexed recipient,uint256 amount,address indexed token,bytes32 idempotencyKey)",
    "function registerAgent(address agentAddr, string name, string metadataURI, uint256 dailyLimit) external",
    "function updateAgentStatus(address agentAddr, bool isActive) external",
    "function revokeAgent(address agentAddr) external",
    "function removeAgent(address agentAddr) external",
    "function setAgentDailyLimit(address agentAddr, uint256 limit) external",
    "function payAgent(address recipient, uint256 amount, string memo, address token) external",
    "function payAgentWithIdempotency(address recipient, uint256 amount, string memo, address token, bytes32 idempotencyKey) external",
    "function approvePayment(uint256 paymentId) external",
    "function rejectPayment(uint256 paymentId) external",
    "function getAgentInfo(address agentAddr) external view returns (address agentAddr,string name,string metadataURI,bool active,uint256 registeredAt,uint256 dailyLimit,uint256 paidToday,uint256 lastReset)",
    "function listAgents(uint256 offset, uint256 limit) external view returns (tuple(address agentAddr,string name,string metadataURI,bool active,uint256 registeredAt,uint256 dailyLimit,uint256 paidToday,uint256 lastReset)[] memory)",
    "function listPayments(uint256 offset, uint256 limit) external view returns (tuple(address fromAgent,address toAgent,uint256 amount,string memo,uint256 timestamp,address token,bytes32 idempotencyKey)[])",
    "function paymentHistoryLength() external view returns (uint256)",
    "function agent() external view returns (address)",
    "function approver() external view returns (address)",
    "function owner() external view returns (address)"
  ],
  ruleEngine: [
    "event NumericRuleUpdated(bytes32 indexed key,uint256 value)",
    "event BoolRuleUpdated(bytes32 indexed key,bool value)",
    "event StringRuleUpdated(bytes32 indexed key,string value)",
    "event RuleCreated(bytes32 indexed key,string ruleType)",
    "event RuleChanged(bytes32 indexed key,string ruleType)",
    "event RuleDeleted(bytes32 indexed key,string ruleType)",
    "function setNumericRule(bytes32 key, uint256 value) external",
    "function setBoolRule(bytes32 key, bool value) external",
    "function setStringRule(bytes32 key, string value) external",
    "function deleteNumericRule(bytes32 key) external",
    "function deleteBoolRule(bytes32 key) external",
    "function deleteStringRule(bytes32 key) external",
    "function getNumericRule(bytes32 key) external view returns (uint256)",
    "function getBoolRule(bytes32 key) external view returns (bool)",
    "function getStringRule(bytes32 key) external view returns (string memory)",
    "function agent() external view returns (address)",
    "function owner() external view returns (address)"
  ]
};

export function isChainReady() {
  return [
    addresses.treasuryManager,
    addresses.bountyManager,
    addresses.agentPaymentRouter,
    addresses.ruleEngine
  ].every((address) => address && address !== "");
}

export async function switchToPharos(ethereum) {
  if (!ethereum || !pharosNetwork.chainId) return;
  const chainId = pharosNetwork.chainId.startsWith("0x")
    ? pharosNetwork.chainId
    : `0x${Number(pharosNetwork.chainId).toString(16)}`;

  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (error?.code !== 4902 || !pharosNetwork.rpcUrl) throw error;
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId,
        chainName: pharosNetwork.chainName,
        nativeCurrency: { name: "Pharos", symbol: "PROS", decimals: 18 },
        rpcUrls: [pharosNetwork.rpcUrl],
        blockExplorerUrls: pharosNetwork.explorerUrl ? [pharosNetwork.explorerUrl] : []
      }]
    });
  }
}

function sameAddress(left, right) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

export async function fetchAccessProfile(contracts, account) {
  const profile = {
    role: account ? "User" : "Disconnected",
    isOwner: false,
    isAgent: false,
    isVerifier: false,
    isApprover: false
  };
  if (!contracts || !account) return profile;

  const calls = [
    ["treasuryOwner", contracts.treasuryManager ? () => contracts.treasuryManager.owner() : null],
    ["treasuryAgent", contracts.treasuryManager ? () => contracts.treasuryManager.agent() : null],
    ["bountyOwner", contracts.bountyManager ? () => contracts.bountyManager.owner() : null],
    ["bountyAgent", contracts.bountyManager ? () => contracts.bountyManager.agent() : null],
    ["bountyVerifier", contracts.bountyManager ? () => contracts.bountyManager.verifier() : null],
    ["paymentOwner", contracts.agentPaymentRouter ? () => contracts.agentPaymentRouter.owner() : null],
    ["paymentAgent", contracts.agentPaymentRouter ? () => contracts.agentPaymentRouter.agent() : null],
    ["paymentApprover", contracts.agentPaymentRouter ? () => contracts.agentPaymentRouter.approver() : null],
    ["ruleOwner", contracts.ruleEngine ? () => contracts.ruleEngine.owner() : null],
    ["ruleAgent", contracts.ruleEngine ? () => contracts.ruleEngine.agent() : null]
  ];

  const resolved = {};
  for (const [key, fn] of calls) {
    if (!fn) continue;
    try {
      resolved[key] = await fn();
    } catch {
      resolved[key] = "";
    }
  }

  profile.isOwner = ["treasuryOwner", "bountyOwner", "paymentOwner", "ruleOwner"].some((key) => sameAddress(resolved[key], account));
  profile.isAgent = ["treasuryAgent", "bountyAgent", "paymentAgent", "ruleAgent"].some((key) => sameAddress(resolved[key], account));
  profile.isVerifier = sameAddress(resolved.bountyVerifier, account);
  profile.isApprover = sameAddress(resolved.paymentApprover, account);
  profile.role = profile.isOwner ? "Owner" : profile.isAgent ? "Agent" : profile.isVerifier ? "Verifier" : "User";
  return profile;
}

export const tokenAddresses = {
  "USDC-P": addresses.usdcToken,
  "ETH-P": addresses.ethToken
};

export function createContracts(providerOrSigner) {
  const result = {};
  for (const [key, abi] of Object.entries(ABIS)) {
    const address = addresses[`${key}`];
    if (address) {
      result[key] = new ethers.Contract(address, abi, providerOrSigner);
    }
  }
  return result;
}

export function createERC20Contract(tokenAddress, providerOrSigner) {
  return new ethers.Contract(tokenAddress, ERC20_ABI, providerOrSigner);
}

export function contractAddress(contract) {
  return contract?.target || contract?.address || "";
}

function tokenSymbol(tokenAddress) {
  if (!tokenAddress || tokenAddress === ethers.ZeroAddress) return "PROS";
  const found = Object.entries(tokenAddresses).find(([, address]) => address?.toLowerCase?.() === tokenAddress.toLowerCase());
  return found?.[0] || tokenAddress;
}

function safeUtf8(bytesValue) {
  try {
    return ethers.toUtf8String(bytesValue);
  } catch {
    return String(bytesValue);
  }
}

export async function fetchRuleSet(ruleContract) {
  if (!ruleContract) return null;
  const keys = {
    numeric: ["MAX_DAILY_SPEND_PERCENT","MIN_BALANCE_FOR_MARKETING","MAX_SINGLE_BOUNTY_REWARD","MULTISIG_THRESHOLD","RESERVE_FLOOR","SUBMISSION_BOND","RATE_LIMIT_WINDOW_HOURS","MARKETING_BUDGET_PERCENT","COMMUNITY_BUDGET_PERCENT"],
    bool: ["ALLOW_BOUNTY_PAYMENTS","ALLOW_AGENT_TO_AGENT_PAYMENTS","ALLOW_MARKETING_PAYMENTS","ALLOW_COMMUNITY_PAYMENTS","REQUIRE_MANUAL_BOUNTY_APPROVAL","REQUIRE_SENTIMENT_CHECK","ENFORCE_MARKETING_HOURS","EMERGENCY_PAUSE"],
    string: ["REQUIRED_TAG","ALERT_WEBHOOK","EMERGENCY_SAFE_ADDR","GEMINI_MODEL","AGENT_VERSION","PHAROS_RPC_URL"]
  };

  const rules = { numeric: {}, bool: {}, string: {} };
  for (const key of keys.numeric) {
    const raw = await ruleContract.getNumericRule(ethers.id(key));
    rules.numeric[key] = { value: ETHER_RULE_KEYS.has(key) ? Number(ethers.formatEther(raw)) : Number(raw), desc: "" };
  }
  for (const key of keys.bool) {
    rules.bool[key] = { value: await ruleContract.getBoolRule(ethers.id(key)), desc: "" };
  }
  for (const key of keys.string) {
    rules.string[key] = { value: await ruleContract.getStringRule(ethers.id(key)), desc: "" };
  }
  return rules;
}

export async function fetchTreasuryBalance(treasuryContract) {
  if (!treasuryContract) return null;
  const balance = await treasuryContract.balance();
  const result = { PROS: Number(ethers.formatEther(balance)) };

  for (const [tokenName, tokenAddr] of Object.entries(tokenAddresses)) {
    if (!tokenAddr || tokenAddr === ethers.ZeroAddress) continue;
    try {
      const provider = treasuryContract.runner;
      const token = createERC20Contract(tokenAddr, provider);
      const decimals = Number(await token.decimals().catch(() => 18));
      const tokenBal = await treasuryContract.tokenBalance(tokenAddr);
      result[tokenName] = Number(ethers.formatUnits(tokenBal, decimals));
    } catch (error) {
      console.warn(`Unable to fetch treasury balance for ${tokenName}:`, error);
    }
  }

  return result;
}

export async function fetchBounties(bountyContract) {
  if (!bountyContract) return [];
  const nextId = Number(await bountyContract.nextBountyId());
  const result = [];
  for (let id = 1; id < nextId; id++) {
    const bounty = await bountyContract.bounties(id);
    if (!bounty.creator || bounty.creator === ethers.ZeroAddress) continue;
    const token = tokenSymbol(bounty.token);
    const submissionCount = Number(await bountyContract.getSubmissionCount(id));
    const submissions = [];
    for (let index = 0; index < submissionCount; index++) {
      const submission = await bountyContract.getSubmission(id, index);
      submissions.push({
        id: `${id}-${index}`,
        submitter: submission.submitter,
        proof: safeUtf8(submission.proof),
        time: new Date(Number(submission.timestamp) * 1000).toLocaleTimeString("en-US", { hour12: false }),
        bond: Number(ethers.formatEther(bounty.submissionBond)),
        approved: submission.approved,
        rejected: submission.rejected,
        aiScore: null,
        aiReasoning: null
      });
    }
    result.push({
      id,
      description: safeUtf8(bounty.description),
      reward: Number(ethers.formatEther(bounty.reward)),
      token,
      deadline: Number(bounty.deadline) * 1000,
      status: STATUS_LABELS[Number(bounty.status)] || "unknown",
      submissions,
      creator: bounty.creator,
      bond: Number(ethers.formatEther(bounty.submissionBond)),
      category: "bounty"
    });
  }
  return result.reverse();
}

export async function fetchAgents(paymentRouter) {
  if (!paymentRouter) return [];
  const rows = await paymentRouter.listAgents(0, 100);
  return rows.map((agent) => ({
    address: agent.agentAddr,
    name: agent.name,
    metaURI: agent.metadataURI,
    active: agent.active,
    registered: Number(agent.registeredAt) * 1000,
    dailyLimit: Number(ethers.formatEther(agent.dailyLimit)),
    paidToday: Number(ethers.formatEther(agent.paidToday)),
    category: "onchain"
  }));
}

export async function fetchPayments(paymentRouter) {
  if (!paymentRouter) return [];
  const count = Number(await paymentRouter.paymentHistoryLength());
  const rows = count > 0 ? await paymentRouter.listPayments(0, Math.min(count, 100)) : [];
  return rows.map((payment, index) => ({
    id: `chain-${index}`,
    recipient: payment.toAgent,
    name: "On-chain Agent",
    amount: Number(ethers.formatEther(payment.amount)),
    token: tokenSymbol(payment.token),
    memo: payment.memo,
    time: Number(payment.timestamp) * 1000,
    type: "on-chain",
    category: "a2a",
    txHash: payment.idempotencyKey
  })).reverse();
}

export async function fetchTreasuryRequests(treasuryContract) {
  if (!treasuryContract) return [];
  const nextId = Number(await treasuryContract.nextWithdrawalRequestId());
  const requests = [];
  for (let id = 1; id < nextId; id++) {
    const request = await treasuryContract.withdrawalRequests(id);
    if (!request.createdAt || Number(request.createdAt) === 0) continue;
    requests.push({
      id,
      to: request.to,
      amount: Number(ethers.formatEther(request.amount)),
      token: tokenSymbol(request.token),
      requester: request.requester,
      approvals: [request.agentApproved ? "Agent" : null, request.ownerApproved ? "Owner" : null].filter(Boolean),
      status: request.executed ? "approved" : request.rejected ? "rejected" : request.expired ? "expired" : "pending",
      createdAt: Number(request.createdAt) * 1000,
      source: "treasury"
    });
  }
  return requests.reverse();
}
