import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";

const root = process.cwd();

function existingSource(base) {
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

function resolveSourceAlias(specifier) {
  if (!specifier.startsWith("@/")) {
    return null;
  }

  return existingSource(
    path.join(
      root,
      "src",
      specifier.slice(2)
    )
  );
}

function resolveRelativeSource(specifier, parentUrl) {
  if (
    !specifier.startsWith(".") ||
    !parentUrl?.startsWith("file:") ||
    path.extname(specifier)
  ) {
    return null;
  }

  const parentPath = fileURLToPath(parentUrl);
  return existingSource(
    path.resolve(
      path.dirname(parentPath),
      specifier
    )
  );
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const sourcePath =
      resolveSourceAlias(specifier) ??
      resolveRelativeSource(
        specifier,
        context.parentURL
      );

    if (sourcePath) {
      return {
        url: pathToFileURL(sourcePath).href,
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },
});
