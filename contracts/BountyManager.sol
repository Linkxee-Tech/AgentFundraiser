// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BountyManager
/// @notice Escrows native or ERC-20 rewards, accepts multiple bonded submissions, and lets the agent approve, reject, expire, or cancel bounties.
contract BountyManager is Ownable, ReentrancyGuard {
    enum Status {
        Open,
        Submitted,
        Paid,
        Expired,
        Refunded,
        Cancelled
    }

    struct Submission {
        address submitter;
        bytes proof;
        uint256 timestamp;
        bool approved;
        bool rejected;
    }

    struct Bounty {
        address creator;
        uint256 reward;
        uint256 deadline;
        bytes description;
        address token;
        address verifier;
        Status status;
        uint256 submissionBond;
        uint256 escrowed;
    }

    address public agent;
    address public verifier;
    uint256 public nextBountyId;
    uint256 public defaultSubmissionBond;
    uint256 public submissionThrottle;

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Submission[]) public submissions;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    mapping(address => uint256) public lastSubmissionAt;

    event BountyCreated(uint256 indexed bountyId, address indexed creator, uint256 reward, address indexed token, uint256 deadline);
    event WorkSubmitted(uint256 indexed bountyId, address indexed submitter, bytes proof);
    event BountyApproved(uint256 indexed bountyId, address indexed winner, uint256 amount, address indexed token);
    event BountyRejected(uint256 indexed bountyId, address indexed rejector);
    event BountyExpired(uint256 indexed bountyId);
    event BountyCancelled(uint256 indexed bountyId);
    event BountyRefunded(uint256 indexed bountyId, uint256 amount);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event SubmissionBondUpdated(uint256 newBond);
    event SubmissionThrottleUpdated(uint256 newThrottle);

    modifier onlyAgent() {
        require(msg.sender == agent, "BountyManager: caller is not agent");
        _;
    }

    modifier onlyAgentOrOwner() {
        require(msg.sender == agent || msg.sender == owner(), "BountyManager: caller is not authorized");
        _;
    }

    constructor(address initialAgent, uint256 submissionBond) {
        require(initialAgent != address(0), "BountyManager: invalid agent");
        agent = initialAgent;
        verifier = initialAgent;
        defaultSubmissionBond = submissionBond;
        nextBountyId = 1;
        emit AgentUpdated(address(0), initialAgent);
        emit VerifierUpdated(address(0), initialAgent);
        emit SubmissionBondUpdated(submissionBond);
    }

    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "BountyManager: invalid agent");
        emit AgentUpdated(agent, newAgent);
        agent = newAgent;
    }

    function setVerifier(address newVerifier) external onlyAgentOrOwner {
        require(newVerifier != address(0), "BountyManager: invalid verifier");
        emit VerifierUpdated(verifier, newVerifier);
        verifier = newVerifier;
    }

    function setSubmissionBond(uint256 bond) external onlyAgentOrOwner {
        defaultSubmissionBond = bond;
        emit SubmissionBondUpdated(bond);
    }

    function setSubmissionThrottle(uint256 throttleSeconds) external onlyAgentOrOwner {
        submissionThrottle = throttleSeconds;
        emit SubmissionThrottleUpdated(throttleSeconds);
    }

    /// @notice Creates a native PROS bounty with the reward supplied as msg.value.
    function createBounty(bytes calldata description, uint256 deadline) external payable onlyAgent nonReentrant returns (uint256 bountyId) {
        require(msg.value > 0, "BountyManager: reward must be positive");
        bountyId = _createBounty(description, msg.value, deadline, address(0));
    }

    /// @notice Creates an ERC-20 bounty and escrows rewardAmount from the agent.
    function createTokenBounty(address token, bytes calldata description, uint256 rewardAmount, uint256 deadline) external onlyAgent nonReentrant returns (uint256 bountyId) {
        require(token != address(0), "BountyManager: invalid token");
        require(rewardAmount > 0, "BountyManager: reward must be positive");
        require(IERC20(token).transferFrom(msg.sender, address(this), rewardAmount), "BountyManager: token transfer failed");
        bountyId = _createBounty(description, rewardAmount, deadline, token);
    }

    function _createBounty(bytes calldata description, uint256 rewardAmount, uint256 deadline, address token) private returns (uint256 bountyId) {
        require(description.length > 0, "BountyManager: description required");
        require(deadline > block.timestamp, "BountyManager: invalid deadline");

        bountyId = nextBountyId++;
        bounties[bountyId] = Bounty({
            creator: msg.sender,
            reward: rewardAmount,
            deadline: deadline,
            description: description,
            token: token,
            verifier: verifier,
            status: Status.Open,
            submissionBond: defaultSubmissionBond,
            escrowed: rewardAmount
        });

        emit BountyCreated(bountyId, msg.sender, rewardAmount, token, deadline);
    }

    function submitWork(uint256 bountyId, bytes calldata proof) external payable nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.creator != address(0), "BountyManager: bounty not found");
        require(bounty.status == Status.Open || bounty.status == Status.Submitted, "BountyManager: bounty not open");
        require(block.timestamp <= bounty.deadline, "BountyManager: deadline passed");
        require(proof.length > 0, "BountyManager: proof required");
        require(!hasSubmitted[bountyId][msg.sender], "BountyManager: duplicate submission");
        require(submissionThrottle == 0 || block.timestamp >= lastSubmissionAt[msg.sender] + submissionThrottle, "BountyManager: submitter throttled");
        require(msg.value == bounty.submissionBond, "BountyManager: bond required");

        submissions[bountyId].push(
            Submission({ submitter: msg.sender, proof: proof, timestamp: block.timestamp, approved: false, rejected: false })
        );
        hasSubmitted[bountyId][msg.sender] = true;
        lastSubmissionAt[msg.sender] = block.timestamp;
        bounty.status = Status.Submitted;

        emit WorkSubmitted(bountyId, msg.sender, proof);
    }

    function approveBounty(uint256 bountyId, address winner) external onlyAgent nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == Status.Submitted, "BountyManager: bounty not submitted");
        require(winner != address(0), "BountyManager: invalid winner");

        uint256 winnerIndex = _findSubmission(bountyId, winner);
        Submission storage winningSubmission = submissions[bountyId][winnerIndex];
        require(!winningSubmission.rejected, "BountyManager: winner rejected");

        bounty.status = Status.Paid;
        bounty.escrowed = 0;
        winningSubmission.approved = true;

        if (bounty.token == address(0)) {
            _sendNative(winner, bounty.reward);
        } else {
            require(IERC20(bounty.token).transfer(winner, bounty.reward), "BountyManager: token payout failed");
        }

        if (bounty.submissionBond > 0) {
            _sendNative(winner, bounty.submissionBond);
        }

        emit BountyApproved(bountyId, winner, bounty.reward, bounty.token);
        emit BountyRefunded(bountyId, bounty.reward);
    }

    /// @notice Rejects one submission by index.
    function rejectBounty(uint256 bountyId, uint256 submissionIndex) public onlyAgent nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == Status.Submitted, "BountyManager: bounty not submitted");
        require(submissionIndex < submissions[bountyId].length, "BountyManager: invalid submission index");

        Submission storage submission = submissions[bountyId][submissionIndex];
        require(!submission.rejected && !submission.approved, "BountyManager: submission finalized");

        submission.rejected = true;
        uint256 refund = bounty.submissionBond / 2;
        if (refund > 0) {
            _sendNative(submission.submitter, refund);
        }
        emit BountyRejected(bountyId, submission.submitter);
    }

    /// @notice Rejects every pending submission for the bounty.
    function rejectBounty(uint256 bountyId) external onlyAgent {
        uint256 count = submissions[bountyId].length;
        require(count > 0, "BountyManager: no submissions");
        for (uint256 i = 0; i < count; i++) {
            if (!submissions[bountyId][i].rejected && !submissions[bountyId][i].approved) {
                rejectBounty(bountyId, i);
            }
        }
    }

    function expireAndRefund(uint256 bountyId) external onlyAgentOrOwner nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.creator != address(0), "BountyManager: bounty not found");
        require(bounty.status == Status.Open || bounty.status == Status.Submitted, "BountyManager: bounty cannot expire");
        require(block.timestamp > bounty.deadline, "BountyManager: deadline not reached");

        uint256 refund = bounty.escrowed;
        bounty.status = Status.Expired;
        bounty.escrowed = 0;
        _refundEscrow(bounty.creator, refund, bounty.token);
        emit BountyExpired(bountyId);
        emit BountyRefunded(bountyId, refund);
    }

    function cancelBounty(uint256 bountyId) external onlyAgent nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.creator != address(0), "BountyManager: bounty not found");
        require(bounty.status == Status.Open, "BountyManager: bounty cannot be cancelled");
        require(submissions[bountyId].length == 0, "BountyManager: bounty has submissions");

        uint256 refund = bounty.escrowed;
        bounty.status = Status.Cancelled;
        bounty.escrowed = 0;
        _refundEscrow(bounty.creator, refund, bounty.token);
        emit BountyCancelled(bountyId);
        emit BountyRefunded(bountyId, refund);
    }

    function extendDeadline(uint256 bountyId, uint256 newDeadline) external onlyAgent {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == Status.Open || bounty.status == Status.Submitted, "BountyManager: bounty not active");
        require(newDeadline > bounty.deadline, "BountyManager: new deadline must be later");
        bounty.deadline = newDeadline;
    }

    /// @notice Increases native bounty reward. For ERC-20 bounties use updateTokenReward.
    function updateReward(uint256 bountyId) external payable onlyAgent nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == Status.Open, "BountyManager: bounty not open");
        require(bounty.token == address(0), "BountyManager: use token reward update");
        require(msg.value > 0, "BountyManager: reward increment required");

        bounty.reward += msg.value;
        bounty.escrowed += msg.value;
    }

    function updateTokenReward(uint256 bountyId, uint256 addedAmount) external onlyAgent nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == Status.Open, "BountyManager: bounty not open");
        require(bounty.token != address(0), "BountyManager: bounty is native");
        require(addedAmount > 0, "BountyManager: reward increment required");
        require(IERC20(bounty.token).transferFrom(msg.sender, address(this), addedAmount), "BountyManager: token transfer failed");

        bounty.reward += addedAmount;
        bounty.escrowed += addedAmount;
    }

    function getSubmissionCount(uint256 bountyId) external view returns (uint256) {
        return submissions[bountyId].length;
    }

    function getSubmission(uint256 bountyId, uint256 index) external view returns (Submission memory) {
        require(index < submissions[bountyId].length, "BountyManager: invalid submission index");
        return submissions[bountyId][index];
    }

    function _findSubmission(uint256 bountyId, address submitter) private view returns (uint256) {
        uint256 count = submissions[bountyId].length;
        for (uint256 i = 0; i < count; i++) {
            if (submissions[bountyId][i].submitter == submitter) {
                return i;
            }
        }
        revert("BountyManager: winner did not submit");
    }

    function _refundEscrow(address recipient, uint256 amount, address token) private {
        if (amount == 0) return;
        if (token == address(0)) {
            _sendNative(recipient, amount);
        } else {
            require(IERC20(token).transfer(recipient, amount), "BountyManager: token refund failed");
        }
    }

    function _sendNative(address recipient, uint256 amount) private {
        (bool sent, ) = payable(recipient).call{ value: amount }("");
        require(sent, "BountyManager: native transfer failed");
    }
}
