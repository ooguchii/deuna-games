import {
  defineConfig,
  globalIgnores,
} from "eslint/config";

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "deploy/**",
    "node_modules/**",
    "legacy-archive/**",
    "theme-recovery-backup-*/**",
    "payload/**",
    "DEUNA_ANALISIS_COMPLETO/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
