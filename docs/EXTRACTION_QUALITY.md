# Calidad multidimensional de la extracción

No se usa una única puntuación global. Cada pregunta lleva seis componentes; si un componente no puede determinarse queda **`null`** y se registra en `missingComponents`. No se inventa confianza.

## Componentes

```
textCompleteness              líneas no vacías / líneas totales del bloque
questionBoundaryConfidence    1.00 marcador + cierre limpio
                              0.75 unida entre páginas
                              0.50 bloque sin terminador
                              0.25 marcadores mezclados
                              null si no hay marcador
optionCompleteness            opciones detectadas / esperadas
                              esperadas = declaradas por el examen, o mayor etiqueta contigua
                              null si no hay referencia posible
answerKeyConfidence           1.00 patrón explícito "respuesta correcta: X"
                              0.70 paréntesis o marca suelta "respuesta: X"
                              0.00 sin respuesta (la ausencia sí es determinable)
layoutConfidence              1.00 base, con penalizaciones:
                              -0.20 geometría desconocida
                              -0.20 varias columnas declaradas
                              -0.40 etiquetas intercaladas
                              -0.50 marcadores de tabla
                              -0.60 dependencia de imagen
                              null si la página no aporta geometría ni texto
overallConfidence             media ponderada de los componentes disponibles,
                              renormalizada; null si no hay ninguno
```

## Pesos de la confianza global

```
textCompleteness              0.15
questionBoundaryConfidence    0.20
optionCompleteness            0.25
answerKeyConfidence           0.25
layoutConfidence              0.15
```

Si falta un componente, su peso se reparte entre los presentes. Un único componente al 100 % no da un 100 % global engañoso: se renormaliza y se declara qué faltó.

## Umbrales

```
minChars                  40     por debajo: text-too-short -> cuarentena
maxChars                4000     por encima: text-too-long  -> cuarentena
anomalousRatioWarn      0.05     por encima: anomalos -> cuarentena
anomalousRatioFatal     0.30     por encima: no hay material utilizable -> rechazo
```

## Validadores

| Código | Significado | Consecuencia |
| --- | --- | --- |
| `empty-question` | pregunta vacía | fatal |
| `truncated-question` | pregunta truncada | cuarentena |
| `missing-options` | opciones faltantes | cuarentena |
| `duplicate-options` | opciones duplicadas | cuarentena |
| `invalid-question-number` | número inválido o ausente | cuarentena |
| `sequence-mismatch` | secuencia incorrecta | cuarentena |
| `missing-answer` | respuesta inexistente | cuarentena |
| `answer-out-of-range` | respuesta fuera de A–E | cuarentena |
| `text-too-short` | texto sospechosamente corto | cuarentena |
| `text-too-long` | texto sospechosamente largo | cuarentena |
| `page-without-questions` | página sin preguntas | cuarentena (nivel página) |
| `multiple-questions-mixed` | varias preguntas mezcladas | cuarentena |
| `possible-column-loss` | posible pérdida de columnas | cuarentena |
| `anomalous-characters` | caracteres anómalos | cuarentena o fatal |
| `table-layout-unsupported` | maquetación en tabla | cuarentena |
| `image-dependent-question` | depende de una imagen | cuarentena |

Todos los errores se registran con `code`, `severity`, `consequence`, `message`, `questionNumber` y `page`, incluso cuando el resultado acaba aceptado.

## Regla de decisión

```
sin errores                                  -> accepted
con errores y con material utilizable        -> quarantined   (se conserva rawText)
con error fatal y sin material utilizable    -> rejected
```

Solo se rechaza cuando de verdad no hay nada que revisar: texto vacío o proporción de caracteres anómalos igual o superior a 0,30.
