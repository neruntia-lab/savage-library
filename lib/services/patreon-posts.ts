import sanitizeHtml from "sanitize-html";
import { createHash } from "node:crypto";

export type ParsedProtectedLink = {
  id: string;
  label: string;
  destination: string;
};

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
      links.push({ id, label, destination: url.toString() });
      return `<a class="paid-post-link" href="/api/posts/links/${id}">${escapeHtml(label)}</a>`;
    },
  );
  return { html, links };
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
