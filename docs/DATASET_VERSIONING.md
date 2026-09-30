# Versionado de datasets y snapshots

## DatasetVersion

```
id                 identificador derivado de nombre y versión
name               nombre lógico del dataset
version            entero creciente por nombre
createdAt          fecha de creación
sourceHashes[]     hashes de los documentos de origen
questionCount      preguntas almacenadas (aceptadas + cuarentena)
acceptedCount      preguntas aceptadas
quarantineCount    preguntas en cuarentena
rejectedCount      registros rechazados en la importación
taxonomyVersion    versión de taxonomía usada
status             draft | processing | review | accepted | published
```

`questionCount` cuenta preguntas almacenadas; `rejectedCount` cuenta registros rechazados que no se almacenan porque no hay material que revisar. La restricción `accepted_count + quarantine_count <= question_count` refleja esa semántica.

## Ciclo de vida

```
draft ──> processing ──> review ──> accepted ──> published
                            ^            |
                            └────────────┘
```

- `draft`: creado sin procesar.
- `processing`: importación en curso.
- `review`: quedan preguntas en cuarentena o hubo rechazos.
- `accepted`: todo aceptado, sin cuarentena ni rechazos.
- `published`: **publicado dentro del Knowledge Core local**. No significa publicación en Internet. Se decide siempre de forma explícita; la importación nunca publica sola.

La importación asigna `processing` y termina en `accepted` o `review` según el resultado.

## Ejemplo real de importación DEMO

```
entrada   4 registros JSON DEMO
aceptadas 1
cuarentena 1   (confianza 0.42 por debajo del umbral 0.8)
rechazadas 2   (una sin opciones, una duplicada del lote)
estado    review
```

## Snapshots

Un snapshot es un artefacto de reproducibilidad y backup, nunca la base de datos principal.

```
KnowledgeSnapshot
  datasetVersion   "demo-dataset@1"
  schemaVersion    versión del esquema del warehouse
  taxonomyVersion  versión de taxonomía usada
  sourceHashes[]   hashes de los documentos de origen, ordenados
  questionIds[]    identificadores de las preguntas del dataset, ordenados
  generatedAt      fecha de generación
  hash             SHA-256 del contenido estable
```

Reglas:

1. Mismo dataset y misma fecha de generación producen el mismo hash.
2. `verifyKnowledgeSnapshot` recalcula el hash y comprueba que cada pregunta exista.
3. Un snapshot manipulado se detecta: el hash deja de coincidir.
4. Un dataset inexistente no produce snapshot.

## Migraciones

```
Study Domain     migraciones propias, versiones 0 a 3 (StudyState)
Knowledge Core   knowledge_migrations, versión 1 (esquema inicial)
```

Cada dominio lleva su propio registro. El warehouse nunca modifica las migraciones del Study Domain y viceversa. Las migraciones se aplican dentro de una transacción y una versión aplicada no se repite.
