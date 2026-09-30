# Predict MIR 2027 - Especificación de contratos

Esta fase define contratos, no cálculos. No existe ningún número, probabilidad ni índice real.

## Estado actual

- `unavailablePredictionEngine` devuelve `status: not-implemented`.
- `PredictionScore.value` es siempre `null` y `calibrated` es `false`.
- Todas las variables del catálogo tienen `value`, `weight` y `contribution` en `null` y `available: false`.
- Hay pruebas que fallan si aparece un valor numérico.

## Entradas previstas

- `HistoricalQuestion`: `questionId`, `examVersionId`, `year`, `subjectId`, `topicId`, `subtopicId`, `sourceIds`, `similarityGroupId`, `isDemo`.
- `ExamVersion`: `id`, `label`, `year`, `sourceIds`, `isDemo`, `notes`.

## Variables del motor

1. `questionFrequency`: frecuencia histórica de la pregunta.
2. `topicFrequency`: frecuencia del tema.
3. `recency`: peso por recencia.
4. `subjectDistribution`: distribución por asignatura.
5. `topicDistribution`: distribución por tema.
6. `recurrence`: recurrencia.
7. `trendShift`: cambio de tendencia.
8. `semanticSimilarity`: similitud semántica.
9. `examVersionCoverage`: cobertura de versiones de examen.
10. `appearanceIntervals`: intervalos entre apariciones.

## Salidas previstas

- `PredictionScore`: `value`, `scale` (probability o index), `calibrated`, `explanation`.
- `PredictionFeature`: `key`, `label`, `value`, `weight`, `contribution`, `available`, `rationale`.
- `PredictionResult`: identificadores consultados, `score`, `features`, `status`, `generatedAt`, `warnings`.
- `explainPrediction` devuelve la explicación en texto de qué variables faltan y por qué.
- `summarizePredictionAvailability` cuenta variables disponibles y pendientes.

## Tipos auxiliares

- `QuestionFrequency`: apariciones, versiones, años, primer y último año.
- `TopicFrequency`: número de preguntas, apariciones y cuota dentro de la asignatura.
- `RecencyWeight`: año, peso y justificación.
- `QuestionSimilarity`: par de preguntas, puntuación, método (none, lexical, embedding) y justificación.

## Requisitos para activar el motor

1. Corpus histórico verificado con procedencia y año fiables.
2. Al menos tres convocatorias comparables para tendencias.
3. Método de similitud elegido y autorizado.
4. Validación estadística y calibración antes de mostrar cualquier cifra.
5. Explicación obligatoria de qué variables contribuyeron al resultado.

## Reglas

- No se atribuye procedencia histórica a contenido DEMO.
- No se muestran probabilidades sin calibración.
- El motor debe declarar explícitamente las variables ausentes en lugar de rellenarlas.
