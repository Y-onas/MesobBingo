#!/usr/bin/env node

/**
 * Update Referral Bonus Amounts
 * 
 * Updates the referral tier bonus amounts:
 * - 50-99.99: 5 → 10 Birr
 * - 100-199.99: 10 → 15 Birr
 * - Others remain unchanged
 */

const { db } = require('../../src/database');
const { referralTiers } = require('../../src/database/schema');
const { eq, and } = require('drizzle-orm');
const logger = require('../../src/utils/logger');

async function updateReferralBonuses() {
  try {
    logger.info('Starting referral bonus update...');

    // Update 50-99.99 tier: 5 → 10
    const result1 = await db.update(referralTiers)
      .set({ bonusAmount: 10 })
      .where(and(
        eq(referralTiers.minDeposit, 50),
        eq(referralTiers.maxDeposit, 99.99)
      ))
      .returning();

    if (result1.length > 0) {
      logger.info('✅ Updated 50-99.99 tier: 5 → 10 Birr');
    } else {
      logger.info('ℹ️  50-99.99 tier not found or already updated');
    }

    // Update 100-199.99 tier: 10 → 15
    const result2 = await db.update(referralTiers)
      .set({ bonusAmount: 15 })
      .where(and(
        eq(referralTiers.minDeposit, 100),
        eq(referralTiers.maxDeposit, 199.99)
      ))
      .returning();

    if (result2.length > 0) {
      logger.info('✅ Updated 100-199.99 tier: 10 → 15 Birr');
    } else {
      logger.info('ℹ️  100-199.99 tier not found or already updated');
    }

    // Verify all tiers
    const allTiers = await db.select().from(referralTiers).orderBy(referralTiers.minDeposit);
    
    logger.info('\n📊 Current Referral Tiers:');
    allTiers.forEach(tier => {
      const range = tier.maxDeposit 
        ? `${tier.minDeposit}-${tier.maxDeposit}` 
        : `${tier.minDeposit}+`;
      logger.info(`   ${range} Birr → ${tier.bonusAmount} Birr bonus`);
    });

    logger.info('\n✅ Referral bonus update complete!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error updating referral bonuses:', error);
    process.exit(1);
  }
}

updateReferralBonuses();
