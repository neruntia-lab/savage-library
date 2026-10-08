import type { PublicWikiGuide, AdminWikiGuide } from "../domain/wiki";
import { SEED_RESOURCES } from "./seed-resources";

export const WIKI_EXAMPLES: PublicWikiGuide[] = [
  {
    id: "sample-wiki-installation",
    slug: "sample-module-installation",
    sample: true,
    module: (() => {
      const resource = SEED_RESOURCES.find((r) => r.resourceType === "module")!;
      return { id: resource.id, slug: resource.slug, title: resource.title };
    })(),
    publishedAt: "2026-10-07T00:00:00.000Z",
    content: {
      defaultLocale: "en",
      translations: {
        en: {
          title: "Getting started with a module",
          summary: "A sample installation guide for the local design preview.",
          body: "## Before you begin\n\nCheck the module’s compatibility with your Foundry version.\n\n## Install the module\n\nCopy its public manifest URL into Foundry’s Install Module dialog.\n\n## Enable it in your world\n\nOpen Manage Modules and enable the installed module.\n\n> Sample documentation only. This guide is not published to production.",
        },
        es: {
          title: "Primeros pasos con un módulo",
          summary: "Guía de ejemplo para la vista previa local.",
          body: "## Antes de comenzar\n\nVerifica la compatibilidad del módulo con tu versión de Foundry.\n\n## Instala el módulo\n\nCopia la URL pública del manifiesto en el diálogo Instalar módulo.\n\n## Actívalo en tu mundo\n\nAbre Administrar módulos y activa el módulo instalado.\n\n> Documentación de ejemplo; no se publica en producción.",
        },
      },
    },
  },
  {
    id: "sample-wiki-general",
    slug: "sample-library-help",
    sample: true,
    module: null,
    publishedAt: "2026-10-06T00:00:00.000Z",
    content: {
      defaultLocale: "en",
      translations: {
        en: {
          title: "Finding documentation",
          summary: "Browse guides by module or search for a topic.",
          body: "## Find a guide\n\nUse the Wiki search and module selector to find documentation.\n\n## Read in your language\n\nChoose English or Español when a translation is available.\n\n> Sample documentation only.",
        },
        es: { title: "", summary: "", body: "" },
      },
    },
  },
];

export const WIKI_ADMIN_EXAMPLES: AdminWikiGuide[] = WIKI_EXAMPLES.map(
  (guide) => ({
    id: guide.id,
    slug: guide.slug,
    draft: guide.content,
    moduleId: guide.module?.id ?? null,
    isPublished: true,
    revision: 1,
    updatedAt: guide.publishedAt,
    publishedAt: guide.publishedAt,
  }),
);
