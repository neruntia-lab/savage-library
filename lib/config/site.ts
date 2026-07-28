export const SITE_CONFIG = {
  name: "Savage Library",
  tagline: "Modules, classes, and subclasses for Foundry VTT.",
  description:
    "A focused archive of authorized Foundry VTT modules, classes, subclasses, PDFs, and documentation.",
  defaultPageSize: 12,
  maxPageSize: 48,
  supportEmail: "library@neruntia-lab.com",
} as const;

export const ROUTES = {
  home: "/",
  library: "/library",
  account: "/account",
  news: "/news",
  admin: "/admin",
  resource: (slug: string) => `/resources/${encodeURIComponent(slug)}`,
  category: (slug: string) => `/categories/${encodeURIComponent(slug)}`,
  download: (fileId: string) => `/api/downloads/${encodeURIComponent(fileId)}`,
} as const;

export const CATEGORY_LINKS = [
  {
    name: "Foundry VTT Modules",
    slug: "foundry-modules",
    description: "Installable packages and manifests.",
  },
  {
    name: "Classes",
    slug: "classes",
    description: "Complete class resources.",
  },
  {
    name: "Subclasses",
    slug: "subclasses",
    description: "Focused character options.",
  },
  {
    name: "PDFs",
    slug: "pdfs",
    description: "Printable and reference documents.",
  },
] as const;
