# Arquitectura de integración Predict ↔ MIR Quest

Fase 4.5 fija la frontera arquitectónica entre el dominio de estudio y el dominio de conocimiento. No se implementan modelos predictivos, no se toca la base de datos del usuario, no se importan PDFs y no se conecta ningún LLM.

## Dos dominios

```
+---------------------------+          +-----------------------------+
|      MIR QUEST            |          |      PREDICT ENGINE         |
|      (study)              |          |      (knowledge)            |
|                           |          |                             |
|  StudyState  Attempt      |          |  HistoricalExam             |
|  ErrorEntry  Flashcard    |          |  HistoricalQuestion         |
|  SRS  XP  streak          |          |  SourceDocument  Chunk      |
|  ExamAttempt  settings    |          |  CurriculumMapping          |
|                           |          |  Classification             |
|  Escribe: solo lo suyo    |          |  QuestionFeatures           |
|                           |          |  PredictionResult/Feature   |
|                           |          |  Backtest  ModelVersion     |
|                           |          |  DatasetVersion             |
+-------------+-------------+          +--------------+--------------+
              |                                       |
              |        solo DTO serializables         |
              +---------------------------------------+
```

Regla central: ningún dominio escribe sobre entidades del otro. La comunicación ocurre únicamente por DTO.

## Ownership

```
study    ->  StudyState, Attempt, ErrorEntry, Flashcard, SRS, XP,
             streak, ExamAttempt, userSettings

knowledge -> HistoricalExam, HistoricalQuestion, SourceDocument,
             DocumentChunk, CurriculumMapping, Classification,
             QuestionFeatures, TopicFeatures,
             HistoricalExamDistribution, PredictionResult,
             PredictionFeature, PredictionEvidence, Backtest,
             ModelVersion, DatasetVersion
```

El catálogo vive en `web/src/predict/ownership.ts` y expone `ownerOf`, `canWrite`, `checkWrite` y `assertWriteAllowed`. La función `knowledgeCanWriteStudyEntities()` devuelve siempre una lista vacía: Predict no puede escribir nada del dominio de estudio.

## Dirección de dependencias

```
React (páginas)  --->  DTO de src/predict  --->  (futuro) servicios reales
      |                                              |
      v                                              v
  StudyState (propio)                        Motor de conocimiento
      ^                                              |
      |                                              |
      +------- nunca escribe ------------------------ +
```

- MIR Quest consume DTO, nunca modelos internos ni la base de datos del motor.
- Predict no importa React, ni el almacenamiento local, ni el SRS.
- Ambas reglas están automatizadas en `web/src/predict/boundary.test.ts`.

## Flujo de datos

```
SourceDocument
      |  extracción
      v
ExtractionResult  --(dudas)-->  QuarantineQuestion (revisión humana)
      |                                 |
      |  solo accepted                  |  approved
      v                                 v
  Classification  ->  CurriculumMapping (capa de dominios clínicos)
      |
      v
  QuestionFeatures / TopicFeatures
      |
      v
  PredictionResult  +  PredictionEvidence (cita documental)
      |
      v
  SimulationManifest  ->  conjunto ordenado reproducible
```

## Reproducibilidad

Cada simulación registra semilla, versiones y hash SHA-256. La regla probada es: misma semilla + mismo dataset + misma configuración = mismo conjunto ordenado de preguntas.

## Estados y cuarentena

Estados de documento: `pending`, `processing`, `indexed`, `failed`, `outdated`.
Estados de extracción: `accepted`, `quarantined`, `rejected`.

Solo lo `accepted` alimenta estadísticas, features, predicciones y simulacros. Una pregunta en cuarentena conserva el material original para revisión humana.

## Qué NO está conectado

- Modelos predictivos y cálculo de probabilidades.
- Importación de preguntas reales y de PDFs.
- LLM externos: solo interfaces y adaptadores stub.
- Servidor de producción: los handlers son mock y devuelven 501.
