import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create test merchant
  const merchant = await prisma.merchant.create({
    data: {
      name: 'Test Merchant',
      walletAddress: 'GA1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      email: 'merchant@test.com'
    }
  })

  // Create test campaign
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Loyalty Rewards',
      description: 'Reward loyal customers',
      merchantId: merchant.id,
      tokenSymbol: 'LOYAL',
      totalSupply: 1000000
    }
  })

  // Create test user
  const user = await prisma.user.create({
    data: {
      walletAddress: 'GB1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      email: 'user@test.com'
    }
  })

  // Create reward issuance
  await prisma.rewardIssuance.create({
    data: {
      userId: user.id,
      campaignId: campaign.id,
      amount: 100,
      txHash: 'tx1234567890'
    }
  })

  // Create redemption
  await prisma.redemption.create({
    data: {
      userId: user.id,
      campaignId: campaign.id,
      amount: 50,
      txHash: 'tx0987654321'
    }
  })

  console.log('Seed data created')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })