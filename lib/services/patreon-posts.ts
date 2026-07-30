import sanitizeHtml from "sanitize-html";
import { createHash } from "node:crypto";

export type ParsedProtectedLink = {
  id: string;
  label: string;
  destination: string;
  role: "manifest" | "pdf" | "module" | "macro" | "download";
};

export type PatreonImportPayload = {
  resourceKey?: string;
  title: string;
  description: string;
  shortDescription: string;
  resourceType?: "module" | "pdf" | "macro";
  version: string;
  manifestUrl?: string;
  projectUrl?: string;
  foundryMinimum?: string;
  foundryVerified?: string;
  foundryMaximum?: string;
  tags: string[];
};

export type PatreonImportResult = {
  payload: PatreonImportPayload;
  confidence: number;
  warnings: string[];
  sanitizedHtml: string;
  links: ParsedProtectedLink[];
};

export function normalizePatreonImportPayload(
  value: unknown,
  fallbackTitle = "Patreon import",
): PatreonImportPayload {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const description =
    typeof input.description === "string" ? input.description : "";
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title
      : fallbackTitle;
  const resourceType =
    input.resourceType === "module" ||
    input.resourceType === "pdf" ||
    input.resourceType === "macro"
      ? input.resourceType
      : undefined;
  const optionalString = (key: string) =>
    typeof input[key] === "string" && input[key]
      ? String(input[key])
      : undefined;
  return {
    resourceKey: optionalString("resourceKey"),
    title,
    description,
    shortDescription:
      typeof input.shortDescription === "string"
        ? input.shortDescription
        : description.replace(/\s+/g, " ").slice(0, 240),
    resourceType,
    version:
      typeof input.version === "string" && input.version
        ? input.version
        : "1.0.0",
    manifestUrl: optionalString("manifestUrl"),
    projectUrl: optionalString("projectUrl"),
    foundryMinimum: optionalString("foundryMinimum"),
    foundryVerified: optionalString("foundryVerified"),
    foundryMaximum: optionalString("foundryMaximum"),
    tags: Array.isArray(input.tags)
      ? input.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
  };
}

const FIELD_NAMES = [
  "type",
  "resource key",
  "title",
  "version",
  "manifest",
  "project",
  "foundry minimum",
  "foundry verified",
  "foundry maximum",
  "tags",
  "description",
] as const;

export function extractPatreonImport(
  postId: string,
  postTitle: string,
  source: string,
): PatreonImportResult {
  const parsed = sanitizeAndExtractPaidLinks(postId, source);
  const plain = sanitizeHtml(source, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const fields = parseFields(plain);
  const publicLinks = extractPublicLinks(parsed.html);
  const allLinks = [
    ...publicLinks.map((link) => ({ ...link, paid: false })),
    ...parsed.links.map((link) => ({ ...link, paid: true })),
  ];
  const explicitType = normalizeType(fields.type);
  const inferredType = inferType(`${postTitle}\n${plain}`, allLinks);
  const resourceType = explicitType ?? inferredType;
  const version =
    normalizeVersion(fields.version) ??
    normalizeVersion(/\bv?(\d+(?:\.[0-9A-Za-z-]+)+)\b/i.exec(`${postTitle} ${plain}`)?.[1]) ??
    "1.0.0";
  const manifest =
    safeHttps(fields.manifest) ??
    allLinks.find((link) => link.role === "manifest" && !link.paid)?.destination;
  const project =
    safeHttps(fields.project) ??
    allLinks.find(
      (link) =>
        !link.paid &&
        link.role === "download" &&
        /github\.com|foundryvtt\.com|itch\.io/i.test(link.destination),
    )?.destination;
  const description = (fields.description || plain || postTitle).slice(0, 4000);
  const title = (fields.title || postTitle || "Patreon import").slice(0, 120);
  const warnings: string[] = [];
  if (!resourceType) warnings.push("Choose a content type.");
  if (!fields.version) warnings.push("Version was not provided; 1.0.0 is proposed.");
  if (resourceType === "module" && !manifest) {
    warnings.push("No public manifest URL was detected.");
  }
  if (!parsed.links.length && !publicLinks.some((link) => link.role !== "download")) {
    warnings.push("No downloadable content link was detected.");
  }
  const tags = Array.from(
    new Set([
      ...splitTags(fields.tags),
      ...Array.from(`${postTitle} ${plain}`.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map(
        (match) => match[1].toLowerCase(),
      ),
      ...(resourceType ? [resourceType] : []),
    ]),
  ).slice(0, 20);
  let confidence = explicitType ? 70 : resourceType ? 50 : 15;
  if (fields.title) confidence += 5;
  if (fields.version) confidence += 5;
  if (fields["resource key"]) confidence += 10;
  if (manifest || parsed.links.length) confidence += 10;
  confidence = Math.min(100, confidence);
  return {
    payload: {
      resourceKey: slugValue(fields["resource key"]),
      title,
      description,
      shortDescription: description.replace(/\s+/g, " ").slice(0, 240),
      resourceType,
      version,
      manifestUrl: manifest,
      projectUrl: project,
      foundryMinimum: normalizeVersion(fields["foundry minimum"]),
      foundryVerified: normalizeVersion(fields["foundry verified"]),
      foundryMaximum: normalizeVersion(fields["foundry maximum"]),
      tags,
    },
    confidence,
    warnings,
    sanitizedHtml: parsed.html,
    links: parsed.links,
  };
}

export function sanitizeAndExtractPaidLinks(
  postId: string,
  source: string,
): { html: string; links: ParsedProtectedLink[] } {
  const clean = sanitizeHtml(source, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "s",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h2",
      "h3",
      "h4",
      "a",
      "img",
      "code",
      "pre",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemes: ["https"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
      }),
      img: sanitizeHtml.simpleTransform("img", {
        loading: "lazy",
        referrerpolicy: "no-referrer",
      }),
    },
  });

  const links: ParsedProtectedLink[] = [];
  const html = clean.replace(
    /<a\b([^>]*?)href="([^"]+)"([^>]*)>\s*\[PAID\]\s*([\s\S]*?)<\/a>/gi,
    (_match, _before, rawDestination: string, _after, labelHtml: string) => {
      let url: URL;
      try {
        const destination = rawDestination.replaceAll("&amp;", "&");
        url = new URL(destination);
      } catch {
        return "";
      }
      if (url.protocol !== "https:") return "";
      const index = links.length;
      const id = createHash("sha256")
        .update(`${postId}|${index}|${url.toString()}`)
        .digest("hex")
        .slice(0, 32);
      const label =
        sanitizeHtml(labelHtml, { allowedTags: [], allowedAttributes: {} }).trim() ||
        "Member download";
      links.push({
        id,
        label,
        destination: url.toString(),
        role: classifyLink(url.toString(), label),
      });
      return `<a class="paid-post-link" href="/api/posts/links/${id}">${escapeHtml(label)}</a>`;
    },
  );
  return { html, links };
}

