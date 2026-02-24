// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AuditLog {
    address public owner;

    event CapsuleCreated(
        address indexed user,
        bytes32 indexed rulesHash,
        uint256 limit,
        uint256 timestamp
    );

    event TxnDecision(
        address indexed user,
        string merchant,
        string mcc,
        uint256 amount,
        bool approved,
        string riskTier,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function logCapsuleCreated(
        address user,
        bytes32 rulesHash,
        uint256 limit
    ) external onlyOwner {
        emit CapsuleCreated(user, rulesHash, limit, block.timestamp);
    }

    function logTxnDecision(
        address user,
        string calldata merchant,
        string calldata mcc,
        uint256 amount,
        bool approved,
        string calldata riskTier
    ) external onlyOwner {
        emit TxnDecision(user, merchant, mcc, amount, approved, riskTier, block.timestamp);
    }
}