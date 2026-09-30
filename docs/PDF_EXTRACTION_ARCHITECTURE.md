# Arquitectura del extractor de PDF

> **Actualización Fase 5.6:** el extractor ya no está solo. Forma parte de una arquitectura documental mayor:
> `PDF/Text Source -> MIR Document Skill -> Canonical Markdown -> Extraction Service -> ExtractedQuestion -> Knowledge Core`.
> El Skill produce el Markdown canonico con artefactos, page map y validacion documental, y alimenta al extractor mediante un adaptador (`markdownSource`) que **no reimplementa validacion**.
> El extractor descrito en este documento sigue intacto: no se modifico ninguna de sus piezas. Ver `docs/MIR_DOCUMENT_SKILL.md`.

Fase 5.5 construye y valida el pipeline de extracción con **un único examen piloto**. No se importa el corpus, no se procesan varios años, no se conecta ningún LLM y no se implementa el Predict Engine.

## Decisión técnica: extracción por capa de texto, sin librería de PDF

Esta fase **no instala ninguna librería de PDF ni procesa binarios reales**. El servicio trabaja sobre la capa de texto que un futuro adaptador entregue, página a página. Motivos:

1. El objetivo es validar el pipeline (calidad, validadores, cuarentena, métricas, revisión), no el parseo binario.
2. Añadir una dependencia de PDF sin corpus autorizado no aporta valor verificable.
3. Separar «obtener texto» de «interpretar texto» permite sustituir el adaptador sin tocar la lógica.

## Piezas

```
PdfTextSource            (interfaz)  -> synthetic (fixtures) | not-implemented (PDF real)
        |
        v
TextLayerExtractionService        (implementado, v1)
        |
        +--> parsePage -> parseTextSegments   (marcadores, opciones, respuesta, tablas, imagenes)
        +--> mergeAcrossPages                 (union solo si continua el alfabeto de opciones)
        +--> validateQuestion / pageLevelErrors
        +--> buildExtractionQuality           (6 componentes, null cuando no se sabe)
        +--> decideStatus                     (accepted | quarantined | rejected)
        v
ExtractionRun  (preguntas + errores de pagina + trazabilidad)
```

## Interfaz del servicio

```ts
type PdfExtractionService = {
  id: string
  label: string
  status: "implemented" | "not-implemented"
  extract: (input: {
    document: SourceDocumentRef
    version: DocumentVersionRef
    source: PdfTextSource
  }) => Promise<ExtractionRun>
}
```

Cada `ExtractedQuestion` conserva: `sourceDocumentId`, `documentVersionId`, `page`, `pageEnd`, `rawText`, `questionNumber`, `options`, `detectedAnswer`, `confidence`, `validationStatus`, `validationErrors`, `quality`, `duplicateCandidate`, `splitAcrossPages` y `anomalousCharacterRatio`.

## Geometría variable: no se asume una sola maquetación

- `PdfPage.width` y `PdfPage.height` son opcionales: si faltan, la confianza de maquetación baja y queda registrado.
- `PdfPage.declaredColumns` y `PdfPage.columnTexts` permiten tratar páginas a dos columnas como dos flujos independientes.
- Si una página declara varias columnas y solo llega un flujo, se emite `possible-column-loss`.
- Si las etiquetas de opción aparecen intercaladas (`A, B, A, B`), se emite `possible-column-loss` en la pregunta.
- Las tablas (`| a | b |`) y las preguntas que dependen de imagen (`[figura]`) van a cuarentena.

## Unión entre páginas

Se une texto sin marcador de la página siguiente **solo si** concurren tres condiciones:

1. La pregunta anterior **no** está cerrada por una línea de respuesta.
2. El primer texto útil de la página nueva empieza por etiqueta de opción.
3. Esa etiqueta continúa el alfabeto respecto a la última opción vista (`B` -> `C`).

Cualquier otro texto suelto se convierte en un bloque propio sin número, que irá a cuarentena. Es preferible conservar material dudoso que descartarlo o fusionarlo a ciegas.

## Qué NO está implementado

- Lectura de PDF binario (sin librería, sin OCR).
- Detección geométrica real de columnas, tablas y figuras: llega declarada por la fuente.
- Recuperación del texto de una imagen.
- Clasificación con LLM y cualquier llamada de red.

## Firebase: qué podría migrar y qué no

La Fase 5.5 **no implementa Firebase**. Solo se documenta la frontera lógica.

**Candidatos a migrar posteriormente:**

| Artefacto | Motivo |
| --- | --- |
| `SourceDocument` | Metadatos y hash del material; encaja como documento con reglas de acceso. |
| `DocumentVersion` | Versiona el material y permite invalidar derivados. |
| `KnowledgeSnapshot` | Artefacto inmutable y verificable: ideal como respaldo compartido. |
| `ExtractionResult` | Resultado reproducible con trazabilidad a documento y página. |
| `QuarantineQuestion` | Cola de revisión compartida entre revisores. |

**No deben migrarse automáticamente:**

| Artefacto | Motivo |
| --- | --- |
| `StudyState` | Es progreso privado del usuario en su dispositivo. |
| `Flashcard` / `SRS` | Contienen datos de rendimiento personal y programación de repaso. |
| `user progress` (intentos, errores, XP, rachas) | Puede revelar debilidades del usuario; requiere consentimiento explícito. |

Regla: la nube puede recibir **material y resultados del motor**, nunca **el progreso del estudiante**, salvo autorización explícita y separada.
