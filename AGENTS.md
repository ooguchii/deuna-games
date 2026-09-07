<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Preferencias del usuario

- Después de completar y verificar cada cambio solicitado, crear un commit y subirlo al repositorio remoto en la rama de trabajo. Esta acción está autorizada por el usuario; no volver a pedir confirmación. Incluir únicamente los cambios correspondientes a la tarea.
- Después de cada cambio visual, iniciar el servidor con `npm run mobile:secure` y compartir la URL para que el usuario pueda probarlo. Si ya está activo, comprobar que sigue disponible y reutilizarlo.
- En cambios de la home o de su panel de control, revisar y verificar ambos lados. Para el hero, comprobar las previews de escritorio, tableta y móvil, la edición y la prueba interactiva con el mismo diseño y ancho que la home.

## Implementación y verificación integral de cada pedido

- Antes de modificar, entender el objetivo del usuario, revisar el flujo existente y definir criterios de aceptación observables. Identificar las pantallas, controles, datos y dependencias afectados; resolver el pedido completo sin añadir funcionalidades ajenas.
- Evaluar los aspectos pertinentes: experiencia de uso, coherencia visual, accesibilidad, adaptación a dispositivos, lógica, validación, persistencia, permisos, privacidad, rendimiento y compatibilidad con lo existente. Ajustar la profundidad al impacto del cambio.
- Para cada comportamiento nuevo o modificado, identificar acción, resultado esperado y forma de comprobarlo. Cubrir cada control y variante del flujo afectado, incluyendo los estados aplicables de carga, vacío, éxito, error, cancelación y reintento; no limitarse al caso exitoso.
- Probar las funciones interactivas en un navegador real: pulsar botones, completar formularios, navegar y comprobar los resultados. Verificar guardado tras recargar o volver a entrar y su reflejo en las pantallas relacionadas. Las capturas, la compilación y los análisis estáticos no sustituyen las pruebas funcionales.
- En cambios visuales, generar y abrir las capturas para inspeccionarlas realmente en escritorio, tableta y móvil. Revisar desbordamientos, legibilidad, alineación, estados interactivos, navegación por teclado, foco y controles táctiles según corresponda. Distinguir emulación de una prueba en dispositivo físico.
- Reutilizar las herramientas existentes de `package.json` y `tools/`: `lint`, `typecheck`, comprobaciones del área afectada y pruebas de navegador. Revisar los requisitos de cada script antes de ejecutarlo; `visual:smoke` incluye flujos que modifican datos y requieren un entorno local aislado y credenciales de prueba. No usar datos reales para pruebas destructivas ni exponer credenciales.
- Cuando la lógica o el riesgo lo justifiquen, añadir o actualizar pruebas automatizadas de comportamiento que detecten regresiones reales. Para ajustes simples y reversibles, basta una verificación directa adecuada; evitar tests que sólo busquen texto en el código o repitan la implementación.
- Verificar las integraciones y los flujos vecinos afectados. Corregir los fallos introducidos y repetir las comprobaciones pertinentes; ampliar las pruebas cuando el alcance o los resultados lo requieran.
- Conservar evidencia útil de la verificación: comandos y resultados, escenarios recorridos y capturas o informes cuando corresponda, sin datos sensibles. No afirmar que algo fue visto, probado o aprobado si no se ejecutó e inspeccionó realmente.
- Dar por terminado el pedido cuando sus criterios de aceptación estén comprobados. Si falta acceso, una herramienta o un servicio, avanzar con lo verificable y comunicar exactamente qué quedó sin probar y por qué; no presentar una verificación parcial como completa.
- Al entregar, resumir qué cambió, qué se probó y cualquier limitación pendiente. Cumplir las preferencias anteriores de commit, push y URL de prueba para cambios visuales.
