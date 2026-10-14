import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { verifyPatreonEntitlement } from "../lib/services/patreon";
import { patreonMemberConnectionsEnabled } from "../lib/config/patreon-members";
import { emailSignInEnabled } from "../lib/config/email-sign-in";
import {
  memberReturnPath,
  memberLinkStateMatches,
  patreonConnectUrl,
} from "../lib/config/member-navigation";
import { resourceAccessState } from "../lib/services/resource-access-state";

test("OAuth returns stay on the site", () => {
  assert.equal(memberLinkStateMatches("nonce", "nonce:member-1", "member-1"), true);
  assert.equal(memberLinkStateMatches("nonce", "nonce:member-1", "member-2"), false);
  assert.equal(memberLinkStateMatches(null, "nonce:member-1", "member-1"), false);
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\ninvalid",
    null,
  ])
    assert.equal(memberReturnPath(value), "/account");
  assert.equal(
    memberReturnPath("/resources/craft?lang=es"),
    "/resources/craft?lang=es",
  );
  assert.match(
    patreonConnectUrl("/resources/craft"),
    /returnTo=%2Fresources%2Fcraft/,
  );
});

test("resource controls distinguish connection, tier, verification, preview and missing-file states", () => {
  const input = {
    preview: false,
    protected: true,
    signedIn: false,
    entitled: false,
    available: true,
  };
  assert.equal(resourceAccessState(input), "connect");
  assert.equal(
    resourceAccessState({ ...input, signedIn: true }),
    "missing-tier",
  );
  assert.equal(
    resourceAccessState({
      ...input,
      signedIn: true,
      denialReason: "verification_unavailable",
    }),
    "unverified",
  );
  assert.equal(
    resourceAccessState({ ...input, signedIn: true, entitled: true }),
    "available",
  );
  assert.equal(
    resourceAccessState({
      ...input,
      signedIn: true,
      entitled: true,
      available: false,
    }),
    "unavailable",
  );
  assert.equal(
    resourceAccessState({ ...input, protected: false }),
    "available",
  );
  assert.equal(resourceAccessState({ ...input, preview: true }), "preview");
});

test("production preflight requires SMTP unless email sign-in is explicitly paused", () => {
  const env = { ...process.env };
  for (const key of [
    "DATABASE_URL",
    "AUTH_SECRET",
    "BLOB_READ_WRITE_TOKEN",
    "ADMIN_PASSWORD_HASH",
    "PATREON_CLIENT_ID",
    "PATREON_CLIENT_SECRET",
    "PATREON_CAMPAIGN_ID",
    "PATREON_CAMPAIGN_URL",
    "PATREON_TOKEN_ENCRYPTION_KEY",
    "CRON_SECRET",
    "PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN",
  ])
    env[key] = "preflight-test-only";
  env.NEXTAUTH_URL = env.NEXT_PUBLIC_SITE_URL =
    "https://savage-library.vercel.app";
  env.EMAIL_SERVER = env.EMAIL_FROM = "";
  const check = (enabled: string) =>
    spawnSync(process.execPath, ["scripts/check-production-env.mjs"], {
      env: { ...env, EMAIL_SIGN_IN_ENABLED: enabled },
      encoding: "utf8",
    });
  assert.equal(check("false").status, 0);
  const required = check("true");
  assert.equal(required.status, 1);
  assert.match(required.stderr, /EMAIL_SERVER/);
  assert.match(required.stderr, /EMAIL_FROM/);
});

test("email sign-in requires configuration and respects an explicit pause", () => {
  const names = ["EMAIL_SERVER", "EMAIL_FROM", "EMAIL_SIGN_IN_ENABLED"];
  const previous = names.map((name) => process.env[name]);
  try {
    for (const name of names) delete process.env[name];
    assert.equal(emailSignInEnabled(), false);
    process.env.EMAIL_SERVER = "smtp://localhost:2525";
    process.env.EMAIL_FROM = "test@example.com";
    assert.equal(emailSignInEnabled(), true);
    process.env.EMAIL_SIGN_IN_ENABLED = "false";
    assert.equal(emailSignInEnabled(), false);
    process.env.EMAIL_SIGN_IN_ENABLED = "true";
    assert.equal(emailSignInEnabled(), true);
    process.env.EMAIL_FROM = " ";
    assert.equal(emailSignInEnabled(), false);
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

test("member Patreon connections default off and require explicit opt-in", () => {
  const previous = process.env.PATREON_MEMBER_CONNECTIONS_ENABLED;
  try {
    delete process.env.PATREON_MEMBER_CONNECTIONS_ENABLED;
    assert.equal(patreonMemberConnectionsEnabled(), false);
    for (const value of ["false", "1", "TRUE", ""]) {
      process.env.PATREON_MEMBER_CONNECTIONS_ENABLED = value;
      assert.equal(patreonMemberConnectionsEnabled(), false);
    }
    process.env.PATREON_MEMBER_CONNECTIONS_ENABLED = "true";
    assert.equal(patreonMemberConnectionsEnabled(), true);
  } finally {
    if (previous === undefined)
      delete process.env.PATREON_MEMBER_CONNECTIONS_ENABLED;
    else process.env.PATREON_MEMBER_CONNECTIONS_ENABLED = previous;
  }
});

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
    const allowed = await verifyPatreonEntitlement("token", ["tier-archmage"]);
    const denied = await verifyPatreonEntitlement("token", ["tier-unknown"]);
    assert.equal(allowed.entitled, true);
    assert.deepEqual(allowed.tierIds, ["tier-apprentice", "tier-archmage"]);
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
    const result = await verifyPatreonEntitlement("token", ["tier-apprentice"]);
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
