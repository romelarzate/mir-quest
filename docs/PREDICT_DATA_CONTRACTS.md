# Contratos de datos Predict ↔ MIR Quest

Todos los DTO viven en `web/src/predict/dto.ts`. Son independientes de SQLite, serializables a JSON y son el único contrato que React puede consumir.

## DTO de entrada

```
HistoricalQuestionDTO
  questionId, examId, year, subjectId, topicId, subtopicId,
  clinicalDomainIds[], stem, sourceDocumentId, page,
  classificationConfidence, validationStatus, versions

HistoricalExamDTO
  examId, year, label, questionCount, sourceDocumentIds[], versions

DatasetMetadataDTO
  datasetVersion, label, createdAt, examCount, questionCount,
  acceptedQuestionCount, quarantinedQuestionCount,
  sourceDocumentCount, hash, isDemo

ModelMetadataDTO
  modelVersion, label, kind, calibrated, createdAt, notes
```

## DTO de salida

```
PredictionResultDTO
  predictionId, targetType, targetId,
  score                 (number | null)
  calibratedProbability (number | null)
  calibrationStatus     (not_calibrated | calibrated)
  features[], evidence[], datasetVersion, taxonomyVersion,
  featureVersion, modelVersion, generatedAt, warnings[]

PredictionFeatureDTO
  key, label, value, weight, contribution, available, rationale

PredictionEvidenceDTO
  documentId, chunkId, page, section, quote, sourceId

SimulationRequestDTO
  requestId, seed, questionCount, subjectIds[], topicIds[],
  clinicalDomainIds[], versions, requestedAt

SimulationResultDTO
  simulationId, manifest, questionIds[], status, warnings[]
```

## Reglas de validación

- Un DTO sin calibración no puede traer `calibratedProbability`: debe ser `null`.
- Una predicción calibrada exige `modelVersion`.
- Una variable no disponible no puede traer valor, peso ni contribución.
- La evidencia exige documento y fragmento.
- Un DTO de simulación exige semilla y cantidad positiva.
- El manifiesto y el resultado deben describir el mismo conjunto de preguntas.
- El hash principal declarado debe ser SHA-256.

Cada regla tiene su validador exportado (`validateHistoricalQuestionDTO`, `validatePredictionResultDTO`, `validateSimulationRequestDTO`, `validateSimulationResultDTO`, `validateDatasetMetadataDTO`, `validateModelMetadataDTO`, `validatePredictionFeatureDTO`, `validatePredictionEvidenceDTO`).

## Independencia de la base de datos

```
React  ->  DTO  ->  servicio  ->  (futuro) SQLite / motor
           ^
           |  aquí termina lo que React puede ver
```

Ningún componente importa un modelo interno del motor ni un cliente de base de datos. La prueba de frontera lo comprueba buscando `better-sqlite3`, `sqlite3`, `new Database(` y `createConnection(` dentro de `src/predict`.

## Servicios

```
HistoricalDataService   listExams, getExam, listQuestions
ExtractionService       extract, listQuarantine
ClassificationService   classify
FeatureService          questionFeatures, topicFeatures
PredictionService       predict
BacktestService         plan
SimulationService       plan
```

Dependencias: extracción → clasificación → features → predicción → backtest, con simulación apoyada en predicción y features. Ninguna interfaz importa React.

## Adaptadores LLM (stub)

```
LLMProvider: classify, extract, summarize, generateQuestion, generateFlashcard

OllamaProvider    stub  (classify, extract, summarize)
GeminiProvider    stub  (las cinco capacidades)
DeepSeekProvider  stub  (las cinco capacidades)
OpenAIProvider    stub  (las cinco capacidades)
```

Toda llamada devuelve `not-implemented`, `output: null` y la advertencia "Adaptador stub: sin SDK, sin claves y sin conexión de red".

## API conceptual

```
GET  /api/v1/predict/summary
GET  /api/v1/predict/topics
GET  /api/v1/predict/topics/:id
POST /api/v1/predict/simulations
GET  /api/v1/predict/simulations/:id
GET  /api/v1/predict/datasets
GET  /api/v1/predict/models
GET  /api/v1/predict/backtests
```

Todos exigen autenticación en el contrato. No hay servidor de producción: los handlers son mock/locales y responden 501 sin cuerpo inventado.
