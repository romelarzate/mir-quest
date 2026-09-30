# MIR Quest 2027 - Fase 2

Fase 2 se dividió internamente en tres hitos. Todo el trabajo se hizo dentro de `~/Projects/mir-quest`, sin publicar, sin claves reales y sin servicios externos.

## Hito 1 - Dominio, repositorios y almacenamiento

### Dominio

- `src/domain/types.ts`: tipos de `Question`, `Attempt`, `ErrorEntry`, `Flashcard`, `StudySettings` y `StudyState`, más `SCHEMA_VERSION`.
- `src/domain/srs.ts`: programador de repaso tipo SM-2 simplificado. Fallo reprograma en 10 minutos y suma lapso; las primeras respuestas buenas usan 1/2/4 días; después el intervalo se multiplica por la facilidad, acotada entre 1.3 y 2.8.
- `src/domain/selectors.ts`: métricas derivadas puras (precisión, intentos por día, racha, errores abiertos, tarjetas vencidas, actividad por día de la semana).
- `src/domain/migrations.ts`: registro de migraciones con versión 0 = estado heredado de Fase 1.5 (solo tema en `localStorage`).

### Almacenamiento

- `src/storage/localStore.ts`: clave `mir-quest-state`, validación de forma, serialización, almacenamiento de memoria inyectable para pruebas, y estados de carga `ok | missing | migrated | corrupt | newer`.
- Un estado de una versión más nueva que la app no se sobrescribe: se carga solo en memoria y se marca `persistenceBlocked`.

### Repositorios

- `src/repositories/studyStore.ts`: store sin dependencias de React con `recordAttempt`, `reviewFlashcard`, `addFlashcardForQuestion`, `setErrorResolved`, `updateSettings`, `resetAll`, `exportJson` e `importJson`.
- `src/repositories/useStudyStore.tsx`: `StudyProvider` con `useSyncExternalStore` para React.

## Hito 2 - Flujo de preguntas, errores y flashcards

- `src/data/questions.ts`: banco DEMO de 12 preguntas con explicación, dificultad y respuesta correcta.
- Al fallar una pregunta se registra el intento, se abre o incrementa la entrada de error y se crea una flashcard si no existía.
- Al acertar una pregunta con error abierto, ese error queda marcado como recuperado.
- `src/pages/QuestionsPage.tsx`: filtro por asignatura, intento registrado, corrección visible, explicación, objetivo diario y métricas reales.
- `src/pages/FlashcardsPage.tsx`: cola de vencidas, mostrar respuesta y cuatro calificaciones conectadas al SRS.
- `src/pages/SubjectDetail.tsx`: la pestaña Errores muestra los errores reales de Cardiología con acción de marcar como recuperado.
- `src/pages/Dashboard.tsx` y `src/pages/StatsPage.tsx`: métricas y gráficas calculadas desde el estado local. La estimación de netas sigue etiquetada como DEMO.

## Hito 3 - Ajustes, migraciones, pruebas y validación

### Ajustes

- `src/pages/SettingsPage.tsx`: objetivos diarios, explicación inmediata o diferida, tema sistema/claro/oscuro, exportar e importar JSON, borrado de datos con confirmación y panel de estado del esquema.
- El tema vive ahora en `settings.theme` y `index.html` lo restaura antes del primer render leyendo el estado nuevo y, como respaldo, la clave heredada.

### Migraciones

- Migración `0 -> 1` que crea el estado inicial y adopta el tema heredado de Fase 1.5.
- Prueba de invariante: las migraciones cubren de forma contigua desde la versión 0 hasta `SCHEMA_VERSION`.

### Pruebas

Comando: `npm test` (Vitest).

- `src/domain/srs.test.ts`: 7 pruebas.
- `src/domain/selectors.test.ts`: 8 pruebas.
- `src/domain/migrations.test.ts`: 5 pruebas.
- `src/storage/localStore.test.ts`: 9 pruebas.
- `src/repositories/studyStore.test.ts`: 15 pruebas.

Resultado: 5 archivos, 44 pruebas, todas en verde.

### Validación final en navegador

Hecha con Chrome headless por CDP contra el servidor local, en 1280x720 y 390x844.

- Respuesta incorrecta: estado visible, error abierto y flashcard creada.
- Flashcards: tarjeta vencida, mostrar respuesta habilita las calificaciones, "Bien" deja `reps = 1` e intervalo de 2 días con vencimiento futuro.
- Persistencia: recargar conserva intentos, errores y flashcards.
- Respuesta correcta posterior: el error queda resuelto y la precisión pasa a 50%.
- Explicación diferida: con la opción desactivada aparece "Comprobar respuesta" y el resultado solo tras pulsarla.
- Tema: cambiar a oscuro se conserva tras recargar y el script previo al render aplica la clase.
- Reinicio: borra intentos, errores y flashcards y conserva el tema.
- Pestaña Errores de Cardiología: lista el error real y lo resuelve.
- Sin scroll horizontal en las 11 rutas ni en escritorio.
- Consola sin errores de página.

Nota de sensibilidad: algunas comprobaciones de texto comparaban etiquetas como "Intentos hoy" mientras el CSS las renderiza en mayúsculas; se validó por captura y por interacción real.

### Capturas

- `docs/screenshots/phase-2-questions-desktop-1280x720.png`
- `docs/screenshots/phase-2-flashcards-mobile-390x844.png`
- `docs/screenshots/phase-2-settings-mobile-390x844.png`
- `docs/screenshots/phase-2-dashboard-desktop-1280x720.png`
- `docs/screenshots/phase-2-dashboard-mobile-dark-390x844.png`
- `docs/screenshots/phase-2-validation-report.json`

## Riesgos y límites

- La persistencia es local del navegador: borrar datos del sitio elimina el progreso.
- El banco DEMO es corto; no representa el temario MIR completo.
- Sin sincronización entre dispositivos ni cuentas reales.
- Ajustes y migraciones no cubren todavía escenarios de conflicto entre pestañas.
- El bundle sigue por encima de 500 kB por Recharts sin división de rutas.

## Siguiente fase sugerida

- Ampliar banco de preguntas y modelar asignaturas con contenido propio.
- División de rutas con carga diferida.
- Persistencia opcional en la nube solo con autorización explícita.
- Editor de flashcards y búsqueda global.
