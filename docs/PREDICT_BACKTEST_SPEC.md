# Especificación de backtesting

Fase 4.5 define el contrato de backtest. No se ejecuta ninguna prueba sobre datos reales y no se calculan métricas.

## Estructuras

```
BacktestRun
  backtestId, datasetVersion, featureVersion, modelVersion,
  createdAt, k, folds[], status: planned | not-implemented, warnings[]

BacktestFold
  foldId, trainingWindow { fromYear, toYear }, targetYear,
  questionCount, predictions[], metrics[]

BacktestPrediction
  targetType, targetId, score, calibratedProbability,
  rank, actualOutcome

BacktestMetric
  key, value, k, available, rationale
```

## Métricas previstas

```
precisionAtK      de las K primeras predicciones, cuántas aparecen de verdad
recallAtK         de las que aparecen de verdad, cuántas caen en las K primeras
brierScore        error cuadrático medio entre probabilidad y resultado
logLoss           penalización logarítmica de la probabilidad asignada
calibrationError  desviación entre probabilidad declarada y frecuencia observada
```

Las cinco nacen con `value: null` y `available: false`. Ninguna métrica se calcula en esta fase y `validateBacktestRun` falla si un backtest planificado trae una métrica disponible.

## Protocolo de ventanas

```
fold 1: train 2010-2015  ->  test 2016
fold 2: train 2010-2016  ->  test 2017
fold 3: train 2010-2017  ->  test 2018
```

Invariante: la ventana de entrenamiento no puede empezar después del año objetivo. La validación lo comprueba.

## Aislamiento de cuarentena

Un backtest solo puede usar preguntas `accepted`. Las preguntas en cuarentena y las rechazadas quedan fuera de entrenamiento y de evaluación, igual que en features y en predicción.

## Condiciones para poder ejecutarlo en el futuro

1. Dataset histórico verificado con procedencia y año fiables.
2. Al menos tres convocatorias comparables.
3. Features calculadas con `availability: ready` y fecha de cálculo.
4. Modelo registrado con `ModelVersion` y calibración validada si se quieren probabilidades.
5. Métricas calculadas por el servicio real, nunca estimadas a mano.

## Estado actual

```
npm test   -> contratos de backtest verificados
ejecución  -> no implementada
métricas   -> siempre null
```
