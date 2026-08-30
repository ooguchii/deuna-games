import { cpuCatalog } from "./hardware-catalog";
import type { HardwarePart } from "./types";

export type CpuMatchMethod =
  | "exact-name"
  | "contained-name"
  | "exact-model"
  | "token-suggestion";

export type CpuNameMatch = {
  cpu: HardwarePart;
  confidence: number;
  method: CpuMatchMethod;
  matchedTokens: number;
  totalTokens: number;
};

const genericTokens = new Set([
  "amd",
  "intel",
  "cpu",
  "processor",
  "processors",
  "core",
  "cores",
  "gen",
  "generation",
  "mobile",
  "desktop",
  "series",
  "with",
  "radeon",
  "graphics",
]);

function stripBoilerplate(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[™®©]/g, " ")
    .replace(/\((?:tm|r|c)\)/g, " ")
    .replace(/@\s*\d+(?:[.,]\d+)?\s*(?:ghz|mhz)\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:ghz|mhz)\b/g, " ")
    .replace(/\b\d+\s*[- ]\s*core(?:s)?\b/g, " ")
    .replace(/\b\d+\s+core(?:s)?\b/g, " ")
    .replace(/\b\d+(?:st|nd|rd|th)\s+gen(?:eration)?\b/g, " ")
    .replace(/\b(?:cpu|processor|processors)\b/g, " ")
    .replace(/\bmobile\s+processor\b/g, " ")
    .replace(/\bwith\s+radeon\s+graphics\b/g, " ")
    .replace(/\bwith\s+radeon\s+\d+[a-z0-9-]*\s+graphics\b/g, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCpuName(value: string) {
  return stripBoilerplate(value);
}

function normalizedTokens(value: string) {
  return normalizeCpuName(value)
    .split(/\s+/)
    .filter(Boolean);
}

function meaningfulTokens(value: string) {
  return normalizedTokens(value).filter(
    (token) => !genericTokens.has(token)
  );
}

function vendorOf(value: string) {
  const normalized = normalizeCpuName(value);
  if (/\bintel\b/.test(normalized)) return "intel";
  if (/\bamd\b/.test(normalized)) return "amd";
  return null;
}

function compactModel(value: string) {
  const normalized = normalizeCpuName(value);

  const ultra = normalized.match(
    /\bcore\s+ultra\s+([579])\s+(\d{3}[a-z]{0,3})(?:\s+(plus))?\b/
  );
  if (ultra) {
    return `core-ultra-${ultra[1]}-${ultra[2]}${ultra[3] ? "-plus" : ""}`;
  }

  const intelCore = normalized.match(
    /\bi([3579])\s*(\d{4,5}[a-z0-9]{0,5})\b/
  );
  if (intelCore) {
    return `i${intelCore[1]}-${intelCore[2]}`;
  }

  const ryzen = normalized.match(
    /\bryzen\s+([3579])\s+(\d{4}[a-z0-9]{0,6})\b/
  );
  if (ryzen) {
    return `ryzen-${ryzen[1]}-${ryzen[2]}`;
  }

  const ryzenAi = normalized.match(
    /\bryzen\s+ai\s+([579])\s+(?:(hx)\s+)?(\d{3})\b/
  );
  if (ryzenAi) {
    return `ryzen-ai-${ryzenAi[1]}-${ryzenAi[2] ? "hx-" : ""}${ryzenAi[3]}`;
  }

  const ryzenAiMax = normalized.match(
    /\bryzen\s+ai\s+max(?:\s+|\+|\s+plus\s+)(?:pro\s+)?(\d{3})\b/
  );
  if (ryzenAiMax) {
    return `ryzen-ai-max-${ryzenAiMax[1]}`;
  }

  const fx = normalized.match(/\bfx\s*(\d{4})\b/);
  if (fx) return `fx-${fx[1]}`;

  const athlon = normalized.match(
    /\bathlon\s+(\d{4}[a-z]{0,2})\b/
  );
  if (athlon) return `athlon-${athlon[1]}`;

  const aSeries = normalized.match(
    /\ba(\d{1,2})\s+(\d{4}[a-z]{0,2})\b/
  );
  if (aSeries) return `a${aSeries[1]}-${aSeries[2]}`;

  return null;
}

export function cpuModelKey(value: string) {
  return compactModel(value);
}

function wholePhraseContains(
  input: string,
  candidate: string
) {
  return (` ${input} `).includes(` ${candidate} `);
}

function tokenSuggestion(
  rawInput: string,
  cpu: HardwarePart
): CpuNameMatch | null {
  const inputVendor = vendorOf(rawInput);
  const cpuVendor = vendorOf(cpu.name);
  if (inputVendor && cpuVendor && inputVendor !== cpuVendor) {
    return null;
  }

  const inputTokens = new Set(meaningfulTokens(rawInput));
  const cpuTokens = meaningfulTokens(cpu.name);
  if (inputTokens.size === 0 || cpuTokens.length === 0) {
    return null;
  }

  const modelTokens = cpuTokens.filter((token) => /\d/.test(token));
  if (
    modelTokens.length > 0 &&
    !modelTokens.some((token) => inputTokens.has(token))
  ) {
    return null;
  }

  const matchedTokens = cpuTokens.filter((token) =>
    inputTokens.has(token)
  ).length;
  const ratio = matchedTokens / cpuTokens.length;

  if (ratio < 0.58) return null;

  return {
    cpu,
    confidence: Math.min(0.89, 0.55 + ratio * 0.34),
    method: "token-suggestion",
    matchedTokens,
    totalTokens: cpuTokens.length,
  };
}

function compareMatches(a: CpuNameMatch, b: CpuNameMatch) {
  if (a.confidence !== b.confidence) {
    return b.confidence - a.confidence;
  }
  if (a.matchedTokens !== b.matchedTokens) {
    return b.matchedTokens - a.matchedTokens;
  }
  if (a.totalTokens !== b.totalTokens) {
    return b.totalTokens - a.totalTokens;
  }
  return b.cpu.name.length - a.cpu.name.length;
}

export function suggestCpuNames(
  rawInput: string,
  limit = 5
): CpuNameMatch[] {
  const normalizedInput = normalizeCpuName(rawInput);
  if (!normalizedInput) return [];

  const inputModel = compactModel(rawInput);
  const inputVendor = vendorOf(rawInput);
  const matches = new Map<string, CpuNameMatch>();

  for (const cpu of cpuCatalog) {
    const normalizedCpu = normalizeCpuName(cpu.name);
    const cpuTokens = meaningfulTokens(cpu.name);
    const cpuVendor = vendorOf(cpu.name);
    let match: CpuNameMatch | null = null;

    if (normalizedInput === normalizedCpu) {
      match = {
        cpu,
        confidence: 1,
        method: "exact-name",
        matchedTokens: cpuTokens.length,
        totalTokens: cpuTokens.length,
      };
    } else if (wholePhraseContains(normalizedInput, normalizedCpu)) {
      match = {
        cpu,
        confidence: 0.995,
        method: "contained-name",
        matchedTokens: cpuTokens.length,
        totalTokens: cpuTokens.length,
      };
    } else {
      const cpuModel = compactModel(cpu.name);
      if (
        inputModel &&
        cpuModel &&
        inputModel === cpuModel &&
        (!inputVendor || !cpuVendor || inputVendor === cpuVendor)
      ) {
        match = {
          cpu,
          confidence: 0.985,
          method: "exact-model",
          matchedTokens: cpuTokens.length,
          totalTokens: cpuTokens.length,
        };
      } else {
        match = tokenSuggestion(rawInput, cpu);
      }
    }

    if (!match) continue;
    const previous = matches.get(cpu.id);
    if (!previous || match.confidence > previous.confidence) {
      matches.set(cpu.id, match);
    }
  }

  return [...matches.values()]
    .sort(compareMatches)
    .slice(0, Math.max(1, limit));
}

export function matchCpuName(
  rawInput: string
): CpuNameMatch | null {
  const suggestions = suggestCpuNames(rawInput, 3);
  const best = suggestions[0];
  if (!best || best.confidence < 0.96) return null;

  const second = suggestions[1];
  if (
    second &&
    second.confidence >= 0.96 &&
    best.confidence - second.confidence < 0.02
  ) {
    return null;
  }

  return best;
}
