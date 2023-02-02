import { Fixture } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { v3RouterFixture } from './externalFixtures'
import { constants, Contract } from 'ethers'
import { IWRBTC, MockTimeSwapRouter02, TestERC20 } from '../../typechain'

const completeFixture: Fixture<{
  wrbtc: IWRBTC
  factoryV2: Contract
  factory: Contract
  router: MockTimeSwapRouter02
  nft: Contract
  tokens: [TestERC20, TestERC20, TestERC20]
}> = async ([wallet], provider) => {
  const { wrbtc, factoryV2, factory, nft, router } = await v3RouterFixture([wallet], provider)

  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokens: [TestERC20, TestERC20, TestERC20] = [
    (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20, // do not use maxu256 to avoid overflowing
    (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
    (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
  ]

  tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    wrbtc,
    factoryV2,
    factory,
    router,
    tokens,
    nft,
  }
}

export default completeFixture
