import type { CatalogFacets, ResourceDetails } from "../domain/resource";
import { toSummary } from "../services/catalog";

const savageAuthor = {
  id: "author-jose-felipe",
  name: "José Felipe",
  slug: "jose-felipe",
  websiteUrl: "https://github.com/Master-Estmon-Hub",
};

const neruntiaAuthor = {
  id: "author-neruntia-lab",
  name: "Neruntia Lab",
  slug: "neruntia-lab",
  websiteUrl: "https://github.com/neruntia-lab",
};

const dnd5e = {
  id: "system-dnd5e",
  name: "D&D 5e",
  slug: "dnd5e",
};

const systemAgnostic = {
  id: "system-agnostic",
  name: "System Agnostic",
  slug: "system-agnostic",
};

const categories = {
  modules: {
    id: "category-foundry-modules",
    name: "Foundry VTT Modules",
    slug: "foundry-modules",
  },
  classes: {
    id: "category-classes",
    name: "Classes",
    slug: "classes",
  },
  subclasses: {
    id: "category-subclasses",
    name: "Subclasses",
    slug: "subclasses",
  },
  pdfs: {
    id: "category-pdfs",
    name: "PDFs",
    slug: "pdfs",
  },
  macros: {
    id: "category-macros",
    name: "Macros",
    slug: "macros",
  },
};

