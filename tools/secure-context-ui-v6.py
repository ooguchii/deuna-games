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


types = "src/features/game-finder/types.ts"
replace_once(
    types,
    '''export type BrowserHardwareSnapshot = {\n  logicalProcessors: number | null;''',
    '''export type BrowserHardwareSnapshot = {\n  secureContext: boolean;\n  logicalProcessors: number | null;''',
)

browser = "src/features/game-finder/browser-detection.ts"
replace_once(
    browser,
    '''export async function detectBrowserHardware(): Promise<BrowserHardwareSnapshot> {\n  const nav = navigator as NavigatorWithDeviceMemory;\n  const warnings: string[] = [];\n''',
    '''export async function detectBrowserHardware(): Promise<BrowserHardwareSnapshot> {\n  const nav = navigator as NavigatorWithDeviceMemory;\n  const warnings: string[] = [];\n  const secureContext = window.isSecureContext;\n''',
)
replace_once(
    browser,
    '''  if (!logicalProcessors) {\n    warnings.push("El navegador no informó procesadores lógicos.");''',
    '''  if (!secureContext) {\n    warnings.push(\n      "La página usa un contexto HTTP no seguro; WebGPU y parte de la detección avanzada pueden quedar limitados."\n    );\n  }\n\n  if (!logicalProcessors) {\n    warnings.push("El navegador no informó procesadores lógicos.");''',
)
replace_once(
    browser,
    '''  return {\n    logicalProcessors,''',
    '''  return {\n    secureContext,\n    logicalProcessors,''',
)

client = "src/features/game-finder/GameFinderClient.tsx"
replace_once(
    client,
    '''function detectionHint(\n  state: DetectionState,\n  profile: HardwareProfile | null\n) {''',
    '''function detectionHint(\n  state: DetectionState,\n  profile: HardwareProfile | null,\n  snapshot: BrowserHardwareSnapshot | null\n) {''',
)
replace_once(
    client,
    '''  if (state === "detecting") {\n    return "Leemos únicamente los datos que el navegador permite exponer.";\n  }\n  if (state === "error") {''',
    '''  if (state === "detecting") {\n    return "Leemos únicamente los datos que el navegador permite exponer.";\n  }\n  if (snapshot?.secureContext === false) {\n    return "Estás usando una conexión HTTP de red local: la web funciona, pero WebGPU y parte de la detección avanzada pueden quedar limitados. Para una lectura más completa usa HTTPS o localhost.";\n  }\n  if (state === "error") {''',
)
replace_once(
    client,
    '''        detectionHint={detectionHint(detectionState, hardware)}\n''',
    '''        detectionHint={detectionHint(detectionState, hardware, snapshot)}\n''',
)

# Guardas finales.
types_text = Path(types).read_text(encoding="utf-8")
browser_text = Path(browser).read_text(encoding="utf-8")
client_text = Path(client).read_text(encoding="utf-8")

if "secureContext: boolean;" not in types_text:
    raise SystemExit("types.ts: falta secureContext")
if "const secureContext = window.isSecureContext;" not in browser_text:
    raise SystemExit("browser-detection: no captura secureContext")
if "snapshot?.secureContext === false" not in client_text:
    raise SystemExit("GameFinderClient: no muestra advertencia de HTTP LAN")

print("V6 aplicada: aviso de contexto seguro integrado en la detección de hardware.")
