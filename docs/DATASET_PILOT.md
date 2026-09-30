# Dataset piloto y validación del extractor

Fase 5.5 ejecuta **un único examen piloto**. No se escala automáticamente al corpus.

## Examen procesado

No existe ningún PDF real en el proyecto y el brief prohíbe importar el corpus, así que el piloto se ejecuta sobre un **examen sintético** declarado como tal. El mecanismo es idéntico al que se usará con un PDF real: lo único que cambia es la fuente de texto.

```
Archivo      fixture-normal.txt
Tamaño       1536 bytes
Páginas      2
SHA-256      d238231dd34de89d4f01874dd2793f8c7895539a81ef2a52f227578b7d3e6491
Documento    doc_c75760bdf77dade5d7dd
Versión      docv_8aceee81808fc0d4a1d0
Fuente       synthetic-text-source
```

## Resultado del piloto

```
totalPages             2
pagesWithQuestions     2
questionsDetected      3
accepted               2
quarantined            1
rejected               0
duplicateCandidates    0
```

```
errores detectados
  invalid-question-number   1
  missing-options           1
  missing-answer            1
  text-too-short            1

distribución de calidad
  0.8-1.0   2
  0.2-0.4   1
```

## Métricas

```
extractionAcceptanceRate   0.667
quarantineRate             0.333
rejectionRate              0.000
optionDetectionRate        0.667
answerDetectionRate        0.667
sequenceIntegrityRate      1.000
```

**Advertencia obligatoria:** son tasas de resultado del pipeline sobre un examen sintético, **no** precisión del extractor. No existe ground truth humano todavía, así que ninguna de estas cifras se presenta como exactitud.

## Preguntas aceptadas

Las dos preguntas con marcador numérico, cuatro opciones y respuesta explícita. Calidad global en el cubo `0.8-1.0`.

## Preguntas en cuarentena

Una: el texto suelto de la segunda página, que no tiene número, tiene menos de dos opciones y no declara respuesta. Se conserva íntegro para revisión humana en lugar de descartarse.

## Preguntas rechazadas

Ninguna en el examen piloto. El rechazo solo ocurre sin material utilizable (texto vacío o ilegible), y se verificó con el fixture `fixture-empty`.

## Barrido de fixtures sintéticos

Once fixtures cubren los casos del brief y todos se comportan como estaba previsto:

```
fixture-normal          2 páginas, 2 aceptadas, 1 en cuarentena
fixture-two-columns     2 columnas declaradas, 2 aceptadas
fixture-columns-merged  etiquetas intercaladas -> cuarentena (possible-column-loss)
fixture-split-pages     pregunta partida -> unida y aceptada
fixture-table           tabla -> cuarentena (table-layout-unsupported)
fixture-image           figura -> cuarentena (image-dependent-question)
fixture-five-options    A-E -> aceptada
fixture-missing-answer  sin respuesta -> cuarentena
fixture-missing-number  sin número -> cuarentena
fixture-truncated       texto cortado -> cuarentena
fixture-empty           sin material -> rechazada
```

Los fixtures son texto escrito a mano: **no representan PDFs ni exámenes MIR reales**.

## Validación manual

Cada ejecución genera `extraction-review-queue.json` con, por pregunta: número, página, texto, opciones, respuesta, confianza, errores y estado. El revisor aplica `approve`, `quarantine` o `reject`; cada decisión registra `reviewedBy` y `reviewedAt`. La cola se exporta y se vuelve a aplicar sobre el resultado con `applyDecisionsToRun`. Nada se aprueba automáticamente.

## Ground truth

`ExtractionEvaluation` compara extracción contra referencia humana por pregunta y campo (`questionNumber`, `stem`, `options`, `answer`, `page`, `status`). La plantilla nace con `expected: null` y `match: null`: **el ground truth no se genera automáticamente**. Cuando una persona lo rellena, se calcula *acuerdo con la referencia humana*, nunca «precisión del extractor».

## Problemas detectados y ejemplos de error

```
invalid-question-number  "Sin número de pregunta válido."        -> cuarentena
missing-options          "Menos de dos opciones detectadas."     -> cuarentena
missing-answer           "No se detectó respuesta correcta."     -> cuarentena
text-too-short           "Texto por debajo de 40 caracteres."    -> cuarentena
possible-column-loss     "Etiquetas de opción intercaladas"      -> cuarentena
table-layout-unsupported "Se detectaron marcadores de tabla."    -> cuarentena
image-dependent-question "La pregunta parece depender de imagen" -> cuarentena
truncated-question       "El bloque termina sin cierre"          -> cuarentena
empty-question           "La pregunta no contiene texto."        -> rechazo
```

## Limitaciones

1. No hay lectura de PDF binario: se consume texto ya extraído.
2. Las columnas, tablas y figuras llegan declaradas por la fuente, no detectadas geométricamente.
3. La unión entre páginas usa una heurística conservadora y puede dejar en cuarentena una pregunta que un humano uniría.
4. Sin ground truth, ninguna métrica mide exactitud.
5. El piloto usa un examen sintético: la validación con un PDF real está pendiente.
6. La numeración se valida por bloque, no contra un índice oficial de examen.

## Recomendación para escalar

1. Implementar el adaptador de PDF real que entregue `PdfPage` con geometría, columnas y presencia de imágenes.
2. Ejecutar el piloto sobre **un** examen MIR real y rellenar el ground truth humano antes de tocar métricas.
3. Ajustar `minChars`, `maxChars` y el umbral de confianza con ese examen real, dejando registro de los cambios.
4. Solo después, ampliar a 2–3 exámenes y comparar tasas de cuarentena entre convocatorias.
5. Escalar al corpus completo **solo con autorización explícita** y con revisión humana de la cuarentena.

Los comandos de cierre son `npm test` (405 pruebas) y `npm run build`. El informe legible por máquina está en `docs/extraction-report.json` y la cola de revisión en `docs/extraction-review-queue.json`.
