from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: se esperaba 1 coincidencia y se encontraron {count}: {old!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


def regex_sub_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{path}: patrón esperado no encontrado o repetido: {pattern!r} (count={count})")
    file.write_text(updated, encoding="utf-8")


# 1) El catálogo final ya no oculta colisiones: CI garantiza unicidad antes de componer.
replace_once(
    "src/features/game-finder/hardware-catalog.ts",
    '''function mergeHardwareCatalog(\n  base: readonly HardwarePart[],\n  expansion: readonly HardwarePart[]\n): HardwarePart[] {\n  const merged = [...base];\n  const ids = new Set(merged.map((part) => part.id));\n  const names = new Set(\n    merged.map((part) => part.name.toLowerCase())\n  );\n\n  for (const part of expansion) {\n    const normalizedName = part.name.toLowerCase();\n\n    if (ids.has(part.id) || names.has(normalizedName)) {\n      continue;\n    }\n\n    merged.push(part);\n    ids.add(part.id);\n    names.add(normalizedName);\n  }\n\n  return merged.sort((a, b) =>\n    a.name.localeCompare(b.name, "en", {\n      numeric: true,\n    })\n  );\n}\n\nexport const cpuCatalog = mergeHardwareCatalog(\n  baseCpuCatalog,\n  cpuCatalogExpansion\n);\n\nexport const gpuCatalog = mergeHardwareCatalog(\n  baseGpuCatalog,\n  gpuCatalogExpansion\n);''',
    '''function composeHardwareCatalog(\n  base: readonly HardwarePart[],\n  expansion: readonly HardwarePart[]\n): HardwarePart[] {\n  return [...base, ...expansion].sort((a, b) =>\n    a.name.localeCompare(b.name, "en", {\n      numeric: true,\n    })\n  );\n}\n\nexport const cpuCatalog = composeHardwareCatalog(\n  baseCpuCatalog,\n  cpuCatalogExpansion\n);\n\nexport const gpuCatalog = composeHardwareCatalog(\n  baseGpuCatalog,\n  gpuCatalogExpansion\n);''',
)

# 2) El menú móvil deja de depender de un checkbox oculto. React es la única fuente de verdad.
replace_once(
    "src/components/layout/Header.tsx",
    'const MOBILE_MENU_ID = "deuna-mobile-menu-toggle";\n\n',
    "",
)

regex_sub_once(
    "src/components/layout/Header.tsx",
    r'''\n      <input\n        id=\{MOBILE_MENU_ID\}\n        type="checkbox"\n        className=\{styles\.mobileMenuToggle\}\n        checked=\{mobileMenuOpen\}\n        readOnly\n        aria-hidden="true"\n        tabIndex=\{-1\}\n      />\n''',
    "\n",
)

replace_once(
    "src/components/layout/Header.tsx",
    '              className={styles.menuButton}\n',
    '              className={`${styles.menuButton} ${mobileMenuOpen ? styles.menuButtonOpen : ""}`}\n',
)

replace_once(
    "src/components/layout/Header.tsx",
    '        className={styles.mobileNativePanel}\n',
    '        className={`${styles.mobileNativePanel} ${mobileMenuOpen ? styles.mobileNativePanelOpen : ""}`}\n',
)

css_path = Path("src/components/layout/Header.module.css")
css = css_path.read_text(encoding="utf-8")

css = css.replace(
    "MENÚ MÓVIL V4 — CHECKBOX NATIVO",
    "MENÚ MÓVIL V5 — ESTADO REACT",
)
css = css.replace(
    "La animación ya no depende de <details>.\n   El panel SIEMPRE está renderizado y cambia de estado\n   mediante :checked, por eso anima cada vez.",
    "El panel siempre está renderizado y React aplica\n   clases de estado explícitas para abrir/cerrar y animar.",
)

css, removed = re.subn(
    r'''\n\.mobileMenuToggle \{.*?\n\}\n''',
    "\n",
    css,
    count=1,
    flags=re.S,
)
if removed != 1:
    raise SystemExit(f"Header.module.css: no se pudo retirar mobileMenuToggle (count={removed})")

selector_replacements = [
    (
        r"\.mobileMenuToggle:checked\s*~\s*\.header\s*\.menuButton",
        ".menuButtonOpen",
    ),
    (
        r"\.mobileMenuToggle:checked\s*~\s*\.header\s*\.menuOpenIcon",
        ".menuButtonOpen\n.menuOpenIcon",
    ),
    (
        r"\.mobileMenuToggle:checked\s*~\s*\.header\s*\.menuCloseIcon",
        ".menuButtonOpen\n.menuCloseIcon",
    ),
    (
        r"\.mobileMenuToggle:checked\s*~\s*\.mobileNativePanel",
        ".mobileNativePanelOpen",
    ),
]

for pattern, replacement in selector_replacements:
    css = re.sub(pattern, replacement, css)

# Última referencia histórica: aparecía sólo en una lista de reduced-motion.
css = css.replace("  .mobileMenuToggle,\n", "")

if "mobileMenuToggle" in css:
    leftovers = [
        line.strip()
        for line in css.splitlines()
        if "mobileMenuToggle" in line
    ]
    raise SystemExit(
        "Header.module.css: quedaron selectores del checkbox oculto: "
        + " | ".join(leftovers)
    )

css_path.write_text(css, encoding="utf-8")

header = Path("src/components/layout/Header.tsx").read_text(encoding="utf-8")
if "mobileMenuToggle" in header or "MOBILE_MENU_ID" in header or 'type="checkbox"' in header:
    raise SystemExit("Header.tsx: quedó un residuo del checkbox del menú")

catalog = Path("src/features/game-finder/hardware-catalog.ts").read_text(encoding="utf-8")
if "mergeHardwareCatalog" in catalog or "ids.has" in catalog or "names.has" in catalog:
    raise SystemExit("hardware-catalog.ts: quedó deduplicación silenciosa")

print("Limpieza V3 aplicada: catálogo estricto y menú móvil sin checkbox oculto.")
