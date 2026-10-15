import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function renderResourceMarkdown(markdown: string): string {
  let headingLevel = 1;
  const rendered = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;

  return sanitizeHtml(rendered, {
    allowedTags: [
      "p",
      "br",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "em",
      "del",
      "blockquote",
      "ul",
      "ol",
      "li",
      "hr",
      "pre",
      "code",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "loading", "decoding"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["https"],
    },
    allowProtocolRelative: false,
    exclusiveFilter(frame) {
      return frame.tag === "img" && !frame.attribs.src;
    },
    transformTags: {
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((level) => [
          `h${level}`,
          () => {
            headingLevel = Math.min(Math.max(2, level), headingLevel + 1);
            return { tagName: `h${headingLevel}`, attribs: {} };
          },
        ]),
      ),
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      img: (_tagName, attributes) => ({
        tagName: "img",
        attribs: {
          ...attributes,
          alt: attributes.alt ?? "",
          loading: "lazy",
          decoding: "async",
        },
      }),
    },
  });
}