export const SEED_RESOURCES: ResourceDetails[] = [
  {
    id: "resource-savage-craft",
    slug: "savage-craft",
    title: "Savage Craft",
    shortDescription:
      "A D&D 5e crafting system with recipes, manuals, and Mastercrafted progression.",
    description:
      "Build a complete crafting loop in Foundry VTT with learnable recipes, recipe manuals, and Mastercrafted progression.",
    resourceType: "module",
    category: categories.modules,
    author: savageAuthor,
    gameSystem: dnd5e,
    currentVersion: "1.2.1",
    foundryMinimum: "11",
    foundryVerified: "13",
    foundryMaximum: "14",
    compatibilityStatus: "verified",
    compatibilityNotes:
      "Verified on Foundry VTT 13 with D&D 5e. Foundry 14 support is declared but not yet verified.",
    pricing: "free",
    tags: [
      { id: "tag-crafting", name: "Crafting", slug: "crafting" },
      { id: "tag-automation", name: "Automation", slug: "automation" },
      { id: "tag-bilingual", name: "Bilingual", slug: "bilingual" },
    ],
    thumbnailUrl: "/logo.png",
    coverUrl: "/logo.png",
    isFeatured: true,
    downloadCount: 1842,
    popularityScore: 98,
    publishedAt: "2026-06-04T16:00:00.000Z",
    updatedAt: "2026-07-16T20:42:58.000Z",
    installationInstructions:
      "In Foundry VTT, open Add-on Modules, choose Install Module, paste the manifest URL, and select Install. Enable Savage Craft in the target world.",
    licenseName: "All rights reserved — distributed with permission",
    manifestUrl:
      "https://github.com/Master-Estmon-Hub/Savage-Craft/releases/latest/download/module.json",
    projectUrl: "https://github.com/Master-Estmon-Hub/Savage-Craft",
    files: [],
    dependencies: [],
    changelog: [
      {
        id: "change-savage-craft-121",
        version: "1.2.1",
        summary: "Compatibility and recipe workflow update",
        details:
          "Improved Foundry VTT 13 compatibility and refined recipe progression.",
        publishedAt: "2026-07-16T20:42:58.000Z",
      },
      {
        id: "change-savage-craft-120",
        version: "1.2.0",
        summary: "Mastercrafted progression",
        details: "Added advanced crafting progression and recipe manuals.",
        publishedAt: "2026-06-04T16:00:00.000Z",
      },
    ],
    relatedResources: [],
  },
  {
    id: "resource-savage-training",
    slug: "savage-training",
    title: "Savage Training",
    shortDescription:
      "Downtime training tools for tracking proficiencies, time, and progress.",
    description:
      "A compact Foundry VTT module for running structured downtime training and tracking character progress.",
    resourceType: "module",
    category: categories.modules,
    author: neruntiaAuthor,
    gameSystem: dnd5e,
    currentVersion: "0.9.0",
    foundryMinimum: "12",
    foundryVerified: "13",
    foundryMaximum: "13",
    compatibilityStatus: "verified",
    compatibilityNotes: "Verified on Foundry VTT 13.",
    pricing: "free",
    tags: [
      { id: "tag-downtime", name: "Downtime", slug: "downtime" },
      { id: "tag-training", name: "Training", slug: "training" },
    ],
    thumbnailUrl: "/logo.png",
    coverUrl: "/logo.png",
    isFeatured: true,
    downloadCount: 736,
    popularityScore: 81,
    publishedAt: "2026-06-03T21:41:51.000Z",
    updatedAt: "2026-07-02T18:10:00.000Z",
    installationInstructions:
      "Upload the module package from Foundry VTT Setup, then enable Savage Training in the world module settings.",
    licenseName: "All rights reserved — distributed with permission",
    files: [],
    dependencies: [],
    changelog: [
      {
        id: "change-savage-training-090",
        version: "0.9.0",
        summary: "Public preview release",
        details: "Added training clocks, progress tracking, and activity notes.",
        publishedAt: "2026-07-02T18:10:00.000Z",
      },
    ],
    relatedResources: [],
  },
  {
    id: "resource-vanguard-class",
    slug: "vanguard-class",
    title: "Vanguard Class",
    shortDescription:
      "A tactical front-line class focused on positioning and battlefield control.",
    description:
      "A playtest-ready class with tactical stances, command options, and level-by-level advancement.",
    resourceType: "class",
    category: categories.classes,
    author: neruntiaAuthor,
    gameSystem: dnd5e,
    className: "Vanguard",
    currentVersion: "1.0.0",
    foundryMinimum: "12",
    foundryVerified: "13",
    foundryMaximum: "13",
    compatibilityStatus: "verified",
    pricing: "free",
    tags: [
      { id: "tag-martial", name: "Martial", slug: "martial" },
      { id: "tag-tactical", name: "Tactical", slug: "tactical" },
    ],
    thumbnailUrl: "/logo.png",
    coverUrl: "/logo.png",
    isFeatured: false,
    downloadCount: 524,
    popularityScore: 72,
    publishedAt: "2026-05-18T17:00:00.000Z",
    updatedAt: "2026-06-21T13:30:00.000Z",
    installationInstructions:
      "Use the PDF as a table reference or import the companion package from the Files section when available.",
    licenseName: "Savage Library Community License",
    files: [],
    dependencies: [],
    changelog: [
      {
        id: "change-vanguard-100",
        version: "1.0.0",
        summary: "Initial release",
        details: "Complete class progression and Foundry-ready item data.",
        publishedAt: "2026-05-18T17:00:00.000Z",
      },
    ],
    relatedResources: [],
  },
  {
    id: "resource-ashbound-subclass",
    slug: "ashbound-vanguard",
    title: "Ashbound Vanguard",
    shortDescription:
      "A fire-scarred Vanguard subclass built around endurance and retaliation.",
    description:
      "A focused subclass option with defensive reactions, heat mechanics, and a compact Foundry VTT implementation.",
    resourceType: "subclass",
    category: categories.subclasses,
    author: neruntiaAuthor,
    gameSystem: dnd5e,
    className: "Vanguard",
    subclassName: "Ashbound",
    currentVersion: "1.0.1",
    foundryMinimum: "12",
    foundryVerified: "13",
    foundryMaximum: "13",
    compatibilityStatus: "verified",
    pricing: "premium",
    priceLabel: "$3",
    tags: [
      { id: "tag-fire", name: "Fire", slug: "fire" },
      { id: "tag-defense", name: "Defense", slug: "defense" },
    ],
    thumbnailUrl: "/logo.png",
    coverUrl: "/logo.png",
    isFeatured: false,
    downloadCount: 238,
    popularityScore: 67,
    publishedAt: "2026-06-12T15:00:00.000Z",
    updatedAt: "2026-07-10T19:20:00.000Z",
    installationInstructions:
      "Add the subclass features to an existing Vanguard actor or install the companion Foundry package.",
    licenseName: "Personal-use license",
    files: [],
    dependencies: [
      {
        id: "dependency-vanguard",
        name: "Vanguard Class",
        versionRange: ">=1.0.0",
        url: "/resources/vanguard-class",
        isRequired: true,
      },
    ],
    changelog: [
      {
        id: "change-ashbound-101",
        version: "1.0.1",
        summary: "Clarified reaction timing",
        details: "Updated feature wording and Foundry automation notes.",
        publishedAt: "2026-07-10T19:20:00.000Z",
      },
    ],
    relatedResources: [],
  },
  {
    id: "resource-installation-guide",
    slug: "foundry-module-installation-guide",
    title: "Foundry Module Installation Guide",
    shortDescription:
      "A concise guide to manifests, package uploads, dependencies, and updates.",
    description:
      "A printable reference for installing, enabling, updating, and troubleshooting Foundry VTT modules.",
    resourceType: "pdf",
    category: categories.pdfs,
    author: neruntiaAuthor,
    gameSystem: systemAgnostic,
    currentVersion: "1.1",
    compatibilityStatus: "compatible",
    pricing: "free",
    tags: [
      { id: "tag-guide", name: "Guide", slug: "guide" },
      { id: "tag-installation", name: "Installation", slug: "installation" },
    ],
    thumbnailUrl: "/logo.png",
    coverUrl: "/logo.png",
    isFeatured: true,
    downloadCount: 1205,
    popularityScore: 88,
    publishedAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-07-08T12:00:00.000Z",
    licenseName: "CC BY-NC 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
    files: [],
    dependencies: [],
    changelog: [
      {
        id: "change-guide-11",
        version: "1.1",
        summary: "Added Foundry VTT 13 notes",
        details: "Updated the interface references and troubleshooting checklist.",
        publishedAt: "2026-07-08T12:00:00.000Z",
      },
    ],
    relatedResources: [],
  },
];

for (const resource of SEED_RESOURCES) {
  resource.relatedResources = SEED_RESOURCES.filter(
    (candidate) =>
      candidate.id !== resource.id &&
      (candidate.category.slug === resource.category.slug ||
        candidate.gameSystem.slug === resource.gameSystem.slug),
  )
    .slice(0, 3)
    .map(toSummary);
}

export const SEED_FACETS: CatalogFacets = {
  authors: [savageAuthor, neruntiaAuthor],
  categories: Object.values(categories),
  gameSystems: [dnd5e, systemAgnostic],
  tags: Array.from(
    new Map(
      SEED_RESOURCES.flatMap((resource) =>
        resource.tags.map((tag) => [tag.id, tag]),
      ),
    ).values(),
  ),
  foundryVersions: ["11", "12", "13", "14"],
  moduleVersions: Array.from(
    new Set(SEED_RESOURCES.map((resource) => resource.currentVersion)),
  ).sort(),
  classes: Array.from(
    new Set(
      SEED_RESOURCES.map((resource) => resource.className).filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ).sort(),
};
