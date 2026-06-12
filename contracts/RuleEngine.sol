// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title RuleEngine
/// @notice Stores numeric, boolean, and string rules with useful default values for off-chain agent policy checks.
contract RuleEngine is Ownable {
    address public agent;

    mapping(bytes32 => uint256) private numericRules;
    mapping(bytes32 => bool) private boolRules;
    mapping(bytes32 => string) private stringRules;
    mapping(bytes32 => bool) public numericRuleSet;
    mapping(bytes32 => bool) public boolRuleSet;
    mapping(bytes32 => bool) public stringRuleSet;

    event AgentUpdated(address indexed previousAgent, address indexed newAgent);
    event NumericRuleUpdated(bytes32 indexed key, uint256 value);
    event BoolRuleUpdated(bytes32 indexed key, bool value);
    event StringRuleUpdated(bytes32 indexed key, string value);
    event RuleCreated(bytes32 indexed key, string ruleType);
    event RuleChanged(bytes32 indexed key, string ruleType);
    event RuleDeleted(bytes32 indexed key, string ruleType);

    modifier onlyAgent() {
        require(msg.sender == agent, "RuleEngine: caller is not agent");
        _;
    }

    modifier onlyAgentOrOwner() {
        require(msg.sender == agent || msg.sender == owner(), "RuleEngine: caller is not authorized");
        _;
    }

    constructor(address initialAgent) {
        require(initialAgent != address(0), "RuleEngine: invalid agent");
        agent = initialAgent;
        emit AgentUpdated(address(0), initialAgent);
        _seedDefaults();
    }

    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "RuleEngine: invalid agent");
        emit AgentUpdated(agent, newAgent);
        agent = newAgent;
    }

    function setNumericRule(bytes32 key, uint256 value) external onlyAgentOrOwner {
        _setNumericRule(key, value);
    }

    function setBoolRule(bytes32 key, bool value) external onlyAgentOrOwner {
        _setBoolRule(key, value);
    }

    function setStringRule(bytes32 key, string calldata value) external onlyAgentOrOwner {
        _setStringRule(key, value);
    }

    function deleteNumericRule(bytes32 key) external onlyAgentOrOwner {
        require(numericRuleSet[key], "RuleEngine: rule not found");
        delete numericRules[key];
        delete numericRuleSet[key];
        emit RuleDeleted(key, "numeric");
    }

    function deleteBoolRule(bytes32 key) external onlyAgentOrOwner {
        require(boolRuleSet[key], "RuleEngine: rule not found");
        delete boolRules[key];
        delete boolRuleSet[key];
        emit RuleDeleted(key, "bool");
    }

    function deleteStringRule(bytes32 key) external onlyAgentOrOwner {
        require(stringRuleSet[key], "RuleEngine: rule not found");
        delete stringRules[key];
        delete stringRuleSet[key];
        emit RuleDeleted(key, "string");
    }

    function getNumericRule(bytes32 key) external view returns (uint256) {
        return numericRules[key];
    }

    function getBoolRule(bytes32 key) external view returns (bool) {
        return boolRules[key];
    }

    function getStringRule(bytes32 key) external view returns (string memory) {
        return stringRules[key];
    }

    function _seedDefaults() private {
        _setNumericRule(_key("MAX_DAILY_SPEND_PERCENT"), 20);
        _setNumericRule(_key("MIN_BALANCE_FOR_MARKETING"), 500 ether);
        _setNumericRule(_key("MAX_SINGLE_BOUNTY_REWARD"), 500 ether);
        _setNumericRule(_key("MULTISIG_THRESHOLD"), 100 ether);
        _setNumericRule(_key("RESERVE_FLOOR"), 200 ether);
        _setNumericRule(_key("SUBMISSION_BOND"), 1 ether);
        _setNumericRule(_key("RATE_LIMIT_WINDOW_HOURS"), 24);
        _setNumericRule(_key("MARKETING_BUDGET_PERCENT"), 25);
        _setNumericRule(_key("COMMUNITY_BUDGET_PERCENT"), 25);

        _setBoolRule(_key("ALLOW_BOUNTY_PAYMENTS"), true);
        _setBoolRule(_key("ALLOW_AGENT_TO_AGENT_PAYMENTS"), true);
        _setBoolRule(_key("ALLOW_MARKETING_PAYMENTS"), true);
        _setBoolRule(_key("ALLOW_COMMUNITY_PAYMENTS"), true);
        _setBoolRule(_key("REQUIRE_MANUAL_BOUNTY_APPROVAL"), true);
        _setBoolRule(_key("REQUIRE_SENTIMENT_CHECK"), true);
        _setBoolRule(_key("ENFORCE_MARKETING_HOURS"), true);
        _setBoolRule(_key("EMERGENCY_PAUSE"), false);

        _setStringRule(_key("REQUIRED_TAG"), "#bounty");
        _setStringRule(_key("ALERT_WEBHOOK"), "");
        _setStringRule(_key("EMERGENCY_SAFE_ADDR"), "");
        _setStringRule(_key("GEMINI_MODEL"), "gemini-1.5-pro");
        _setStringRule(_key("AGENT_VERSION"), "v1.0.0-non-upgradeable");
        _setStringRule(_key("PHAROS_RPC_URL"), "wss://rpc.pharos.testnet/ws");
    }

    function _setNumericRule(bytes32 key, uint256 value) private {
        require(key != bytes32(0), "RuleEngine: invalid key");
        bool isNew = !numericRuleSet[key];
        numericRules[key] = value;
        numericRuleSet[key] = true;
        emit NumericRuleUpdated(key, value);
        if (isNew) {
            emit RuleCreated(key, "numeric");
        } else {
            emit RuleChanged(key, "numeric");
        }
    }

    function _setBoolRule(bytes32 key, bool value) private {
        require(key != bytes32(0), "RuleEngine: invalid key");
        bool isNew = !boolRuleSet[key];
        boolRules[key] = value;
        boolRuleSet[key] = true;
        emit BoolRuleUpdated(key, value);
        if (isNew) {
            emit RuleCreated(key, "bool");
        } else {
            emit RuleChanged(key, "bool");
        }
    }

    function _setStringRule(bytes32 key, string memory value) private {
        require(key != bytes32(0), "RuleEngine: invalid key");
        bool isNew = !stringRuleSet[key];
        stringRules[key] = value;
        stringRuleSet[key] = true;
        emit StringRuleUpdated(key, value);
        if (isNew) {
            emit RuleCreated(key, "string");
        } else {
            emit RuleChanged(key, "string");
        }
    }

    function _key(string memory name) private pure returns (bytes32) {
        return keccak256(bytes(name));
    }
}
