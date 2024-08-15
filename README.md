# Intrinsic Swap Router

## Local deployment

In order to deploy this code to a local testnet, you should install the npm package
`@intrinsic-finance/swap-router-contracts`
and import bytecode imported from artifacts located at
`@intrinsic-finance/swap-router-contracts/artifacts/contracts/*/*.json`.
For example:

```typescript
import {
  abi as SWAP_ROUTER_ABI,
  bytecode as SWAP_ROUTER_BYTECODE,
} from '@intrinsic-finance/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json'

// deploy the bytecode
```

This will ensure that you are testing against the same bytecode that is deployed to
mainnet and public testnets, and all Intrinsic code will correctly interoperate with
your local deployment.

## Using solidity interfaces

The swap router contract interfaces are available for import into solidity smart contracts
via the npm artifact `@intrinsic-finance/swap-router-contracts`, e.g.:

```solidity
import '@intrinsic-finance/swap-router-contracts/contracts/interfaces/ISwapRouter02.sol';

contract MyContract {
  ISwapRouter02 router;

  function doSomethingWithSwapRouter() {
    // router.exactInput(...);
  }
}

```
