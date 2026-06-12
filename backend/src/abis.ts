export const treasuryAbi = [
  "event Deposited(address indexed from,uint256 amount,address indexed token)",
  "event Withdrawn(address indexed to,uint256 amount,address indexed token)",
  "function balance() view returns (uint256)",
  "function spentToday() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function emergencyPause() view returns (bool)"
];

export const bountyAbi = [
  "event BountyCreated(uint256 indexed bountyId,address indexed creator,uint256 reward,address indexed token,uint256 deadline)",
  "event WorkSubmitted(uint256 indexed bountyId,address indexed submitter,bytes proof)",
  "event BountyApproved(uint256 indexed bountyId,address indexed winner,uint256 amount,address indexed token)",
  "event BountyRejected(uint256 indexed bountyId,address indexed rejector)",
  "event BountyExpired(uint256 indexed bountyId)",
  "event BountyCancelled(uint256 indexed bountyId)",
  "event BountyRefunded(uint256 indexed bountyId,uint256 amount)",
  "function nextBountyId() view returns (uint256)",
  "function bounties(uint256) view returns (address creator,uint256 reward,uint256 deadline,bytes description,address token,address verifier,uint8 status,uint256 submissionBond,uint256 escrowed)",
  "function getSubmissionCount(uint256 bountyId) view returns (uint256)",
  "function getSubmission(uint256 bountyId,uint256 index) view returns (tuple(address submitter,bytes proof,uint256 timestamp,bool approved,bool rejected))",
  "function approveBounty(uint256 bountyId,address winner)",
  "function rejectBounty(uint256 bountyId,uint256 submissionIndex)",
  "function expireAndRefund(uint256 bountyId)"
];

export const paymentAbi = [
  "event AgentPayment(address indexed fromAgent,address indexed toAgent,uint256 amount,string memo,uint256 timestamp,address indexed token)",
  "event PaymentQueued(uint256 indexed paymentId,address indexed recipient,uint256 amount,address indexed token,bytes32 idempotencyKey)",
  "function payAgentWithIdempotency(address recipient,uint256 amount,string memo,address token,bytes32 idempotencyKey)",
  "function listAgents(uint256 offset,uint256 limit) view returns (tuple(address agentAddr,string name,string metadataURI,bool active,uint256 registeredAt,uint256 dailyLimit,uint256 paidToday,uint256 lastReset)[])"
];

export const ruleAbi = [
  "event NumericRuleUpdated(bytes32 indexed key,uint256 value)",
  "event BoolRuleUpdated(bytes32 indexed key,bool value)",
  "event StringRuleUpdated(bytes32 indexed key,string value)",
  "function getNumericRule(bytes32 key) view returns (uint256)",
  "function getBoolRule(bytes32 key) view returns (bool)",
  "function getStringRule(bytes32 key) view returns (string)"
];
