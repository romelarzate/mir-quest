# MIR Quest 2027 - Fase 3: motor de contenido

Fase 3 transforma el prototipo con banco DEMO en una plataforma preparada para ingerir y estructurar el temario MIR completo. Todo el trabajo se hizo dentro de `~/Projects/mir-quest`, sin publicar, sin claves reales y sin conectar APIs.

## Hitos completados

1. Modelo de contenido MIR (`src/domain/types.ts`, `src/domain/content.ts`).
2. Temario jerárquico navegable MIR 2027 -> asignatura -> tema -> subtema (`src/data/curriculum.ts`).
3. Banco de preguntas refactorizado con tema, subtema, distractores explicados, dificultad, fuentes, año, versión de examen y etiquetas (`src/data/questions.ts`).
4. Flashcards ampliadas: origen (pregunta, manual, IA futura, error), vínculo a tema, subtema, error y fuentes.
5. Búsqueda global con `Cmd+K` / `Ctrl+K` y resultados agrupados por tipo (`src/domain/search.ts`, `src/components/GlobalSearch.tsx`).
6. Editor local de flashcards con crear, editar, eliminar, buscar y filtrar por asignatura, tema, dificultad, vencidas y errores.
7. Motor de simulacro local: configuración, examen, respuestas, resultado, revisión, errores y flashcards.
8. Contratos del futuro Predict MIR, sin calcular probabilidades (`src/domain/predict.ts`).
9. Importadores JSON, CSV y Markdown con validación (`src/domain/importers.ts`).
10. Pruebas: 133 en verde y build correcto.
11. Documentación: este informe, `CONTENT_SCHEMA.md`, `PREDICT_ENGINE_SPEC.md` e `IMPORT_FORMAT.md`.

## Compatibilidad y migraciones

- `SCHEMA_VERSION` pasó de 1 a 2.
- Migración `1 -> 2`: amplía las flashcards existentes con `origin`, `errorId`, `topicId`, `subtopicId`, `sourceIds` y `tags`, y añade `exams: []`.
- La migración `0 -> 1` sigue adoptando el tema heredado de Fase 1.5.
- El estado de versiones más nuevas que la app no se sobrescribe: se carga solo en memoria y se bloquea el guardado.
- Un estado antiguo con forma incorrecta se normaliza mediante migración; un estado de la versión actual con forma incorrecta se rechaza.

## Decisiones técnicas

- El modelo de contenido no se acopla a Cardiología: las 36 asignaturas usan los mismos identificadores que la lista de progreso, verificado por prueba.
- Los temas y subtemas cargados son marcadores estructurales DEMO, no temario médico real.
- Ninguna pregunta DEMO declara año ni versión de examen: `year` y `examVersionId` quedan a `null` y hay pruebas que lo impiden.
- La versión de examen `MIR 2027` existe como marcador vacío, sin preguntas históricas ni atribuciones.
- La selección de preguntas del simulacro es determinista (prioriza falladas, luego vistas, luego nuevas) para que sea reproducible y testeable.
- Se unificó `src/types.ts` como reexportación del modelo compartido para eliminar definiciones duplicadas.

## Pruebas

Antes de Fase 3: 5 archivos, 44 pruebas.
Después de Fase 3: 13 archivos, 133 pruebas, todas en verde.

- `src/domain/srs.test.ts`: 7
- `src/domain/selectors.test.ts`: 8
- `src/domain/content.test.ts`: 9
- `src/domain/migrations.test.ts`: 5
- `src/domain/search.test.ts`: 9
- `src/domain/exam.test.ts`: 14
- `src/domain/importers.test.ts`: 22
- `src/domain/predict.test.ts`: 8
- `src/storage/localStore.test.ts`: 10
- `src/repositories/studyStore.test.ts`: 15
- `src/repositories/studyStore.content.test.ts`: 9
- `src/data/curriculum.test.ts`: 10
- `src/data/questions.test.ts`: 7

Las pruebas existentes se conservaron; solo se actualizaron las aserciones de número de versión por el cambio legítimo de esquema, y el caso de forma incorrecta se dividió en dos: versión actual (se rechaza) y versión antigua (se migra).

## Build

`npm run build` correcto. Se mantiene el aviso de bundle mayor de 500 kB por Recharts sin división de rutas.

## Validación en navegador

Chrome headless por CDP contra el servidor local, en 390x844 y 1280x720:

- Búsqueda: `Ctrl+K` abre el diálogo, la consulta "arritm" encuentra el tema, `Enter` navega a Asignaturas y cierra el diálogo.
- Editor: crear tarjeta guarda origen `manual`, editar la actualiza y eliminar la quita del almacenamiento.
- Simulacro: 4 preguntas configuradas, dos respuestas, resultado mostrado, historial `exams: 1`, `attempts: 2`, `errors: 2` y `flashcards: 2`.
- Panel Predict visible con "Motor estadístico próximamente".
- Sin scroll horizontal en las 11 rutas ni en escritorio.
- Consola sin errores de página.

## Riesgos

- El temario cargado es DEMO: la jerarquía es real, el contenido no.
- La persistencia sigue siendo local del navegador, sin cuentas ni sincronización.
- Los importadores validan estructura, no verdad clínica: un dato médico correcto o incorrecto se acepta igual si el formato es válido.
- La búsqueda es lineal sobre un índice en memoria; con temario completo habrá que indexar de forma incremental.
- El bundle crecerá con el contenido real y necesitará división de rutas.

## Preparado para Gemini y File Search

- `ContentBlock` con `kind` (summary, note, reference, image, algorithm, table) y `sourceIds` es el punto natural de anclaje para fragmentos de documentos.
- `SourceReference` con `type` (demo, manual, authorized, historical, ai), `citation`, `url` y `year` permite trazabilidad de cada fragmento citado.
- Los importadores ya separan el contenido del transporte (JSON, CSV, Markdown) y validan referencias, así que un pipeline de documentos puede alimentar el mismo modelo.
- Ninguna llamada a red está implementada: no hay claves, endpoints ni SDK instalado.

## Preparado para Predict MIR 2027

- Contratos definidos: `HistoricalQuestion`, `ExamVersion`, `QuestionFrequency`, `TopicFrequency`, `RecencyWeight`, `QuestionSimilarity`, `PredictionScore`, `PredictionFeature` y `PredictionResult`.
- Catálogo de diez variables con `available: false` y valores `null`.
- Motor marcador que devuelve estado `not-implemented`, puntuación `null` y advertencias explícitas.
- Pruebas que garantizan que no se emite ningún número ni probabilidad en esta fase.

## Siguiente fase recomendada

1. Importar el programa oficial y el temario desde fuentes autorizadas usando `CurriculumImporter`.
2. Cargar preguntas reales con su procedencia verificada y versión de examen.
3. Indexar contenido por documento y preparar el contrato de fragmentos para File Search.
4. Dividir rutas con carga diferida antes de cargar contenido extenso.
5. Diseñar el motor Predict con datos históricos reales y validación estadística antes de mostrar cualquier cifra.
