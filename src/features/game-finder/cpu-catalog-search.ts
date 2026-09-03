import { cpuCatalog } from "./hardware-catalog";
import type { HardwarePart } from "./types";

export type CpuCatalogSearchResult = {
  total: number;
  items: HardwarePart[];
};

export function normalizeCpuCatalogSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesAllTerms(cpuName: string, query: string) {
  const terms = normalizeCpuCatalogSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return false;

  const searchable = normalizeCpuCatalogSearch(cpuName);
  return terms.every((term) => searchable.includes(term));
}

function searchPriority(cpuName: string, query: string) {
  const searchable = normalizeCpuCatalogSearch(cpuName);
  const normalizedQuery = normalizeCpuCatalogSearch(query);

  if (searchable === normalizedQuery) return 0;
  if (searchable.includes(normalizedQuery)) return 1;
  return 2;
}

export function searchCpuCatalog(
  query: string,
  limit = 10
): CpuCatalogSearchResult {
  if (!normalizeCpuCatalogSearch(query)) {
    return { total: 0, items: [] };
  }

  const matches = cpuCatalog
    .filter((cpu) => matchesAllTerms(cpu.name, query))
    .sort((a, b) => {
      const priorityDifference =
        searchPriority(a.name, query) - searchPriority(b.name, query);
      if (priorityDifference !== 0) return priorityDifference;
      return a.name.localeCompare(b.name, "es", { numeric: true });
    });

  return {
    total: matches.length,
    items: matches.slice(0, Math.max(1, limit)),
  };
}
