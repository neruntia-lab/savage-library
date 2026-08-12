import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAdminResource } from "../../../../../lib/repositories/resource-repository";
import { requireAdminPage } from "../../../../../lib/services/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false },
};

export default async function ResourcePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  if (!(await requireAdminPage())) redirect("/admin/login");
  const { id } = await params;
  const query = await searchParams;
  const resource = await getAdminResource(id).catch(() => null);
  if (!resource) notFound();
  const locale = query.lang === "es" ? "es" : "en";
  redirect(
    `/resources/${encodeURIComponent(resource.slug)}?lang=${locale}&preview=${encodeURIComponent(id)}`,
  );
}
