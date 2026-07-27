type RuntimeBindings = {
  DB?: D1Database;
  FILES?: R2Bucket;
};

declare global {
  // Optional escape hatch for non-Vercel runtimes that inject Cloudflare-style
  // bindings into the application process.
  var __SAVAGE_LIBRARY_BINDINGS__: RuntimeBindings | undefined;
}

export function getDatabaseBinding(): D1Database | undefined {
  return globalThis.__SAVAGE_LIBRARY_BINDINGS__?.DB;
}

export function getFileBucketBinding(): R2Bucket | undefined {
  return globalThis.__SAVAGE_LIBRARY_BINDINGS__?.FILES;
}
