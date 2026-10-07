import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { scryptSync, randomBytes } from "node:crypto";
import path from "node:path";

async function available(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}
let port = 3000;
while (!(await available(port)) && port < 3010) port++;
if (port === 3010)
  throw new Error("No preview port available between 3000 and 3009.");
const origin = `http://localhost:${port}`;
const salt = randomBytes(16).toString("hex");
const password = "local-preview";
const env = {
  ...process.env,
  SAVAGE_LIBRARY_LOCAL_PREVIEW: "1",
  VERCEL: "",
  VERCEL_ENV: "",
  DATABASE_URL: "",
  BLOB_READ_WRITE_TOKEN: "",
  PRIVATE_CONTENT_BLOB_READ_WRITE_TOKEN: "",
  PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN: "",
  PATREON_CLIENT_ID: "",
  PATREON_CLIENT_SECRET: "",
  PATREON_WEBHOOK_SECRET: "",
  PATREON_CREATOR_ACCESS_TOKEN: "",
  PATREON_CREATOR_REFRESH_TOKEN: "",
  EMAIL_SERVER: "",
  EMAIL_FROM: "",
  CRON_SECRET: "",
  AUTH_SECRET: randomBytes(32).toString("hex"),
  NEXTAUTH_SECRET: "",
  NEXTAUTH_URL: origin,
  NEXT_PUBLIC_SITE_URL: origin,
  ADMIN_PASSWORD_HASH: `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`,
};
console.log(
  `Local design preview: ${origin}\nAdmin password: ${password}\nSample content only; database and storage writes are disabled.`,
);
const child = spawn(
  process.execPath,
  [
    path.join(process.cwd(), "node_modules/next/dist/bin/next"),
    "dev",
    "--port",
    String(port),
    "--hostname",
    "127.0.0.1",
  ],
  { env, stdio: "inherit", windowsHide: true },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
