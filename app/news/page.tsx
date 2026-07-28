import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts } from "../../lib/repositories/post-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "News",
  description: "The latest Savage Library releases and Patreon updates.",
};

export default async function NewsPage() {
  const posts = await listPublishedPosts().catch(() => []);
  return (
    <section className="section page-section">
      <div className="container">
        <div className="page-heading">
          <p className="eyebrow">From the archive</p>
          <h1>Latest news</h1>
          <p>Posts published once on Patreon and synchronized here automatically.</p>
        </div>
        <div className="news-grid">
          {posts.map((post) => (
            <article className="news-card" key={post.id}>
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  dateStyle: "long",
                })}
              </time>
              <h2>
                <Link href={`/news/${encodeURIComponent(post.slug)}`}>
                  {post.title}
                </Link>
              </h2>
              <p>{excerpt(post.sanitizedHtml)}</p>
              <Link href={`/news/${encodeURIComponent(post.slug)}`}>Read post</Link>
            </article>
          ))}
          {!posts.length ? (
            <div className="empty-state">
              <h2>No synchronized posts yet</h2>
              <p>Patreon updates will appear after the first synchronization.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function excerpt(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
}
