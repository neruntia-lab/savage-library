// Read-only public crawl. Never follows download, authentication, or mutation links.
const origin = new URL(process.argv[2] ?? "http://localhost:3000");
const unsafe = (path) =>
  /^\/(?:api|admin|account|logout|dev)(?:\/|$)/.test(path) ||
  /\.(?:zip|pdf|js|json)$/i.test(path);
const seen = new Set();
const external = new Set();
const queue = ["/", "/wiki", "/legal", "/library", "/terms", "/privacy"];
const problems = [];
while (queue.length && seen.size < 200) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  try {
    const response = await fetch(new URL(path, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    if (response.status >= 300 && response.status < 400) {
      problems.push({ path, redirect: response.status });
      continue;
    }
    if (!response.ok) {
      problems.push({ path, status: response.status });
      continue;
    }
    const html = await response.text();
    const headings = [...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length;
    if (headings !== 1) problems.push({ path, h1Count: headings });
    if (!/<link[^>]+rel="canonical"/i.test(html))
      problems.push({ path, missing: "canonical" });
    for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) {
      const url = new URL(match[1].replaceAll("&amp;", "&"), origin);
      if (!/^https?:$/.test(url.protocol) || unsafe(url.pathname)) continue;
      if (url.origin === origin.origin) {
        if (!url.search && !seen.has(url.pathname)) queue.push(url.pathname);
      } else external.add(url.origin + url.pathname);
    }
  } catch (error) {
    problems.push({ path, error: error.name });
  }
}
const externalResults = [];
for (const url of external) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    externalResults.push({
      url,
      status: response.status,
      inconclusive: [401, 403, 405, 429].includes(response.status),
    });
  } catch (error) {
    externalResults.push({ url, error: error.name, inconclusive: true });
  }
}
console.log(
  JSON.stringify(
    {
      origin: origin.origin,
      pagesChecked: seen.size,
      problems,
      externalResults,
    },
    null,
    2,
  ),
);
if (
  problems.some(
    (item) => item.status >= 400 || item.missing || item.h1Count !== undefined,
  )
)
  process.exitCode = 1;
