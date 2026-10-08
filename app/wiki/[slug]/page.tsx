import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPublicWiki } from "../../../lib/repositories/wiki-repository";
import { GuidePresentation } from "../../../components/wiki/GuidePresentation";
import { wikiLanguage } from "../../../lib/services/wiki";
import { renderWikiMarkdown } from "../../../lib/services/wiki-markdown";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const current = (await listPublicWiki()).find((g) => g.slug === slug);
  if (!current) notFound();
  const language = wikiLanguage(
    current.content,
    (await searchParams).lang === "es" ? "es" : "en",
  );
  return {
    title: language.translation.title,
    description: language.translation.summary,
  };
}
export default async function WikiGuidePage({ params, searchParams }: Props) {
  const slug = (await params).slug;
  const guide = (await listPublicWiki()).find((g) => g.slug === slug);
  if (!guide) notFound();
  const requestedLocale = (await searchParams).lang === "es" ? "es" : "en";
  const language = wikiLanguage(guide.content, requestedLocale);
  return (
    <section className="page-section">
      <div className="container">
        <GuidePresentation
          guide={guide}
          requestedLocale={requestedLocale}
          document={renderWikiMarkdown(language.translation.body)}
        />
      </div>
    </section>
  );
}
