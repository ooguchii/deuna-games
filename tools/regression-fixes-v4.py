from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"{path}: se esperaba exactamente 1 coincidencia y se encontraron {count}: {old!r}"
        )
    file.write_text(text.replace(old, new), encoding="utf-8")


client = "src/features/game-finder/GameFinderClient.tsx"

# 1) Una opción explícitamente incierta no puede convertirse en SO confirmado.
replace_once(
    client,
    'const FAVORITES_STORAGE_KEY = "deuna-games:finder-favorites:v2";\n',
    'const FAVORITES_STORAGE_KEY = "deuna-games:finder-favorites:v2";\nconst UNCONFIRMED_OS_OPTION = "Otro / no estoy seguro";\n',
)
replace_once(
    client,
    '    os: profile?.os && profile.os !== "Sistema sin confirmar"\n      ? profile.os\n      : "Otro / no estoy seguro",',
    '    os: profile?.os && profile.os !== "Sistema sin confirmar"\n      ? profile.os\n      : UNCONFIRMED_OS_OPTION,',
)
replace_once(
    client,
    '  const runDetection = useCallback(async () => {\n',
    '  const runDetection = useCallback(async (preferredProfile: HardwareProfile | null = null) => {\n',
)
replace_once(
    client,
    '      const browserProfile = profileFromBrowserSnapshot(detected);\n',
    '      const browserProfile = profileFromBrowserSnapshot(detected, preferredProfile);\n',
)
replace_once(
    client,
    '    const ramGb = Number(manualDraft.ramGb);\n\n    if (!cpu || !gpu || !Number.isFinite(ramGb) || ramGb < 1 || ramGb > 256) return;\n\n    const manualProfile: HardwareProfile = {',
    '    const ramGb = Number(manualDraft.ramGb);\n    const osConfirmed =\n      manualDraft.os.trim().length > 0 &&\n      manualDraft.os !== UNCONFIRMED_OS_OPTION;\n\n    if (!cpu || !gpu || !Number.isFinite(ramGb) || ramGb < 1 || ramGb > 256) return;\n\n    const manualProfile: HardwareProfile = {',
)
replace_once(
    client,
    '      os: manualDraft.os || "Sistema sin confirmar",\n      osConfirmed: Boolean(manualDraft.os),',
    '      os: osConfirmed ? manualDraft.os : "Sistema sin confirmar",\n      osConfirmed,',
)
replace_once(
    client,
    '        onDetect={() => void runDetection()}\n',
    '        onDetect={() => void runDetection(hardware)}\n',
)
replace_once(
    client,
    '                    <option>Otro / no estoy seguro</option>\n',
    '                    <option>{UNCONFIRMED_OS_OPTION}</option>\n',
)

# 2) Con cero resultados visibles no debe aparecer un detalle de un juego fuera del filtro.
replace_once(
    client,
    '  const selectedGame =\n    visibleGames.find((game) => game.slug === selectedSlug) ??\n    visibleGames[0] ??\n    games[0];',
    '  const selectedGame =\n    visibleGames.find((game) => game.slug === selectedSlug) ??\n    visibleGames[0];',
)

# 3) La detección deja de leer localStorage de forma oculta: el llamador pasa un perfil
# confirmado actual cuando realmente debe conservarse.
browser = "src/features/game-finder/browser-detection.ts"
replace_once(
    browser,
    'import { readStoredHardwareProfile } from "./hardware-storage";\n',
    '',
)
replace_once(
    browser,
    'export function profileFromBrowserSnapshot(snapshot: BrowserHardwareSnapshot): HardwareProfile {\n  const detectedOs = detectOs(snapshot, navigator.userAgent);\n\n  // Un perfil confirmado manualmente sigue siendo más fiable para CPU/GPU/RAM,\n  // pero una relectura puede corregir el sistema operativo si UA-CH expone una\n  // versión inequívoca (por ejemplo Windows 10 frente a Windows 11).\n  const storedProfile = readStoredHardwareProfile();\n  if (storedProfile) {\n    const detectedIsSpecific = isSpecificDetectedOs(detectedOs);\n    const useDetectedOs =\n      detectedIsSpecific ||\n      storedProfile.osConfirmed !== true;\n\n    return {\n      ...storedProfile,\n      os: useDetectedOs ? detectedOs : storedProfile.os,\n      osConfirmed: useDetectedOs\n        ? detectedIsSpecific\n        : storedProfile.osConfirmed,\n    };\n  }',
    'export function profileFromBrowserSnapshot(\n  snapshot: BrowserHardwareSnapshot,\n  preferredProfile: HardwareProfile | null = null\n): HardwareProfile {\n  const detectedOs = detectOs(snapshot, navigator.userAgent);\n\n  // CPU/GPU/RAM confirmados manualmente siguen siendo más fiables que una\n  // lectura web. Una nueva detección sólo puede corregir el SO si UA-CH expone\n  // una versión inequívoca; perfiles automáticos anteriores sí se recalculan.\n  const confirmedProfile =\n    preferredProfile?.source === "manual" ||\n    preferredProfile?.source === "saved"\n      ? preferredProfile\n      : null;\n\n  if (confirmedProfile) {\n    const detectedIsSpecific = isSpecificDetectedOs(detectedOs);\n    const useDetectedOs =\n      detectedIsSpecific ||\n      confirmedProfile.osConfirmed !== true;\n\n    return {\n      ...confirmedProfile,\n      os: useDetectedOs ? detectedOs : confirmedProfile.os,\n      osConfirmed: useDetectedOs\n        ? detectedIsSpecific\n        : confirmedProfile.osConfirmed,\n    };\n  }',
)

# 4) Rama muerta: resolveSource rechazaba ID vacío antes de usar fallbackIndex.
download = "src/lib/games/download.ts"
replace_once(
    download,
    'function resolveSource(\n  source: GameDownloadSource,\n  fallbackIndex: number\n): ResolvedDownloadSource | null {',
    'function resolveSource(\n  source: GameDownloadSource\n): ResolvedDownloadSource | null {',
)
replace_once(
    download,
    '    id: id || `source-${fallbackIndex + 1}`,\n',
    '    id,\n',
)
replace_once(
    download,
    '  for (const [index, source] of\n    (config.sources ?? []).entries()) {\n    const resolved = resolveSource(\n      source,\n      index\n    );',
    '  for (const source of config.sources ?? []) {\n    const resolved = resolveSource(source);',
)

# Guardas finales: evitamos dejar el bug semántico o la dependencia oculta.
client_text = Path(client).read_text(encoding="utf-8")
browser_text = Path(browser).read_text(encoding="utf-8")
download_text = Path(download).read_text(encoding="utf-8")

if 'osConfirmed: Boolean(manualDraft.os)' in client_text:
    raise SystemExit("GameFinderClient: todavía confirma cualquier texto de SO")
if 'visibleGames[0] ??\n    games[0]' in client_text:
    raise SystemExit("GameFinderClient: todavía muestra un detalle fuera de filtros vacíos")
if 'readStoredHardwareProfile' in browser_text:
    raise SystemExit("browser-detection: todavía depende de localStorage")
if 'fallbackIndex' in download_text:
    raise SystemExit("download.ts: todavía contiene fallbackIndex muerto")

print("Regresión V4 corregida: SO incierto, filtros vacíos, redetección explícita y rama muerta de descarga.")
