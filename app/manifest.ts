import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Savage Library",
    short_name: "Savage Library",
    description:
      "Authorized Foundry VTT modules, classes, subclasses, and PDFs.",
    start_url: "/",
    display: "standalone",
    background_color: "#0D0D0F",
    theme_color: "#D71920",
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
