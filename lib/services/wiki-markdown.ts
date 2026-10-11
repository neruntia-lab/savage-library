import { renderResourceMarkdown } from "./resource-markdown";

export function renderWikiMarkdown(markdown: string) {
  const headings: { id: string; title: string }[] = [];
  const html = renderResourceMarkdown(markdown).replace(
    /<h([1-6])>([\s\S]*?)<\/h\1>/g,
    (_match, level: string, body: string) => {
      const id = `wiki-section-${headings.length + 1}`;
      const title = body
        .replace(/<[^>]*>/g, "")
        .replace(
          /&(amp|lt|gt|quot|#39);/g,
          (_: string, entity: string) =>
            ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[entity]!,
        );
      headings.push({ id, title });
      const headingLevel = Math.max(2, Number(level));
      return `<h${headingLevel} id="${id}">${body}</h${headingLevel}>`;
    },
  );
  return { html, headings };
}
