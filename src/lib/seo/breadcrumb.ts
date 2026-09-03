import {
  absoluteUrl,
} from "@/lib/site";

export function buildBreadcrumbJsonLd(
  currentLabel: string,
  currentPath: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: currentLabel,
        item: absoluteUrl(currentPath),
      },
    ],
  } as const;
}
