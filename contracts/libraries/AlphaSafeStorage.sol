// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

/// @title AlphaSafeStorage - Storage layout of the Safe contracts to be used in libraries.
contract AlphaSafeStorage {
    // From /common/Singleton.sol
    address internal singleton;
    // From /base/OwnerManager.sol
    mapping(address => address) internal owners;
    uint256 internal ownerCount;
    uint256 internal threshold;

    // From /AlphaSafe.sol
    bytes32 internal nonce;
    bytes32 internal domainSeparator;
    mapping(bytes32 => uint256) internal signedMessages;
    mapping(address => mapping(bytes32 => uint256)) internal approvedHashes;
}
