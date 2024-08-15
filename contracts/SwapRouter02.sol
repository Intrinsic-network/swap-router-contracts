// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@intrinsic-finance/periphery/contracts/base/SelfPermit.sol';
import '@intrinsic-finance/periphery/contracts/base/PeripheryImmutableState.sol';

import './interfaces/ISwapRouter02.sol';
import './V2SwapRouter.sol';
import './IntrinsicSwapRouter.sol';
import './base/ApproveAndCall.sol';
import './base/MulticallExtended.sol';

/// @title Intrinsic Swap Router
contract SwapRouter02 is ISwapRouter02, V2SwapRouter, IntrinsicSwapRouter, ApproveAndCall, MulticallExtended, SelfPermit {
    constructor(
        address _factoryV2,
        address factoryV3,
        address _positionManager,
        address _WRBTC
    ) ImmutableState(_factoryV2, _positionManager) PeripheryImmutableState(factoryV3, _WRBTC) {}
}
