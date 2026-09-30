# Knowledge Data Warehouse

La Fase 4.5 está aprobada. La Fase 5 crea la persistencia del Knowledge Core. No se implementa el Predict Engine, no hay probabilidades, no hay backtesting real, no hay clasificación con LLM y no se conecta ninguna API.

## Tecnología elegida: SQLite mediante `node:sqlite`

| Criterio | Cómo lo cubre SQLite |
| --- | --- |
| Integridad relacional | Claves foráneas aplicadas de verdad con `PRAGMA foreign_keys = ON`, `CHECK` y `UNIQUE`. |
| Transacciones | `BEGIN`/`COMMIT`/`ROLLBACK` reales; toda importación se aplica de forma atómica. |
| Índices | Índices normales, únicos y sobre expresiones (`COALESCE`) para duplicados y secuencias. |
| Versionado | Tablas propias de versión de dataset y de esquema, con snapshots verificables. |
| Miles de preguntas | SQLite gestiona millones de filas en local sin servidor. |
| Python futuro | El módulo `sqlite3` de la biblioteca estándar lee el mismo fichero sin dependencias. |
| API futura | El fichero puede servirse desde un proceso Node o Python sin cambiar el esquema. |
| Backup | Copiar un fichero (más `-wal`/`-shm`), o exportar un snapshot JSON. |
| macOS local | Sin servidor, sin instalación y sin permisos especiales. |

`node:sqlite` viene incluido en Node 26 (`DatabaseSync`), así que no se añade ninguna dependencia al proyecto. Se verificó en esta máquina: SQLite 3.53.4 con claves foráneas aplicadas.

### Alternativas descartadas

- **PostgreSQL**: exige servidor, puerto y administración. No aporta nada en local para este volumen.
- **DuckDB**: excelente para analítica, pero más débil para escritura transaccional e integridad referencial estricta, que es justo lo que necesita un warehouse de ingesta.
- **Ficheros JSON**: sin integridad, sin consultas, sin índices y con riesgo de corrupción parcial.
- **Mezclarlo con el estado del Study Domain**: prohibido por el brief; rompería la separación de dominios.

## Diagrama del Knowledge Core

```
                        KNOWLEDGE DATA WAREHOUSE (SQLite local)

  source_document ──1:N──> document_version
        │                        │
        │                        ├──────────────> historical_exam
        │                        │                      │
        │                        │                      └──1:N──> historical_question
        │                        │                                     │
        │                        │                                     ├──1:N──> question_option
        │                        │                                     ├──1:N──> question_classification
        │                        │                                     └──1:N──> extraction_result
        │                        │                                                   │
        │                        │                                                   └──1:N──> quarantine_question
        │                        │
        └──1:N──> source_reference

  clinical_domain ──1:N──> question_classification
                 └──1:N──> curriculum_mapping

  dataset_version ──1:N──> dataset_question ──N:1──> historical_question

  vista: usable_historical_question (solo aceptadas y sin cuarentena pendiente)
```

## Frontera con el Study Domain

```
   MIR QUEST (study)                        PREDICT (knowledge)
   -----------------                        ------------------
   progreso · SRS · errores                 documentos · versiones
   flashcards · intentos · XP               exámenes · preguntas · opciones
   rachas · settings                        clasificación · procedencia
                                            extracción · cuarentena
                                            features futuras · datasets

   persistencia: localStorage               persistencia: SQLite local
   migraciones: StudyState                  migraciones: knowledge_migrations

   Ningún dominio escribe en el otro.       El warehouse no toca SRS ni StudyState.
```

## Ubicación y ficheros

```
web/src/knowledge/
  ids.ts             hashing SHA-256, texto normalizado, identidad interna
  schema.ts          DDL: tablas, índices, restricciones y vista
  migrations.ts      registro de migraciones del warehouse
  db.ts              apertura, PRAGMAs, transacciones, metadatos
  repositories.ts    inserción y consulta por entidad
  integrity.ts       comprobaciones de integridad y aislamiento de cuarentena
  duplicates.ts      duplicado exacto y textual; semántico preparado
  importPipeline.ts  KnowledgeImporter con siete etapas
  snapshots.ts       exportación reproducible de datasets
```

Base de datos por defecto: `web/.knowledge/knowledge.sqlite`, ignorada por Git. Se puede cambiar con `MIR_QUEST_KNOWLEDGE_DB`. En pruebas se usa `:memory:`.

## PRAGMAs activos

- `foreign_keys = ON`: la integridad referencial se aplica de verdad.
- `journal_mode = WAL`: lecturas y escrituras concurrentes.
- `busy_timeout = 5000`: evita fallos si otro proceso escribe.
- `synchronous = NORMAL`: equilibrio entre seguridad y velocidad en local.

## Backup

1. **Snapshot JSON** (recomendado para reproducibilidad): `createKnowledgeSnapshot()` produce dataset, esquema, taxonomía, hashes, preguntas, fecha y hash verificable.
2. **Copia del fichero**: detener escrituras y copiar `knowledge.sqlite` junto con `-wal` y `-shm`.

## Aislamiento respecto del Study Domain

- El warehouse no importa React, ni `src/storage`, ni `src/repositories`, ni el SRS.
- No lee ni escribe `mir-quest-state`. La única mención es la constante documental de `migrations.ts` que declara qué tabla pertenece al otro dominio.
- Una prueba automática recorre los ficheros del warehouse y falla si aparece una importación prohibida o la clave del Study Domain.
