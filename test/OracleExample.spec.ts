import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { BigNumber, bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, mineBlock, encodePrice } from './shared/utilities'
import { exchangeFixture } from './shared/fixtures'

import OracleExample from '../build/OracleExample.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('OracleExample', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet])

  let token0: Contract
  let token1: Contract
  let exchange: Contract
  let oracle: Contract
  beforeEach(async function() {
    const fixture = await loadFixture(exchangeFixture)

    token0 = fixture.token0
    token1 = fixture.token1
    exchange = fixture.exchange
    oracle = await deployContract(wallet, OracleExample, [exchange.address], overrides)
  })

  async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
    await token0.transfer(exchange.address, token0Amount)
    await token1.transfer(exchange.address, token1Amount)
    await exchange.mint(wallet.address, overrides)
  }

  it('initialize', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    const blockTimestamp = (await exchange.getReserves())[2]
    await mineBlock(provider, blockTimestamp + 1)
    await exchange.sync(overrides)
    await oracle.initialize(overrides)
  })

  it('update', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)
    const blockTimestamp = (await exchange.getReserves())[2]
    await mineBlock(provider, blockTimestamp + 1)
    await exchange.sync(overrides)
    await oracle.initialize(overrides)
    await mineBlock(provider, blockTimestamp + 2)
    await oracle.update(overrides)

    const expectedPrice = encodePrice(token0Amount, token1Amount)

    expect(await oracle.price0Average()).to.eq(expectedPrice[0])
    expect(await oracle.price1Average()).to.eq(expectedPrice[1])
  })

  it('quote0, quote1', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)
    const blockTimestamp = (await exchange.getReserves())[2]
    await mineBlock(provider, blockTimestamp + 1)
    await exchange.sync(overrides)
    await oracle.initialize(overrides)
    await mineBlock(provider, blockTimestamp + 2)
    await oracle.update(overrides)

    expect(await oracle.quote(token0.address, token0Amount)).to.eq(token1Amount)
    expect(await oracle.quote(token1.address, token1Amount)).to.eq(token0Amount)
  })
})
