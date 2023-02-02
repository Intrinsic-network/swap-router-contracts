import { Fixture } from 'ethereum-waffle'
import { constants, Contract, ContractTransaction, Wallet } from 'ethers'
import { waffle, ethers } from 'hardhat'
import { IWRBTC, MockTimeSwapRouter02 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { expect } from './shared/expect'

describe('PeripheryPaymentsExtended', function () {
  let wallet: Wallet

  const routerFixture: Fixture<{
    wrbtc: IWRBTC
    router: MockTimeSwapRouter02
  }> = async (wallets, provider) => {
    const { wrbtc, router } = await completeFixture(wallets, provider)

    return {
      wrbtc,
      router,
    }
  }

  let router: MockTimeSwapRouter02
  let wrbtc: IWRBTC

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    ;[wallet] = await (ethers as any).getSigners()
    loadFixture = waffle.createFixtureLoader([wallet])
  })

  beforeEach('load fixture', async () => {
    ;({ wrbtc, router } = await loadFixture(routerFixture))
  })

  describe('wrapRBTC', () => {
    it('increases router WRBTC balance by value amount', async () => {
      const value = ethers.utils.parseEther('1')

      const wrbtcBalancePrev = await wrbtc.balanceOf(router.address)
      await router.wrapRBTC(value, { value })
      const wrbtcBalanceCurrent = await wrbtc.balanceOf(router.address)

      expect(wrbtcBalanceCurrent.sub(wrbtcBalancePrev)).to.equal(value)
      expect(await wrbtc.balanceOf(wallet.address)).to.equal('0')
      expect(await router.provider.getBalance(router.address)).to.equal('0')
    })
  })
})
