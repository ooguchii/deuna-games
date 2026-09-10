#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

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
    candidates = []
    for spaces in range(0, 25):
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
    base = load_base()
    install_overrides(base)
    base.main()


if __name__ == "__main__":
    main()
