import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@intrinsic-network/core/artifacts/contracts/IntrinsicFactory.sol/IntrinsicFactory.json'
import { abi as FACTORY_V2_ABI, bytecode as FACTORY_V2_BYTECODE } from '@uniswap/v2-core/build/UniswapV2Factory.json'
import { Fixture } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { IWRBTC, MockTimeSwapRouter02 } from '../../typechain'

import WRBTC from '../contracts/WRBTC.json'
import { Contract } from '@ethersproject/contracts'
import { constants } from 'ethers'

import {
  abi as NFT_POSITION_MANAGER_ABI,
  bytecode as NFT_POSITION_MANAGER_BYTECODE,
} from '@intrinsic-network/periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'

const wrbtcFixture: Fixture<{ wrbtc: IWRBTC }> = async ([wallet]) => {
  const wrbtc = (await waffle.deployContract(wallet, {
    bytecode: WRBTC.bytecode,
    abi: WRBTC.abi,
  })) as IWRBTC

  return { wrbtc }
}

export const v2FactoryFixture: Fixture<{ factory: Contract }> = async ([wallet]) => {
  const factory = await waffle.deployContract(
    wallet,
    {
      bytecode: FACTORY_V2_BYTECODE,
      abi: FACTORY_V2_ABI,
    },
    [constants.AddressZero]
  )

  return { factory }
}

const v3CoreFactoryFixture: Fixture<Contract> = async ([wallet]) => {
  return await waffle.deployContract(wallet, {
    bytecode: FACTORY_BYTECODE,
    abi: FACTORY_ABI,
  })
}

export const v3RouterFixture: Fixture<{
  wrbtc: IWRBTC
  factoryV2: Contract
  factory: Contract
  nft: Contract
  router: MockTimeSwapRouter02
}> = async ([wallet], provider) => {
  const { wrbtc } = await wrbtcFixture([wallet], provider)
  const { factory: factoryV2 } = await v2FactoryFixture([wallet], provider)
  const factory = await v3CoreFactoryFixture([wallet], provider)

  const nft = await waffle.deployContract(
    wallet,
    {
      bytecode: NFT_POSITION_MANAGER_BYTECODE,
      abi: NFT_POSITION_MANAGER_ABI,
    },
    [factory.address, wrbtc.address, constants.AddressZero]
  )

  const router = (await (await ethers.getContractFactory('MockTimeSwapRouter02')).deploy(
    factoryV2.address,
    factory.address,
    nft.address,
    wrbtc.address
  )) as MockTimeSwapRouter02

  return { wrbtc, factoryV2, factory, nft, router }
}
