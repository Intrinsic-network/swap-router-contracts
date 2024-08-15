// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@intrinsic-finance/periphery/contracts/interfaces/ISelfPermit.sol';

import './IV2SwapRouter.sol';
import './IIntrinsicSwapRouter.sol';
import './IApproveAndCall.sol';
import './IMulticallExtended.sol';

/// @title Router token swapping functionality
interface ISwapRouter02 is IV2SwapRouter, IIntrinsicSwapRouter, IApproveAndCall, IMulticallExtended, ISelfPermit {

}
