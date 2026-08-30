import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

function resolveSourceAlias(specifier) {
  if (!specifier.startsWith("@/")) {
    return null;
  }

  const base = path.join(
    root,
    "src",
    specifier.slice(2)
  );
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];

  return candidates.find((candidate) =>
    existsSync(candidate)
  ) ?? null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const sourcePath = resolveSourceAlias(specifier);

    if (sourcePath) {
      return {
        url: pathToFileURL(sourcePath).href,
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },
});
