from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: se esperaba 1 coincidencia y se encontraron {count}: {old!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


# 1) El checker debe detectar duplicados cruzados base <-> expansión antes de consolidar.
replace_once(
    "tools/check-data.mjs",
    "\nfunction makeExpansionId(name) {",
    '''\nfunction validateCrossCatalogDuplicates(\n  base,\n  expansion,\n  label,\n  errors\n) {\n  const baseIds = new Set(\n    base\n      .filter((item) => isNonEmptyString(item?.id))\n      .map((item) => item.id)\n  );\n  const baseNames = new Set(\n    base\n      .filter((item) => isNonEmptyString(item?.name))\n      .map((item) => item.name.trim().toLowerCase())\n  );\n\n  for (const [index, item] of expansion.entries()) {\n    const itemLabel =\n      isNonEmptyString(item?.id)\n        ? `${label}.${item.id}`\n        : `${label}[${index}]`;\n\n    if (\n      isNonEmptyString(item?.id) &&\n      baseIds.has(item.id)\n    ) {\n      errors.push(\n        `${itemLabel}: id duplicado entre catálogo base y expansión.`\n      );\n    }\n\n    if (isNonEmptyString(item?.name)) {\n      const normalizedName =\n        item.name.trim().toLowerCase();\n\n      if (baseNames.has(normalizedName)) {\n        errors.push(\n          `${itemLabel}: nombre duplicado entre catálogo base y expansión.`\n        );\n      }\n    }\n  }\n}\n\nfunction makeExpansionId(name) {''',
)

replace_once(
    "tools/check-data.mjs",
    '''validateHardwareCatalog(\n  gpuCatalogExpansion,\n  "gpuCatalogExpansion",\n  errors\n);\nvalidateHardwareCatalog(\n  cpuCatalog,\n  "cpuCatalog",\n  errors\n);''',
    '''validateHardwareCatalog(\n  gpuCatalogExpansion,\n  "gpuCatalogExpansion",\n  errors\n);\nvalidateCrossCatalogDuplicates(\n  baseCpuCatalog,\n  cpuCatalogExpansion,\n  "cpuCatalogExpansion",\n  errors\n);\nvalidateCrossCatalogDuplicates(\n  baseGpuCatalog,\n  gpuCatalogExpansion,\n  "gpuCatalogExpansion",\n  errors\n);\nvalidateHardwareCatalog(\n  cpuCatalog,\n  "cpuCatalog",\n  errors\n);''',
)

# 2) Un SO heredado sólo se considera fiable si la versión actual lo confirmó.
replace_once(
    "src/features/game-finder/types.ts",
    '''  os: string;\n  memoryMode: MemoryMode;''',
    '''  os: string;\n  osConfirmed?: boolean;\n  memoryMode: MemoryMode;''',
)

replace_once(
    "src/features/game-finder/hardware-storage.ts",
    '''      os?: unknown;\n      memoryMode?: unknown;''',
    '''      os?: unknown;\n      osConfirmed?: unknown;\n      memoryMode?: unknown;''',
)

replace_once(
    "src/features/game-finder/hardware-storage.ts",
    '''      os:\n        typeof value.os === "string" &&\n        value.os.trim()\n          ? value.os\n          : "Sistema sin confirmar",\n      memoryMode,''',
    '''      os:\n        value.osConfirmed === true &&\n        typeof value.os === "string" &&\n        value.os.trim()\n          ? value.os\n          : "Sistema sin confirmar",\n      osConfirmed: value.osConfirmed === true,\n      memoryMode,''',
)

replace_once(
    "src/features/game-finder/GameFinderClient.tsx",
    '''          os: hardware.os,\n          memoryMode: hardware.memoryMode,''',
    '''          os: hardware.os,\n          osConfirmed: hardware.osConfirmed === true,\n          memoryMode: hardware.memoryMode,''',
)

replace_once(
    "src/features/game-finder/GameFinderClient.tsx",
    '''      os: manualDraft.os || "Sistema sin confirmar",\n      memoryMode: gpu.integrated ? manualDraft.memoryMode : "unknown",''',
    '''      os: manualDraft.os || "Sistema sin confirmar",\n      osConfirmed: Boolean(manualDraft.os),\n      memoryMode: gpu.integrated ? manualDraft.memoryMode : "unknown",''',
)

replace_once(
    "src/features/game-finder/browser-detection.ts",
    '''  const storedProfile = readStoredHardwareProfile();\n  if (storedProfile) {\n    return {\n      ...storedProfile,\n      os: isSpecificDetectedOs(detectedOs) ? detectedOs : storedProfile.os,\n    };\n  }''',
    '''  const storedProfile = readStoredHardwareProfile();\n  if (storedProfile) {\n    const detectedIsSpecific = isSpecificDetectedOs(detectedOs);\n    const useDetectedOs =\n      detectedIsSpecific ||\n      storedProfile.osConfirmed !== true;\n\n    return {\n      ...storedProfile,\n      os: useDetectedOs ? detectedOs : storedProfile.os,\n      osConfirmed: useDetectedOs\n        ? detectedIsSpecific\n        : storedProfile.osConfirmed,\n    };\n  }''',
)

replace_once(
    "src/features/game-finder/browser-detection.ts",
    '''    os: detectedOs,\n    memoryMode: "unknown",''',
    '''    os: detectedOs,\n    osConfirmed: isSpecificDetectedOs(detectedOs),\n    memoryMode: "unknown",''',
)

# 3) El staging configurable nunca puede borrar el repositorio ni solaparse con deploy/.
replace_once(
    "tools/build-secure-deploy.mjs",
    '''async function exists(target) {''',
    '''function containsPath(parent, child) {\n  const relative = path.relative(\n    parent,\n    child\n  );\n\n  return (\n    relative === "" ||\n    (\n      relative !== ".." &&\n      !relative.startsWith(`..${path.sep}`) &&\n      !path.isAbsolute(relative)\n    )\n  );\n}\n\nfunction validateStageLocation() {\n  const filesystemRoot =\n    path.parse(stageBase).root;\n\n  if (stageBase === filesystemRoot) {\n    fail(\n      "DEUNA_SECURE_STAGE_DIR no puede apuntar a la raíz del sistema de archivos."\n    );\n  }\n\n  if (containsPath(stageBase, root)) {\n    fail(\n      "DEUNA_SECURE_STAGE_DIR no puede ser el repositorio ni una carpeta que lo contenga."\n    );\n  }\n\n  if (\n    containsPath(stageBase, deployRoot) ||\n    containsPath(deployRoot, stageBase)\n  ) {\n    fail(\n      "DEUNA_SECURE_STAGE_DIR no puede solaparse con deploy/."\n    );\n  }\n}\n\nasync function exists(target) {''',
)

replace_once(
    "tools/build-secure-deploy.mjs",
    '''const productionOrigin =\n  validateProductionSiteUrl();\n\nconsole.log(''',
    '''const productionOrigin =\n  validateProductionSiteUrl();\nvalidateStageLocation();\n\nconsole.log(''',
)

# 4) El menú móvil mantiene el foco dentro del panel y cancela el foco diferido al cerrar.
replace_once(
    "src/components/layout/Header.tsx",
    '''    const handleKeyDown = (event: KeyboardEvent) => {\n      if (event.key === "Escape") {\n        event.preventDefault();\n        closeMobileMenu(true);\n      }\n    };''',
    '''    const handleKeyDown = (event: KeyboardEvent) => {\n      if (event.key === "Escape") {\n        event.preventDefault();\n        closeMobileMenu(true);\n        return;\n      }\n\n      if (event.key !== "Tab") return;\n\n      const focusable =\n        mobilePanelRef.current?.querySelectorAll<HTMLElement>(\n          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'\n        );\n\n      if (!focusable?.length) {\n        event.preventDefault();\n        return;\n      }\n\n      const first = focusable[0];\n      const last = focusable[focusable.length - 1];\n      const active = document.activeElement;\n\n      if (event.shiftKey && active === first) {\n        event.preventDefault();\n        last.focus();\n      } else if (!event.shiftKey && active === last) {\n        event.preventDefault();\n        first.focus();\n      }\n    };''',
)

replace_once(
    "src/components/layout/Header.tsx",
    '''    window.requestAnimationFrame(() => {\n      mobilePanelRef.current\n        ?.querySelector<HTMLInputElement>('input[type="search"]')\n        ?.focus();\n    });\n\n    return () => {\n      document.body.style.overflow = previousOverflow;''',
    '''    const focusFrame = window.requestAnimationFrame(() => {\n      mobilePanelRef.current\n        ?.querySelector<HTMLInputElement>('input[type="search"]')\n        ?.focus();\n    });\n\n    return () => {\n      window.cancelAnimationFrame(focusFrame);\n      document.body.style.overflow = previousOverflow;''',
)

print("Regresiones de auditoría corregidas.")
