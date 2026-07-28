import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPost } from "../../../lib/repositories/post-repository";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug).catch(() => null);
  return post
    ? { title: post.title, description: post.sanitizedHtml.replace(/<[^>]+>/g, " ").slice(0, 155) }
    : { title: "Post not found" };
}

export default async function NewsPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPost(slug).catch(() => null);
  if (!post || !post.isPublished) notFound();
  return (
    <article className="section page-section">
      <div className="container narrow-container news-article">
        <p className="eyebrow">Savage Library update</p>
        <h1>{post.title}</h1>
        <time dateTime={post.publishedAt}>
          {new Date(post.publishedAt).toLocaleDateString("en-US", {
            dateStyle: "long",
          })}
        </time>
        <div
          className="news-body"
          dangerouslySetInnerHTML={{ __html: post.sanitizedHtml }}
        />
        <div className="profile-actions">
          <Link className="button button-secondary" href="/news">
            More news
          </Link>
          <a className="button button-secondary" href={post.sourceUrl}>
            View on Patreon
          </a>
        </div>
      </div>
    </article>
  );
}
