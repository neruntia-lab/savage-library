#!/usr/bin/env node

const canonicalOrigin = "https://savage-library.vercel.app";
const missing = [];

requireOne("database connection", ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]);
requireOne("Auth.js secret", ["AUTH_SECRET", "NEXTAUTH_SECRET"]);
requireOne("private Blob token", [
  "PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
]);

for (const name of [
  "ADMIN_PASSWORD_HASH",
  "PATREON_CLIENT_ID",
  "PATREON_CLIENT_SECRET",
  "PATREON_CAMPAIGN_ID",
  "PATREON_CAMPAIGN_URL",
  "PATREON_TOKEN_ENCRYPTION_KEY",
  "EMAIL_SERVER",
  "EMAIL_FROM",
  "CRON_SECRET",
  "PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN",
]) {
  if (!process.env[name]?.trim()) missing.push(name);
}

for (const name of ["NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL"]) {
  const value = process.env[name]?.replace(/\/+$/, "");
  if (value !== canonicalOrigin) {
    missing.push(`${name}=${canonicalOrigin}`);
  }
}

if (missing.length) {
  console.error("Production configuration is incomplete:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Production environment configuration is complete.");

function requireOne(label, names) {
  if (!names.some((name) => process.env[name]?.trim())) {
    missing.push(`${label} (${names.join(" or ")})`);
  }
}
