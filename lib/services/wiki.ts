import type { WikiContent, WikiLocale, PublicWikiGuide } from "../domain/wiki";

export class WikiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public errors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function validateWikiInput(value: unknown, publishing = false) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WikiError("Invalid guide data.");
  const input = value as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const text = (value: unknown, max: number, field: string) => {
    if (typeof value !== "string") {
      errors[field] = "Enter text for this field.";
      return "";
    }
    const result = value.replace(/\0/g, "").trim();
    if (result.length > max)
      errors[field] = `Use no more than ${max.toLocaleString()} characters.`;
    return result;
  };
  const slug = text(input.slug, 120, "slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    errors.slug = "Use lowercase letters, numbers, and hyphens.";
  const content = input.content as WikiContent | undefined;
  if (!content || !["en", "es"].includes(content.defaultLocale))
    throw new WikiError(
      "Choose English or Spanish as the default language.",
      400,
      { defaultLocale: "Choose a default language." },
    );
  const translations = Object.fromEntries(
    (["en", "es"] as const).map((locale) => {
      const translation = content.translations?.[locale];
      return [
        locale,
        {
          title: text(translation?.title, 180, `${locale}.title`),
          summary: text(translation?.summary, 240, `${locale}.summary`),
          body: text(translation?.body, 20_000, `${locale}.body`),
        },
      ];
    }),
  ) as WikiContent["translations"];
  if (!translations[content.defaultLocale].title)
    errors[`${content.defaultLocale}.title`] =
      "Enter a title in the default language.";
  if (publishing && !translations[content.defaultLocale].body)
    errors[`${content.defaultLocale}.body`] =
      "Enter the guide text before publishing.";
  if (
    input.moduleId !== null &&
    (typeof input.moduleId !== "string" || !input.moduleId.trim())
  )
    errors.moduleId = "Select a module or General guides.";
  if (Object.keys(errors).length)
    throw new WikiError("Please correct the highlighted fields.", 400, errors);
  return {
    slug,
    moduleId: input.moduleId as string | null,
    content: { defaultLocale: content.defaultLocale, translations },
  };
}

export function wikiLanguage(content: WikiContent, requested?: WikiLocale) {
  const complete = (locale: WikiLocale) =>
    Boolean(
      content.translations[locale]?.title && content.translations[locale]?.body,
    );
  const locale =
    requested && complete(requested) ? requested : content.defaultLocale;
  return {
    locale,
    translation: content.translations[locale],
    fallback: Boolean(requested && requested !== locale),
    available: (["en", "es"] as const).filter(complete),
  };
}

export function wikiPublicationFields(
  action: "draft" | "publish" | "unpublish",
  input: ReturnType<typeof validateWikiInput>,
  now: string,
) {
  if (action === "draft") return {};
  if (action === "unpublish")
    return {
      publishedContent: null,
      publishedSlug: null,
      publishedModuleId: null,
      publishedAt: null,
    };
  // Do not include unfinished translations in the public snapshot or search data.
  const content: WikiContent = {
    defaultLocale: input.content.defaultLocale,
    translations: {
      en: { ...input.content.translations.en },
      es: { ...input.content.translations.es },
    },
  };
  for (const locale of ["en", "es"] as const) {
    if (
      !content.translations[locale].title ||
      !content.translations[locale].body
    )
      content.translations[locale] = { title: "", summary: "", body: "" };
  }
  return {
    publishedContent: content,
    publishedSlug: input.slug,
    publishedModuleId: input.moduleId,
    publishedAt: now,
  };
}

export function browseWiki(
  guides: PublicWikiGuide[],
  query: string,
  moduleId: string,
  requestedPage: number,
) {
  const search = query.trim().slice(0, 120).toLowerCase();
  const matching = guides
    .filter(
      (guide) =>
        (!moduleId ||
          (moduleId === "general"
            ? !guide.module
            : guide.module?.id === moduleId)) &&
        `${guide.module?.title ?? ""} ${Object.values(
          guide.content.translations,
        )
          .map((t) => `${t.title} ${t.summary} ${t.body}`)
          .join(" ")}`
          .toLowerCase()
          .includes(search),
    )
    .sort(
      (a, b) =>
        b.publishedAt.localeCompare(a.publishedAt) ||
        a.slug.localeCompare(b.slug),
    );
  const pageCount = Math.max(1, Math.ceil(matching.length / 20));
  const page = Math.max(
    1,
    Math.min(
      pageCount,
      Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1,
    ),
  );
  return {
    items: matching.slice((page - 1) * 20, page * 20),
    page,
    pageCount,
    total: matching.length,
  };
}
