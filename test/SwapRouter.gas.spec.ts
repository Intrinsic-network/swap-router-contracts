import { defaultAbiCoder } from '@ethersproject/abi'
import { abi as IIntrinsicPoolABI } from '@intrinsic-network/core/artifacts/contracts/interfaces/IIntrinsicPool.sol/IIntrinsicPool.json'
import { Fixture } from 'ethereum-waffle'
import { BigNumber, constants, ContractTransaction, Wallet } from 'ethers'
import { solidityPack } from 'ethers/lib/utils'
import { ethers, waffle } from 'hardhat'
import { IIntrinsicPool, IWRBTC, MockTimeSwapRouter02, TestERC20 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { ADDRESS_THIS, FeeAmount, MSG_SENDER, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { encodePath } from './shared/path'
import snapshotGasCost from './shared/snapshotGasCost'
import { getMaxTick, getMinTick } from './shared/ticks'

describe('SwapRouter gas tests', function () {
  this.timeout(40000)
  let wallet: Wallet
  let trader: Wallet

  const swapRouterFixture: Fixture<{
    wrbtc: IWRBTC
    router: MockTimeSwapRouter02
    tokens: [TestERC20, TestERC20, TestERC20]
    pools: [IIntrinsicPool, IIntrinsicPool, IIntrinsicPool]
  }> = async (wallets, provider) => {
    const { wrbtc, factory, router, tokens, nft } = await completeFixture(wallets, provider)

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(router.address, constants.MaxUint256)
      await token.approve(nft.address, constants.MaxUint256)
      await token.connect(trader).approve(router.address, constants.MaxUint256)
      await token.transfer(trader.address, expandTo18Decimals(1_000_000))
    }

    const liquidity = 1000000
    async function createPool(tokenAddressA: string, tokenAddressB: string) {
      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
        [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]

      await nft.createAndInitializePoolIfNecessary(
        tokenAddressA,
        tokenAddressB,
        FeeAmount.MEDIUM,
        encodePriceSqrt(100005, 100000) // we don't want to cross any ticks
      )

      const liquidityParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount0Desired: 1000000,
        amount1Desired: 1000000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 2 ** 32,
      }

      return nft.mint(liquidityParams)
    }

    async function createPoolWRBTC(tokenAddress: string) {
      await wrbtc.deposit({ value: liquidity * 2 })
      await wrbtc.approve(nft.address, constants.MaxUint256)
      return createPool(wrbtc.address, tokenAddress)
    }

    // create pools
    await createPool(tokens[0].address, tokens[1].address)
    await createPool(tokens[1].address, tokens[2].address)
    await createPoolWRBTC(tokens[0].address)

    const poolAddresses = await Promise.all([
      factory.getPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM),
      factory.getPool(tokens[1].address, tokens[2].address, FeeAmount.MEDIUM),
      factory.getPool(wrbtc.address, tokens[0].address, FeeAmount.MEDIUM),
    ])

    const pools = poolAddresses.map((poolAddress) => new ethers.Contract(poolAddress, IIntrinsicPoolABI, wallet)) as [
      IIntrinsicPool,
      IIntrinsicPool,
      IIntrinsicPool
    ]

    return {
      wrbtc,
      router,
      tokens,
      pools,
    }
  }

  let wrbtc: IWRBTC
  let router: MockTimeSwapRouter02
  let tokens: [TestERC20, TestERC20, TestERC20]
  let pools: [IIntrinsicPool, IIntrinsicPool, IIntrinsicPool]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  function encodeUnwrapWRBTC(amount: number) {
    return solidityPack(
      ['bytes4', 'bytes'],
      [router.interface.getSighash('unwrapWRBTC(uint256)'), defaultAbiCoder.encode(['uint256'], [amount])]
    )
  }

  function encodeSweep(token: string, amount: number) {
    const functionSignature = 'sweepToken(address,uint256)'
    return solidityPack(
      ['bytes4', 'bytes'],
      [
        router.interface.getSighash(functionSignature),
        defaultAbiCoder.encode((router.interface.functions as any)[functionSignature].inputs, [token, amount]),
      ]
    )
  }

  before('create fixture loader', async () => {
    const wallets = await (ethers as any).getSigners()
    ;[wallet, trader] = wallets

    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ router, wrbtc, tokens, pools } = await loadFixture(swapRouterFixture))
  })

  async function exactInput(
    tokens: string[],
    amountIn: number = 2,
    amountOutMinimum: number = 1
  ): Promise<ContractTransaction> {
    const inputIsWRBTC = wrbtc.address === tokens[0]
    const outputIsWRBTC = tokens[tokens.length - 1] === wrbtc.address

    const value = inputIsWRBTC ? amountIn : 0

    const params = {
      path: encodePath(tokens, new Array(tokens.length - 1).fill(FeeAmount.MEDIUM)),
      recipient: outputIsWRBTC ? ADDRESS_THIS : MSG_SENDER,
      amountIn,
      amountOutMinimum: outputIsWRBTC ? 0 : amountOutMinimum, // save on calldata
    }

    const data = [router.interface.encodeFunctionData('exactInput', [params])]
    if (outputIsWRBTC) {
      data.push(encodeUnwrapWRBTC(amountOutMinimum))
    }

    return router.connect(trader)['multicall(uint256,bytes[])'](1, data, { value })
  }

  async function exactInputSingle(
    tokenIn: string,
    tokenOut: string,
    amountIn: number = 3,
    amountOutMinimum: number = 1,
    sqrtPriceLimitX96?: BigNumber
  ): Promise<ContractTransaction> {
    const inputIsWRBTC = wrbtc.address === tokenIn
    const outputIsWRBTC = tokenOut === wrbtc.address

    const value = inputIsWRBTC ? amountIn : 0

    const params = {
      tokenIn,
      tokenOut,
      fee: FeeAmount.MEDIUM,
      recipient: outputIsWRBTC ? ADDRESS_THIS : MSG_SENDER,
      amountIn,
      amountOutMinimum: outputIsWRBTC ? 0 : amountOutMinimum, // save on calldata
      sqrtPriceLimitX96: sqrtPriceLimitX96 ?? 0,
    }

    const data = [router.interface.encodeFunctionData('exactInputSingle', [params])]
    if (outputIsWRBTC) {
      data.push(encodeUnwrapWRBTC(amountOutMinimum))
    }

    return router.connect(trader)['multicall(uint256,bytes[])'](1, data, { value })
  }

  async function exactOutput(tokens: string[]): Promise<ContractTransaction> {
    const amountInMaximum = 10 // we don't care
    const amountOut = 1

    const inputIsWRBTC = tokens[0] === wrbtc.address
    const outputIsWRBTC = tokens[tokens.length - 1] === wrbtc.address

    const value = inputIsWRBTC ? amountInMaximum : 0

    const params = {
      path: encodePath(tokens.slice().reverse(), new Array(tokens.length - 1).fill(FeeAmount.MEDIUM)),
      recipient: outputIsWRBTC ? ADDRESS_THIS : MSG_SENDER,
      amountOut,
      amountInMaximum,
    }

    const data = [router.interface.encodeFunctionData('exactOutput', [params])]
    if (inputIsWRBTC) {
      data.push(router.interface.encodeFunctionData('refundRBTC'))
    }

    if (outputIsWRBTC) {
      data.push(encodeUnwrapWRBTC(amountOut))
    }

    return router.connect(trader)['multicall(uint256,bytes[])'](1, data, { value })
  }

  async function exactOutputSingle(
    tokenIn: string,
    tokenOut: string,
    amountOut: number = 1,
    amountInMaximum: number = 3,
    sqrtPriceLimitX96?: BigNumber
  ): Promise<ContractTransaction> {
    const inputIsWRBTC = tokenIn === wrbtc.address
    const outputIsWRBTC = tokenOut === wrbtc.address

    const value = inputIsWRBTC ? amountInMaximum : 0

    const params = {
      tokenIn,
      tokenOut,
      fee: FeeAmount.MEDIUM,
      recipient: outputIsWRBTC ? ADDRESS_THIS : MSG_SENDER,
      amountOut,
      amountInMaximum,
      sqrtPriceLimitX96: sqrtPriceLimitX96 ?? 0,
    }

    const data = [router.interface.encodeFunctionData('exactOutputSingle', [params])]
    if (inputIsWRBTC) {
      data.push(router.interface.encodeFunctionData('refundRBTC'))
    }

    if (outputIsWRBTC) {
      data.push(encodeUnwrapWRBTC(amountOut))
    }

    return router.connect(trader)['multicall(uint256,bytes[])'](1, data, { value })
  }

  // TODO should really throw this in the fixture
  beforeEach('intialize feeGrowthGlobals', async () => {
    await exactInput([tokens[0].address, tokens[1].address], 1, 0)
    await exactInput([tokens[1].address, tokens[0].address], 1, 0)
    await exactInput([tokens[1].address, tokens[2].address], 1, 0)
    await exactInput([tokens[2].address, tokens[1].address], 1, 0)
    await exactInput([tokens[0].address, wrbtc.address], 1, 0)
    await exactInput([wrbtc.address, tokens[0].address], 1, 0)
  })

  beforeEach('ensure feeGrowthGlobals are >0', async () => {
    const slots = await Promise.all(
      pools.map((pool) =>
        Promise.all([
          pool.feeGrowthGlobal0X128().then((f) => f.toString()),
          pool.feeGrowthGlobal1X128().then((f) => f.toString()),
        ])
      )
    )

    expect(slots).to.deep.eq([
      ['340290874192793283295456993856614', '340290874192793283295456993856614'],
      ['340290874192793283295456993856614', '340290874192793283295456993856614'],
      ['340290874192793283295456993856614', '340290874192793283295456993856614'],
    ])
  })

  beforeEach('ensure ticks are 0 before', async () => {
    const slots = await Promise.all(pools.map((pool) => pool.slot0().then(({ tick }) => tick)))
    expect(slots).to.deep.eq([0, 0, 0])
  })

  afterEach('ensure ticks are 0 after', async () => {
    const slots = await Promise.all(pools.map((pool) => pool.slot0().then(({ tick }) => tick)))
    expect(slots).to.deep.eq([0, 0, 0])
  })

  describe('#exactInput', () => {
    it('0 -> 1', async () => {
      await snapshotGasCost(exactInput(tokens.slice(0, 2).map((token) => token.address)))
    })

    it('0 -> 1 minimal', async () => {
      const calleeFactory = await ethers.getContractFactory('TestIntrinsicCallee')
      const callee = await calleeFactory.deploy()

      await tokens[0].connect(trader).approve(callee.address, constants.MaxUint256)
      await snapshotGasCost(callee.connect(trader).swapExact0For1(pools[0].address, 2, trader.address, '4295128740'))
    })

    it('0 -> 1 -> 2', async () => {
      await snapshotGasCost(
        exactInput(
          tokens.map((token) => token.address),
          3
        )
      )
    })

    it('WRBTC -> 0', async () => {
      await snapshotGasCost(
        exactInput(
          [wrbtc.address, tokens[0].address],
          wrbtc.address.toLowerCase() < tokens[0].address.toLowerCase() ? 2 : 3
        )
      )
    })

    it('0 -> WRBTC', async () => {
      await snapshotGasCost(
        exactInput(
          [tokens[0].address, wrbtc.address],
          tokens[0].address.toLowerCase() < wrbtc.address.toLowerCase() ? 2 : 3
        )
      )
    })

    it('2 trades (via router)', async () => {
      await wrbtc.connect(trader).deposit({ value: 3 })
      await wrbtc.connect(trader).approve(router.address, constants.MaxUint256)
      const swap0 = {
        path: encodePath([wrbtc.address, tokens[0].address], [FeeAmount.MEDIUM]),
        recipient: ADDRESS_THIS,
        amountIn: 3,
        amountOutMinimum: 0, // save on calldata
      }

      const swap1 = {
        path: encodePath([tokens[1].address, tokens[0].address], [FeeAmount.MEDIUM]),
        recipient: ADDRESS_THIS,
        amountIn: 3,
        amountOutMinimum: 0, // save on calldata
      }

      const data = [
        router.interface.encodeFunctionData('exactInput', [swap0]),
        router.interface.encodeFunctionData('exactInput', [swap1]),
        encodeSweep(tokens[0].address, 2),
      ]

      await snapshotGasCost(router.connect(trader)['multicall(uint256,bytes[])'](1, data))
    })

    it('2 trades (directly to sender)', async () => {
      await wrbtc.connect(trader).deposit({ value: 3 })
      await wrbtc.connect(trader).approve(router.address, constants.MaxUint256)
      const swap0 = {
        path: encodePath([wrbtc.address, tokens[0].address], [FeeAmount.MEDIUM]),
        recipient: MSG_SENDER,
        amountIn: 3,
        amountOutMinimum: 1,
      }

      const swap1 = {
        path: encodePath([tokens[1].address, tokens[0].address], [FeeAmount.MEDIUM]),
        recipient: MSG_SENDER,
        amountIn: 3,
        amountOutMinimum: 1,
      }

      const data = [
        router.interface.encodeFunctionData('exactInput', [swap0]),
        router.interface.encodeFunctionData('exactInput', [swap1]),
      ]

      await snapshotGasCost(router.connect(trader)['multicall(uint256,bytes[])'](1, data))
    })

    it('3 trades (directly to sender)', async () => {
      await wrbtc.connect(trader).deposit({ value: 3 })
      await wrbtc.connect(trader).approve(router.address, constants.MaxUint256)
      const swap0 = {
        path: encodePath([wrbtc.address, tokens[0].address], [FeeAmount.MEDIUM]),
        recipient: MSG_SENDER,
        amountIn: 3,
        amountOutMinimum: 1,
      }

      const swap1 = {
        path: encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
        recipient: MSG_SENDER,
        amountIn: 3,
        amountOutMinimum: 1,
      }

      const swap2 = {
        path: encodePath([tokens[1].address, tokens[2].address], [FeeAmount.MEDIUM]),
        recipient: MSG_SENDER,
        amountIn: 3,
        amountOutMinimum: 1,
      }

      const data = [
        router.interface.encodeFunctionData('exactInput', [swap0]),
        router.interface.encodeFunctionData('exactInput', [swap1]),
        router.interface.encodeFunctionData('exactInput', [swap2]),
      ]

      await snapshotGasCost(router.connect(trader)['multicall(uint256,bytes[])'](1, data))
    })
  })

  describe('#exactInputSingle', () => {
    it('0 -> 1', async () => {
      await snapshotGasCost(exactInputSingle(tokens[0].address, tokens[1].address))
    })

    it('WRBTC -> 0', async () => {
      await snapshotGasCost(
        exactInputSingle(
          wrbtc.address,
          tokens[0].address,
          wrbtc.address.toLowerCase() < tokens[0].address.toLowerCase() ? 2 : 3
        )
      )
    })

    it('0 -> WRBTC', async () => {
      await snapshotGasCost(
        exactInputSingle(
          tokens[0].address,
          wrbtc.address,
          tokens[0].address.toLowerCase() < wrbtc.address.toLowerCase() ? 2 : 3
        )
      )
    })
  })

  describe('#exactOutput', () => {
    it('0 -> 1', async () => {
      await snapshotGasCost(exactOutput(tokens.slice(0, 2).map((token) => token.address)))
    })

    it('0 -> 1 -> 2', async () => {
      await snapshotGasCost(exactOutput(tokens.map((token) => token.address)))
    })

    it('WRBTC -> 0', async () => {
      await snapshotGasCost(exactOutput([wrbtc.address, tokens[0].address]))
    })

    it('0 -> WRBTC', async () => {
      await snapshotGasCost(exactOutput([tokens[0].address, wrbtc.address]))
    })
  })

  describe('#exactOutputSingle', () => {
    it('0 -> 1', async () => {
      await snapshotGasCost(exactOutputSingle(tokens[0].address, tokens[1].address))
    })

    it('WRBTC -> 0', async () => {
      await snapshotGasCost(exactOutputSingle(wrbtc.address, tokens[0].address))
    })

    it('0 -> WRBTC', async () => {
      await snapshotGasCost(exactOutputSingle(tokens[0].address, wrbtc.address))
    })
  })
})
