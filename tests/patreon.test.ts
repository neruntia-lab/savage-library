import assert from "node:assert/strict";
import test from "node:test";
import { verifyPatreonEntitlement } from "../lib/services/patreon";

test("Patreon entitlement requires an allowed tier from the configured campaign", async () => {
  const previousCampaign = process.env.PATREON_CAMPAIGN_ID;
  const previousFetch = globalThis.fetch;
  process.env.PATREON_CAMPAIGN_ID = "campaign-savage-library";
  globalThis.fetch = (async () =>
    Response.json({
      data: { id: "patron-1", type: "user" },
      included: [
        {
          id: "membership-1",
          type: "member",
          relationships: {
            campaign: {
              data: { id: "campaign-savage-library", type: "campaign" },
            },
            currently_entitled_tiers: {
              data: [
                { id: "tier-apprentice", type: "tier" },
                { id: "tier-archmage", type: "tier" },
              ],
            },
          },
        },
      ],
    })) as typeof fetch;

  try {
    const allowed = await verifyPatreonEntitlement("token", [
      "tier-archmage",
    ]);
    const denied = await verifyPatreonEntitlement("token", ["tier-unknown"]);
    assert.equal(allowed.entitled, true);
    assert.deepEqual(allowed.tierIds, [
      "tier-apprentice",
      "tier-archmage",
    ]);
    assert.equal(denied.entitled, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousCampaign === undefined) {
      delete process.env.PATREON_CAMPAIGN_ID;
    } else {
      process.env.PATREON_CAMPAIGN_ID = previousCampaign;
    }
  }
});
test("Patreon entitlement fails closed without a qualifying membership", async () => {
  const previousCampaign = process.env.PATREON_CAMPAIGN_ID;
  const previousFetch = globalThis.fetch;
  process.env.PATREON_CAMPAIGN_ID = "campaign-savage-library";
  globalThis.fetch = (async () =>
    Response.json({
      data: { id: "patron-2", type: "user" },
      included: [],
    })) as typeof fetch;

  try {
    const result = await verifyPatreonEntitlement("token", [
      "tier-apprentice",
    ]);
    assert.equal(result.entitled, false);
    assert.deepEqual(result.tierIds, []);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousCampaign === undefined) {
      delete process.env.PATREON_CAMPAIGN_ID;
    } else {
      process.env.PATREON_CAMPAIGN_ID = previousCampaign;
    }
  }
});
