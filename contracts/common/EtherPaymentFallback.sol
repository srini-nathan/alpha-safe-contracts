// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

/// @title EtherPaymentFallback - A contract that has a fallback to accept ether payments
/// @author Modified from Gnosis Safe.
contract EtherPaymentFallback {
    event SafeReceived(address indexed sender, uint256 value);

    /// @dev Fallback function accepts Ether transactions.
    receive() external payable {
        emit SafeReceived(msg.sender, msg.value);
    }
}
