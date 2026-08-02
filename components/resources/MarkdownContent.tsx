import { renderResourceMarkdown } from "../../lib/services/resource-markdown";

export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: renderResourceMarkdown(markdown) }}
    />
  );
}
