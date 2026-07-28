import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { getDb } from "../../db";
import { verificationTokens } from "../../db/schema";

export async function sendComplimentaryInvite(email: string) {
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!server || !from || !secret) return false;
  const token = randomBytes(32).toString("hex");
  const hashed = createHash("sha256").update(`${token}${secret}`).digest("hex");
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await getDb().insert(verificationTokens).values({
    identifier: email,
    token: hashed,
    expires,
  });
  const origin =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const url = new URL("/api/auth/callback/email", origin);
  url.searchParams.set("callbackUrl", `${origin}/account`);
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  await nodemailer.createTransport(server).sendMail({
    to: email,
    from,
    subject: "Your Savage Library complimentary access",
    text: `An administrator granted you complimentary Savage Library access.\n\nSign in: ${url}\n\nThis one-time link expires in 15 minutes.`,
    html: `<p>An administrator granted you complimentary Savage Library access.</p><p><a href="${url.toString()}">Sign in to Savage Library</a></p><p>This one-time link expires in 15 minutes.</p>`,
  });
  return true;
}
