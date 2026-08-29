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
replace_once(
    client,
    '''  const genres = useMemo(() => {\n    return [...new Set(games.map((game) => game.category))].sort((a, b) => a.localeCompare(b, "es"));\n  }, [games]);''',
    '''  const heroRecommendations = useMemo(() => {\n    const rankedGames = [...games].sort((a, b) => {\n      const aEstimate = estimates.get(a.slug);\n      const bEstimate = estimates.get(b.slug);\n      const aReady = Boolean(aEstimate?.canEstimate);\n      const bReady = Boolean(bEstimate?.canEstimate);\n\n      if (aReady !== bReady) return aReady ? -1 : 1;\n      if (aReady && bReady) {\n        return (bEstimate?.fps ?? 0) - (aEstimate?.fps ?? 0);\n      }\n\n      // Sin un perfil suficiente conservamos el orden editorial original.\n      return 0;\n    });\n\n    return rankedGames.slice(0, 4).map((game) => ({\n      game,\n      estimate: estimates.get(game.slug) ?? null,\n    }));\n  }, [estimates, games]);\n\n  const genres = useMemo(() => {\n    return [...new Set(games.map((game) => game.category))].sort((a, b) => a.localeCompare(b, "es"));\n  }, [games]);''',
)
replace_once(
    client,
    '''        recommendations={games.slice(0, 4).map((game) => ({\n          game,\n          estimate: estimates.get(game.slug) ?? null,\n        }))}''',
    '''        recommendations={heroRecommendations}''',
)

hero = "src/features/game-finder/GameFinderUnifiedHero.tsx"
replace_once(
    hero,
    '''            <div className={styles.dots} aria-hidden="true">\n              <i className={styles.dotActive} />\n              <i />\n              <i />\n              <i />\n              <i />\n            </div>\n''',
    '',
)

css = "src/features/game-finder/GameFinderUnifiedHero.module.css"
replace_once(
    css,
    '''\n.dots {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.dots i {\n  width: 8px;\n  height: 3px;\n\n  border-radius: 999px;\n  background: #3d4654;\n}\n\n.dots .dotActive {\n  width: 15px;\n  background: var(--brand);\n}\n''',
    '\n',
)

client_text = Path(client).read_text(encoding="utf-8")
hero_text = Path(hero).read_text(encoding="utf-8")
css_text = Path(css).read_text(encoding="utf-8")

if 'recommendations={games.slice(0, 4)' in client_text:
    raise SystemExit("GameFinderClient: las recomendaciones siguen siendo un slice fijo")
if 'heroRecommendations' not in client_text:
    raise SystemExit("GameFinderClient: no se creó el ranking de recomendaciones")
if 'styles.dots' in hero_text or 'styles.dotActive' in hero_text:
    raise SystemExit("GameFinderUnifiedHero: quedó la paginación decorativa falsa")
if '.dots' in css_text or '.dotActive' in css_text:
    raise SystemExit("GameFinderUnifiedHero CSS: quedaron estilos huérfanos de dots")

print("V5 aplicada: recomendaciones por rendimiento real y sin paginación falsa.")
