// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;

import '@intrinsic-finance/periphery/contracts/base/PeripheryPayments.sol';
import '@intrinsic-finance/periphery/contracts/libraries/TransferHelper.sol';

import '../interfaces/IPeripheryPaymentsExtended.sol';

abstract contract PeripheryPaymentsExtended is IPeripheryPaymentsExtended, PeripheryPayments {
    /// @inheritdoc IPeripheryPaymentsExtended
    function unwrapWRBTC(uint256 amountMinimum) external payable override {
        unwrapWRBTC(amountMinimum, msg.sender);
    }

    /// @inheritdoc IPeripheryPaymentsExtended
    function wrapRBTC(uint256 value) external payable override {
        IWRBTC(WRBTC).deposit{value: value}();
    }

    /// @inheritdoc IPeripheryPaymentsExtended
    function sweepToken(address token, uint256 amountMinimum) external payable override {
        sweepToken(token, amountMinimum, msg.sender);
    }

    /// @inheritdoc IPeripheryPaymentsExtended
    function pull(address token, uint256 value) external payable override {
        TransferHelper.safeTransferFrom(token, msg.sender, address(this), value);
    }
}
