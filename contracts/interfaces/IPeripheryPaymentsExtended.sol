// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;

import '@intrinsic-network/periphery/contracts/interfaces/IPeripheryPayments.sol';

/// @title Periphery Payments Extended
/// @notice Functions to ease deposits and withdrawals of RBTC and tokens
interface IPeripheryPaymentsExtended is IPeripheryPayments {
    /// @notice Unwraps the contract's WRBTC balance and sends it to msg.sender as RBTC.
    /// @dev The amountMinimum parameter prevents malicious contracts from stealing WRBTC from users.
    /// @param amountMinimum The minimum amount of WRBTC to unwrap
    function unwrapWRBTC(uint256 amountMinimum) external payable;

    /// @notice Wraps the contract's RBTC balance into WRBTC
    /// @dev The resulting WRBTC is custodied by the router, thus will require further distribution
    /// @param value The amount of RBTC to wrap
    function wrapRBTC(uint256 value) external payable;

    /// @notice Transfers the full amount of a token held by this contract to msg.sender
    /// @dev The amountMinimum parameter prevents malicious contracts from stealing the token from users
    /// @param token The contract address of the token which will be transferred to msg.sender
    /// @param amountMinimum The minimum amount of token required for a transfer
    function sweepToken(address token, uint256 amountMinimum) external payable;

    /// @notice Transfers the specified amount of a token from the msg.sender to address(this)
    /// @param token The token to pull
    /// @param value The amount to pay
    function pull(address token, uint256 value) external payable;
}
