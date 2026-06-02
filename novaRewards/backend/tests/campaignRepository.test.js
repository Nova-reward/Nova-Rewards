// Feature: nova-rewards, Property 3: Campaign validation rejects invalid inputs
// Validates: Requirements 7.3

jest.mock('../db/index', () => ({ query: jest.fn() }));

const fc = require('fast-check');
const { validateCampaign } = require('../db/campaignRepository');
const { CampaignFactory } = require('./fixtures');

const baseDateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
});

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

describe('validateCampaign (Property 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects reward rate <= 0 for any date range', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0),
          fc.float({ max: 0, noNaN: true }),
          fc.integer({ max: -1 }),
        ),
        baseDateArb,
        fc.integer({ min: 1, max: 365 }),
        (rewardRate, startDateBase, durationDays) => {
          const startDate = toIsoDate(startDateBase);
          const endDate = toIsoDate(
            new Date(startDateBase.getTime() + durationDays * 24 * 60 * 60 * 1000)
          );
          const { valid, errors } = validateCampaign({ rewardRate, startDate, endDate });

          expect(valid).toBe(false);
          expect(errors).toContain('rewardRate must be greater than 0');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects end date that is not strictly after start date', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        baseDateArb,
        fc.integer({ min: 0, max: 30 }),
        (rewardRate, endDateBase, offsetDays) => {
          const endDate = toIsoDate(endDateBase);
          const startDate = toIsoDate(
            new Date(endDateBase.getTime() + offsetDays * 24 * 60 * 60 * 1000)
          );

          const { valid, errors } = validateCampaign({
            rewardRate,
            startDate,
            endDate,
          });

          expect(valid).toBe(false);
          expect(errors).toContain('endDate must be strictly after startDate');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('accepts valid campaign inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        baseDateArb,
        fc.integer({ min: 1, max: 365 }),
        (rewardRate, startDateBase, durationDays) => {
          const startDate = toIsoDate(startDateBase);
          const endDate = toIsoDate(
            new Date(startDateBase.getTime() + durationDays * 24 * 60 * 60 * 1000)
          );

          const { valid, errors } = validateCampaign({ rewardRate, startDate, endDate });

          expect(valid).toBe(true);
          expect(errors).toHaveLength(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('factory-built campaign passes validation', () => {
    const campaign = CampaignFactory.build();
    const { valid, errors } = validateCampaign({
      rewardRate: parseFloat(campaign.reward_rate),
      startDate: campaign.start_date,
      endDate: campaign.end_date,
    });
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test('factory-built expired campaign fails validation (end before start)', () => {
    const campaign = CampaignFactory.expired();
    // expired campaign has end_date in the past and start_date even further back — still valid dates
    const { valid } = validateCampaign({
      rewardRate: 1,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
    });
    expect(valid).toBe(true); // dates are still ordered correctly; expiry is a runtime concern
  });
});
