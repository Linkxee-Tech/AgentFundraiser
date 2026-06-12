// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ITreasuryManager {
    function withdraw(address to, uint256 amount) external;
    function withdrawERC20(address token, address to, uint256 amount) external;
}

/// @title AgentPaymentRouter
/// @notice Registers approved agents, routes payments through TreasuryManager, stores payment history, and queues large payments for owner approval.
contract AgentPaymentRouter is Ownable, ReentrancyGuard {
    struct AgentInfo {
        address agentAddr;
        string name;
        string metadataURI;
        bool active;
        uint256 registeredAt;
        uint256 dailyLimit;
        uint256 paidToday;
        uint256 lastReset;
    }

    struct PaymentRecord {
        address fromAgent;
        address toAgent;
        uint256 amount;
        string memo;
        uint256 timestamp;
        address token;
        bytes32 idempotencyKey;
    }

    struct PendingPayment {
        address recipient;
        uint256 amount;
        string memo;
        address token;
        bytes32 idempotencyKey;
        address requester;
        bool executed;
        bool rejected;
        uint256 createdAt;
    }

    address public treasury;
    address public agent;
    address public approver;
    uint256 public multiSigThreshold;
    uint256 public nextPendingPaymentId;

    mapping(address => AgentInfo) public agents;
    mapping(bytes32 => bool) public usedPaymentKeys;
    mapping(uint256 => PendingPayment) public pendingPayments;
    address[] public agentAddresses;
    PaymentRecord[] private paymentHistory;

    event AgentRegistered(address indexed agentAddr, string name, string metadataURI);
    event AgentStatusUpdated(address indexed agentAddr, bool active);
    event AgentDailyLimitUpdated(address indexed agentAddr, uint256 dailyLimit);
    event AgentPayment(address indexed fromAgent, address indexed toAgent, uint256 amount, string memo, uint256 timestamp, address indexed token);
    event PaymentQueued(uint256 indexed paymentId, address indexed recipient, uint256 amount, address indexed token, bytes32 idempotencyKey);
    event PaymentApproved(uint256 indexed paymentId, address indexed approver);
    event PaymentRejected(uint256 indexed paymentId, address indexed approver);
    event TreasuryUpdated(address indexed treasury);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event ApproverUpdated(address indexed oldApprover, address indexed newApprover);
    event MultiSigThresholdUpdated(uint256 threshold);

    modifier onlyAgent() {
        require(msg.sender == agent, "AgentPaymentRouter: caller is not agent");
        _;
    }

    modifier onlyApprover() {
        require(msg.sender == approver || msg.sender == owner(), "AgentPaymentRouter: caller is not approver");
        _;
    }

    constructor(address initialAgent, address treasuryManager, uint256 initialMultiSigThreshold) {
        require(initialAgent != address(0), "AgentPaymentRouter: invalid agent");
        require(treasuryManager != address(0), "AgentPaymentRouter: invalid treasury");
        agent = initialAgent;
        approver = msg.sender;
        treasury = treasuryManager;
        multiSigThreshold = initialMultiSigThreshold;
        nextPendingPaymentId = 1;
        emit AgentUpdated(address(0), initialAgent);
        emit ApproverUpdated(address(0), approver);
        emit TreasuryUpdated(treasuryManager);
        emit MultiSigThresholdUpdated(initialMultiSigThreshold);
    }

    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "AgentPaymentRouter: invalid agent");
        emit AgentUpdated(agent, newAgent);
        agent = newAgent;
    }

    function setApprover(address newApprover) external onlyOwner {
        require(newApprover != address(0), "AgentPaymentRouter: invalid approver");
        emit ApproverUpdated(approver, newApprover);
        approver = newApprover;
    }

    function setTreasury(address treasuryManager) external onlyOwner {
        require(treasuryManager != address(0), "AgentPaymentRouter: invalid treasury");
        treasury = treasuryManager;
        emit TreasuryUpdated(treasuryManager);
    }

    function setMultiSigThreshold(uint256 threshold) external onlyOwner {
        multiSigThreshold = threshold;
        emit MultiSigThresholdUpdated(threshold);
    }

    function registerAgent(address agentAddr, string calldata name, string calldata metadataURI, uint256 dailyLimit) external onlyAgent {
        require(agentAddr != address(0), "AgentPaymentRouter: invalid address");
        require(bytes(name).length > 0, "AgentPaymentRouter: name required");
        AgentInfo storage info = agents[agentAddr];
        if (info.registeredAt == 0) {
            agentAddresses.push(agentAddr);
            info.registeredAt = block.timestamp;
            info.lastReset = block.timestamp;
        }
        info.agentAddr = agentAddr;
        info.name = name;
        info.metadataURI = metadataURI;
        info.active = true;
        info.dailyLimit = dailyLimit;
        info.paidToday = 0;
        emit AgentRegistered(agentAddr, name, metadataURI);
    }

    function updateAgentStatus(address agentAddr, bool isActive) external onlyAgent {
        require(agents[agentAddr].registeredAt != 0, "AgentPaymentRouter: agent not registered");
        agents[agentAddr].active = isActive;
        emit AgentStatusUpdated(agentAddr, isActive);
    }

    function revokeAgent(address agentAddr) external onlyAgent {
        require(agents[agentAddr].registeredAt != 0, "AgentPaymentRouter: agent not registered");
        agents[agentAddr].active = false;
        emit AgentStatusUpdated(agentAddr, false);
    }

    function setAgentDailyLimit(address agentAddr, uint256 limit) external onlyAgent {
        require(agents[agentAddr].registeredAt != 0, "AgentPaymentRouter: agent not registered");
        _resetRecipientSpend(agentAddr);
        agents[agentAddr].dailyLimit = limit;
        emit AgentDailyLimitUpdated(agentAddr, limit);
    }

    function payAgent(address recipient, uint256 amount, string calldata memo, address token) external onlyAgent nonReentrant {
        bytes32 key = keccak256(abi.encodePacked(block.chainid, recipient, amount, memo, token, block.timestamp, paymentHistory.length));
        _payOrQueue(recipient, amount, memo, token, key);
    }

    function payAgentWithIdempotency(address recipient, uint256 amount, string calldata memo, address token, bytes32 idempotencyKey) external onlyAgent nonReentrant {
        require(idempotencyKey != bytes32(0), "AgentPaymentRouter: invalid idempotency key");
        require(!usedPaymentKeys[idempotencyKey], "AgentPaymentRouter: duplicate payment key");
        usedPaymentKeys[idempotencyKey] = true;
        _payOrQueue(recipient, amount, memo, token, idempotencyKey);
    }

    function approvePayment(uint256 paymentId) external onlyApprover nonReentrant {
        PendingPayment storage pending = pendingPayments[paymentId];
        require(pending.createdAt != 0, "AgentPaymentRouter: payment not found");
        require(!pending.executed, "AgentPaymentRouter: already executed");
        require(!pending.rejected, "AgentPaymentRouter: already rejected");

        pending.executed = true;
        _executePayment(pending.recipient, pending.amount, pending.memo, pending.token, pending.idempotencyKey, pending.requester);
        emit PaymentApproved(paymentId, msg.sender);
    }

    function rejectPayment(uint256 paymentId) external onlyApprover {
        PendingPayment storage pending = pendingPayments[paymentId];
        require(pending.createdAt != 0, "AgentPaymentRouter: payment not found");
        require(!pending.executed, "AgentPaymentRouter: already executed");
        require(!pending.rejected, "AgentPaymentRouter: already rejected");
        pending.rejected = true;
        emit PaymentRejected(paymentId, msg.sender);
    }

    function getAgentInfo(address agentAddr) external view returns (AgentInfo memory) {
        return agents[agentAddr];
    }

    function listAgents(uint256 offset, uint256 limit) external view returns (AgentInfo[] memory) {
        uint256 length = agentAddresses.length;
        if (offset >= length) return new AgentInfo[](0);
        uint256 end = offset + limit;
        if (end > length) end = length;

        AgentInfo[] memory result = new AgentInfo[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = agents[agentAddresses[i]];
        }
        return result;
    }

    function paymentHistoryLength() external view returns (uint256) {
        return paymentHistory.length;
    }

    function listPayments(uint256 offset, uint256 limit) external view returns (PaymentRecord[] memory) {
        uint256 length = paymentHistory.length;
        if (offset >= length) return new PaymentRecord[](0);
        uint256 end = offset + limit;
        if (end > length) end = length;

        PaymentRecord[] memory result = new PaymentRecord[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = paymentHistory[i];
        }
        return result;
    }

    function _payOrQueue(address recipient, uint256 amount, string calldata memo, address token, bytes32 idempotencyKey) private {
        _validatePayment(recipient, amount);
        if (multiSigThreshold > 0 && amount >= multiSigThreshold) {
            uint256 paymentId = nextPendingPaymentId++;
            pendingPayments[paymentId] = PendingPayment({
                recipient: recipient,
                amount: amount,
                memo: memo,
                token: token,
                idempotencyKey: idempotencyKey,
                requester: msg.sender,
                executed: false,
                rejected: false,
                createdAt: block.timestamp
            });
            emit PaymentQueued(paymentId, recipient, amount, token, idempotencyKey);
        } else {
            _executePayment(recipient, amount, memo, token, idempotencyKey, msg.sender);
        }
    }

    function _validatePayment(address recipient, uint256 amount) private {
        AgentInfo storage info = agents[recipient];
        require(info.registeredAt != 0, "AgentPaymentRouter: agent not registered");
        require(info.active, "AgentPaymentRouter: agent inactive");
        require(amount > 0, "AgentPaymentRouter: amount must be positive");
        _resetRecipientSpend(recipient);
        require(info.dailyLimit == 0 || info.paidToday + amount <= info.dailyLimit, "AgentPaymentRouter: daily limit exceeded");
    }

    function _executePayment(address recipient, uint256 amount, string memory memo, address token, bytes32 idempotencyKey, address requester) private {
        AgentInfo storage info = agents[recipient];
        _validatePayment(recipient, amount);
        info.paidToday += amount;

        if (token == address(0)) {
            ITreasuryManager(treasury).withdraw(recipient, amount);
        } else {
            ITreasuryManager(treasury).withdrawERC20(token, recipient, amount);
        }

        paymentHistory.push(
            PaymentRecord({
                fromAgent: requester,
                toAgent: recipient,
                amount: amount,
                memo: memo,
                timestamp: block.timestamp,
                token: token,
                idempotencyKey: idempotencyKey
            })
        );
        emit AgentPayment(requester, recipient, amount, memo, block.timestamp, token);
    }

    function _resetRecipientSpend(address recipient) private {
        AgentInfo storage info = agents[recipient];
        if (block.timestamp >= info.lastReset + 1 days) {
            info.paidToday = 0;
            info.lastReset = block.timestamp;
        }
    }
}