function parseFields(text: string) {
  const result: Partial<Record<(typeof FIELD_NAMES)[number], string>> = {};
  const pattern = new RegExp(
    `^(${FIELD_NAMES.map(escapeRegExp).join("|")})\\s*:\\s*(.*)$`,
    "i",
  );
  let active: (typeof FIELD_NAMES)[number] | undefined;
  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.trim();
    const match = pattern.exec(line);
    if (match) {
      active = match[1].toLowerCase() as (typeof FIELD_NAMES)[number];
      result[active] = match[2].trim();
    } else if (active === "description" && line) {
      result.description = `${result.description ?? ""}\n${line}`.trim();
    }
  }
  return result;
}

function extractPublicLinks(html: string) {
  const links: Array<ParsedProtectedLink> = [];
  for (const match of html.matchAll(/<a\b[^>]*href="(https:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const destination = match[1].replaceAll("&amp;", "&");
    const label = sanitizeHtml(match[2], { allowedTags: [], allowedAttributes: {} }).trim();
    links.push({
      id: "",
      destination,
      label,
      role: classifyLink(destination, label),
    });
  }
  return links;
}

function classifyLink(
  destination: string,
  label: string,
): ParsedProtectedLink["role"] {
  const value = `${label} ${destination}`.toLowerCase();
  if (/manifest|module\.json/.test(value)) return "manifest";
  if (/\.pdf(?:$|[?#])|\bpdf\b/.test(value)) return "pdf";
  if (/\.zip(?:$|[?#])|\bmodule\b/.test(value)) return "module";
  if (/\.(?:js|json)(?:$|[?#])|\bmacro\b/.test(value)) return "macro";
  return "download";
}

function inferType(
  text: string,
  links: Array<{ role: ParsedProtectedLink["role"] }>,
): PatreonImportPayload["resourceType"] {
  const lower = text.toLowerCase();
  if (links.some((link) => link.role === "manifest" || link.role === "module") ||
      /\bfoundry\s*vtt\b.*\bmodule\b|\bmodule\b.*\bfoundry/i.test(lower)) return "module";
  if (links.some((link) => link.role === "pdf") || /\bpdf\b/i.test(lower)) return "pdf";
  if (links.some((link) => link.role === "macro") || /\bmacro(?:s)?\b/i.test(lower)) return "macro";
  return undefined;
}

function normalizeType(value?: string): PatreonImportPayload["resourceType"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "module" || normalized === "foundry module") return "module";
  if (normalized === "pdf" || normalized === "document") return "pdf";
  if (normalized === "macro" || normalized === "macros") return "macro";
  return undefined;
}

function normalizeVersion(value?: string) {
  const match = value?.trim().match(/^v?([0-9]+(?:\.[0-9A-Za-z-]+)*)$/i);
  return match?.[1];
}

function safeHttps(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function splitTags(value?: string) {
  return (value ?? "")
    .split(/[,#]/)
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);
}

function slugValue(value?: string) {
  const slug = value
    ?.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function postSlug(title: string, id: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return `${base || "patreon-post"}-${id.slice(-8).toLowerCase()}`;
}
