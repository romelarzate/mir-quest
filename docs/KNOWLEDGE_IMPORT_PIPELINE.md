# Pipeline de importación del Knowledge Warehouse

`KnowledgeImporter` recibe resultados de extracción, JSON o CSV. La extracción de PDF no está implementada: los mocks de entrada existen para probar el flujo completo.

## Etapas

```
INPUT           lee JSON, CSV o resultado de extracción
   |
VALIDATE        campos obligatorios, opciones, respuesta y procedencia
   |
NORMALIZE       recorta texto, normaliza etiquetas y acentos
   |
IDENTIFY        deriva la identidad interna estable (historicalQuestionId)
   |
DEDUPLICATE     hash exacto y hash de texto normalizado
   |
DECIDE          accepted | quarantined | rejected
   |
DATASET_VERSION crea el dataset, vincula preguntas y fija el estado
```

Las siete etapas se registran en el informe con un resumen por etapa.

## Validación

```
 questionNumber > 0
 stem no vacío
 al menos dos opciones
 exactamente una respuesta correcta marcada
 ninguna opción sin texto
 procedencia: page o rawText presentes
```

Si falla algo de lo anterior, el registro se **rechaza**. No hay material utilizable que revisar.

## Decisión

```
errores de validación            -> rejected (no se almacena)
duplicado en el lote o en la BD  -> rejected como duplicado
confianza por debajo del umbral  -> quarantined
resto                            -> accepted
```

Umbral por defecto: 0.8. Configurable por importación.

## Duplicados

```
exact-hash        mismo SHA-256 del enunciado            IMPLEMENTADO
normalized-text   mismo texto normalizado (sin acentos,
                  sin puntuación, minúsculas)             IMPLEMENTADO
semantic          contrato preparado                     NO IMPLEMENTADO
```

`findSemanticDuplicates` existe, devuelve `implemented: false` y no inventa coincidencias.

## Cuarentena

Una pregunta en cuarentena se almacena con `validation_status = "quarantined"` y genera una fila en `quarantine_question` con `review_status = "pending"`. Conserva texto original, extracción, confianza, errores, documento y página.

```
pending ──> approved      (revisión humana explícita)
        └─> rejected
```

Aislamiento garantizado en tres niveles:

1. La vista `usable_historical_question` excluye lo no aceptado.
2. `violatingQuarantineQuestionIds` detecta intentos de uso.
3. `assertQuarantineIsolation` lanza si se intenta usar material en cuarentena.

## Mocks de entrada

```
createMockJsonInput()       4 registros: 1 aceptada, 1 en cuarentena, 2 rechazadas (1 sin opciones, 1 duplicada)
createMockCsvInput()        2 filas: 1 aceptada, 1 sin respuesta marcada
createMockExtractionInput() 2 registros con confianza 0.88 y 0.35
```

Todo el contenido es texto marcador DEMO: no hay preguntas médicas, ni años, ni convocatorias inventadas.

## Informe de importación

```
ok             verdadero si no hay incidencias y hay alguna pregunta aceptada
stages[]       resumen por etapa
records[]      decisión por registro, con motivo y duplicado detectado
counts         total, accepted, quarantined, rejected, duplicates
datasetVersionId
datasetStatus  accepted | review
issues[]       incidencias legibles
```

## Qué NO hace

- No extrae texto de PDFs.
- No clasifica con LLM.
- No calcula features ni predicciones.
- No publica datasets: `published` se decide de forma explícita.
- No toca el Study Domain ni el SRS.
