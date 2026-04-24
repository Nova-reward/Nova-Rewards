'use strict';
const { PrismaClient } = require('@prisma/client');
const { encryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');

const prisma = new PrismaClient();
prisma.$use(encryptionMiddleware);

/**
 * Creates a new merchant.
 * @param {{ name: string, walletAddress: string, businessCategory?: string, apiKeyHash: string }} params
 * @returns {Promise<object>} Created merchant row (without api_key)
 */
async function createMerchant({ name, walletAddress, businessCategory, apiKeyHash }) {
  return prisma.merchant.create({
    data: {
      name: name.trim(),
      wallet_address: walletAddress,
      business_category: businessCategory || null,
      api_key: apiKeyHash,
    },
    select: {
      id: true,
      name: true,
      wallet_address: true,
      business_category: true,
      created_at: true,
    },
  });
}

/**
 * Finds a merchant by ID, including their active campaigns.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function getMerchantById(id) {
  return prisma.merchant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      wallet_address: true,
      business_category: true,
      created_at: true,
      campaigns: {
        where: {
          is_active: true,
          end_date: { gte: new Date() },
        },
        select: {
          id: true,
          name: true,
          reward_rate: true,
          start_date: true,
          end_date: true,
          is_active: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      },
    },
  });
}

/**
 * Finds a merchant by their hashed API key (for authentication).
 * @param {string} apiKeyHash
 * @returns {Promise<object|null>}
 */
async function getMerchantByApiKeyHash(apiKeyHash) {
  return prisma.merchant.findUnique({
    where: { api_key: apiKeyHash },
  });
}

/**
 * Updates a merchant's profile fields.
 * @param {number} id
 * @param {{ name?: string, businessCategory?: string }} data
 * @returns {Promise<object>}
 */
async function updateMerchant(id, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.businessCategory !== undefined) updateData.business_category = data.businessCategory;

  return prisma.merchant.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      wallet_address: true,
      business_category: true,
      created_at: true,
    },
  });
}

module.exports = { createMerchant, getMerchantById, getMerchantByApiKeyHash, updateMerchant, prisma };
