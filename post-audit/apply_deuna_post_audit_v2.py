#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import shutil
import sys
from pathlib import Path

# Este wrapper importa el aplicador base. Evitamos que Python escriba .pyc dentro
# del propio checkout antes de que el verificador compruebe si Git está limpio.
sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
BASE_SCRIPT = HERE / "apply_deuna_post_audit.py"


def load_base():
    spec = importlib.util.spec_from_file_location("deuna_post_audit_base", BASE_SCRIPT)
    if spec is None or spec.loader is None:
        raise SystemExit(f"ERROR: no pude cargar {BASE_SCRIPT}.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def indent_block(text: str, spaces: int) -> str:
    if spaces == 0:
        return text
    prefix = " " * spaces
    return "\n".join(
        prefix + line if line else line
        for line in text.split("\n")
    )


def resolve_replacement(current: str, replacement, replacement_index: int):
    # La coincidencia exacta siempre gana. Esto evita que un patrón de una sola
    # línea embebido en JSON parezca coincidir también con variantes que sólo
    # agregan un espacio tomado del contexto anterior.
    exact_count = current.count(replacement.old)
    if exact_count == 1:
        return replacement.old, replacement.new
    if exact_count > 1:
        raise ValueError(
            f"reemplazo #{replacement_index}: el patrón exacto aparece {exact_count} veces"
        )

    # Sólo los bloques multilínea necesitan tolerancia de sangría. Un patrón de
    # una sola línea debe coincidir exactamente o abortar.
    if "\n" not in replacement.old:
        raise ValueError(
            f"reemplazo #{replacement_index}: el patrón exacto no aparece"
        )

    candidates = []
    for spaces in range(1, 25):
        old = indent_block(replacement.old, spaces)
        count = current.count(old)
        if count == 1:
            candidates.append((spaces, old, indent_block(replacement.new, spaces)))
        elif count > 1:
            raise ValueError(
                f"reemplazo #{replacement_index}: el patrón con sangría {spaces} "
                f"aparece {count} veces"
            )

    if len(candidates) != 1:
        found = ", ".join(str(spaces) for spaces, _, _ in candidates) or "ninguna"
        raise ValueError(
            f"reemplazo #{replacement_index}: no hay coincidencia única "
            f"(sangrías candidatas: {found})"
        )

    _, old, new = candidates[0]
    return old, new


def install_actual_checkout_overrides(base) -> None:
    # #21 del paquete base asumía que reconcileGameImageMedia estaba importado
    # en una sola línea. En master@218e0244 el import real está formateado como
    # bloque multilínea; reemplazamos exclusivamente ese descriptor para que el
    # handoff siga siendo exacto y no haga matching difuso.
    index = 20
    original = base.REPLACEMENTS[index]
    expected_path = "src/app/api/admin/content/games/[slug]/media/route.ts"
    if original.path != expected_path:
        raise SystemExit(
            "ERROR: cambió el orden interno del paquete post-audit; no puedo aplicar el override seguro #21."
        )

    base.REPLACEMENTS[index] = base.Replacement(
        expected_path,
        base.d(r'''
        import {
          reconcileGameImageMedia,
        } from "@/lib/media/game-image-media";
        '''),
        base.d(r'''
        import {
          resolveGameCardBaseImage,
        } from "@/lib/media/game-card-presentation";
        import {
          reconcileGameImageMedia,
        } from "@/lib/media/game-image-media";
        '''),
    )


def install_overrides(base):
    def verify_replacements(root: Path) -> None:
        staged_by_path = {}
        failed_paths = set()
        failures = []

        for index, replacement in enumerate(base.REPLACEMENTS, start=1):
            if replacement.path in failed_paths:
                continue

            current = staged_by_path.get(replacement.path)
            if current is None:
                target = root / replacement.path
                if not target.is_file():
                    failures.append(f"{replacement.path}: archivo ausente")
                    failed_paths.add(replacement.path)
                    continue
                current = target.read_text(encoding="utf-8")

            try:
                old, new = resolve_replacement(current, replacement, index)
            except ValueError as error:
                failures.append(f"{replacement.path}: {error}")
                failed_paths.add(replacement.path)
                continue

            staged_by_path[replacement.path] = current.replace(old, new, 1)

        checker = root / "tools/check-card-cover-post-audit.mjs"
        if checker.exists() and checker.read_text(encoding="utf-8") != base.NEW_CHECKER:
            failures.append(
                "tools/check-card-cover-post-audit.mjs: ya existe con contenido distinto"
            )

        if failures:
            print("ERROR: el paquete no coincide completamente con este checkout:", file=sys.stderr)
            for failure in failures:
                print(f"- {failure}", file=sys.stderr)
            raise SystemExit(
                "No apliqué ningún cambio. Envíame esta lista completa para ajustar el handoff."
            )

    def apply_changes(root: Path):
        staged = {}
        order = []
        for index, replacement in enumerate(base.REPLACEMENTS, start=1):
            if replacement.path not in staged:
                staged[replacement.path] = (root / replacement.path).read_text(encoding="utf-8")
                order.append(replacement.path)

            old, new = resolve_replacement(staged[replacement.path], replacement, index)
            staged[replacement.path] = staged[replacement.path].replace(old, new, 1)

        # Sólo escribimos después de haber resuelto todos los reemplazos en memoria.
        for relative_path in order:
            (root / relative_path).write_text(
                staged[relative_path], encoding="utf-8", newline="\n"
            )

        checker_path = root / "tools/check-card-cover-post-audit.mjs"
        checker_path.write_text(base.NEW_CHECKER, encoding="utf-8", newline="\n")
        return [*order, "tools/check-card-cover-post-audit.mjs"]

    base.verify_replacements = verify_replacements
    base.apply_changes = apply_changes


def main() -> None:
    # Versiones anteriores del wrapper podían dejar este cache antes de abortar.
    # Es artefacto generado por Python, no código del usuario ni del producto.
    shutil.rmtree(HERE / "__pycache__", ignore_errors=True)

    base = load_base()
    install_actual_checkout_overrides(base)
    install_overrides(base)
    base.main()


if __name__ == "__main__":
    main()
