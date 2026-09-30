# MIR Document Skill

Fase 5.6 convierte la capacidad documental de las fases anteriores en una pieza arquitectónica delimitada. **No se implementa** Gemini, OpenAI, DeepSeek, Ollama, File Search, Firebase, OCR, APIs externas, corpus MIR real, producción, autenticación, pagos ni Predict Engine, y **no se toca el frontend ni el StudyState**.

## 1. Propósito

Convertir material documental en **artefactos versionados** y **Markdown canónico auditable**, preservando procedencia, sin interpretar contenido clínico. El Skill es la puerta documental: nada entra al sistema sin dejar artefacto, hash y traza de página.

## 2. Inspección previa: qué se reutiliza y qué no se toca

**Se reutiliza sin duplicar:**

| Componente existente | Uso en el Skill |
| --- | --- |
| `knowledge/ids.ts` | `sha256`, `stableStringify`, `shortenId` para hashes y identificadores. |
| `extraction/types.ts` (`PdfPage`, `PdfTextSource`, `SourceDocumentRef`, `DocumentVersionRef`) | Modelo de entrada; el Skill no redefine páginas ni fuentes. |
| `extraction/fixtures.ts` | Los fixtures documentales reutilizan sus páginas donde encajan. |
| `extraction/pdfExtractionService.ts` | Sigue siendo el extractor; el Skill lo alimenta con Markdown vía adaptador. |
| `extraction/validators.ts` | La validación clínica/de pregunta permanece ahí, separada. |

**Se extiende:** el pipeline documental, añadiendo artefactos, Markdown canónico y page map por encima del extractor.

**Contrato nuevo:** `DocumentArtifact`, `CanonicalDocument`, `MarkdownBlock`, `DocumentPageMap`, `TraceabilityChain`, `DocumentArtifactStore`.

**No se modifica:** `extraction/textExtractor.ts`, `extraction/validators.ts`, `extraction/quality.ts`, `extraction/pdfExtractionService.ts`, `knowledge/{schema,migrations,repositories,integrity,snapshots}.ts`, `predict/*`, `domain/*` y ninguna página de `pages/`.

## 3. Flujo arquitectónico

```
PDF / Text Source
      |
      v
MIR Document Skill          (artefactos, Markdown canonico, page map, validacion documental)
      |
      v
Canonical Markdown          (auditable, con marcas de incertidumbre)
      |   adaptador markdownSource (NO reimplementa validacion)
      v
Extraction Service (Fase 5.5, sin cambios)
      |
      v
ExtractedQuestion
      |
      v
Knowledge Core
```

## 4. Contratos

```ts
DocumentArtifact {
  artifactId, sourceDocumentId, documentVersionId, artifactType,
  version, sha256, contentSha256, createdAt, generator,
  generatorVersion, parentArtifactId, metadata, contentRef
}

MarkdownBlock {
  blockId, kind, text, sourceText, level, page, uncertain, reason
}

DocumentPageMap {
  markdownBlockId, sourceDocumentId, documentVersionId,
  sourcePageStart, sourcePageEnd,
  sourceOffsetStart, sourceOffsetEnd, confidence
}

CanonicalDocument {
  documentId, versionId, markdownArtifactId, generator,
  generatorVersion, normalizerVersion, markdown, blocks,
  pageMap, sha256, createdAt
}
```

## 5. Artefactos

Tipos mínimos: `pdf`, `markdown`, `json`, `extraction-result`, `snapshot`.

- El contenido vive fuera del contrato (`contentRef` + `contentSha256`).
- Un Markdown derivado de un PDF conserva `sourceDocumentId`, `documentVersionId`, `parentArtifactId`, `sha256`, `generator` y `generatorVersion`.
- El hash **no incluye fechas**: mismo origen, mismo generador y misma configuración producen el mismo sha256 (probado).

## 6. Markdown canónico

Preserva, cuando la fuente lo permite: título, encabezados, numeración, párrafos, listas, opciones, tablas, figuras, saltos de página, referencias a página original y **bloques que no pudieron interpretarse**.

```
# Titulo                     titulo
## Seccion                   encabezado
1. Enunciado numerado        parrafo (numeracion preservada)
A) Opcion                    opcion (A-E preservadas tal cual)
| a | b |                    fila de tabla, sin destruir
[figura] ...                 figura, con marca de dependencia de imagen
<!-- page 2 -->              salto de pagina explicito
```uninterpreted            bloque no interpretado, conservado entero
   texto original
```
<!-- uncertain -->            marca de incertidumbre estructural antes del bloque
```

**No se inventa contenido ausente.** Cuando hay incertidumbre estructural, el contenido se conserva y se marca (`uncertain` + `reason`).

## 7. Page mapping y provenance

Cada bloque tiene entrada en el page map. Los offsets solo se rellenan si la fuente los conoce: en esta fase **siempre son `null`**, porque la extracción por capa de texto no aporta offsets. No se inventan.

Cadena reconstruible:

```
PDF -> bloque Markdown -> contenido extraido -> entidad del Knowledge Core
```

`buildTraceabilityChain` devuelve `complete: false` y la lista `missing` cuando falta cualquier eslabón. `findLostSourceText` es la guarda anti-pérdida: devuelve toda línea de la fuente que no aparezca en el documento (probado en los 12 fixtures, siempre lista vacía).

## 8. Versionado

```
version del documento fuente   documentVersionId
version del generador          markdownGeneratorVersion
version del artefacto          artifact.version
version del normalizador       markdownNormalizerVersion
version de extraccion          la de la Fase 5.5
```

- Un cambio del extractor **no** altera retroactivamente un Markdown ya generado.
- Un cambio del normalizador produce una **versión nueva** (diferente `generatorVersion`/`normalizerVersion` ⇒ distinto `sha256`).

## 9. Validación documental

Nueve validadores, **separados** de la validación clínica de la Fase 5.5:

```
empty-document              error    documento sin contenido util
missing-page-map            error    bloque sin entrada en el page map
duplicated-block            warning  bloque repetido en la misma pagina
broken-heading              warning  encabezado sin texto o salto de nivel
broken-option-sequence      warning  secuencia de opciones rota
suspicious-table            warning  filas con distinto numero de columnas
orphan-text                 warning  texto suelto antes del primer encabezado
image-dependent-content     warning  contenido que depende de una imagen
suspicious-page-transition  warning  salto de pagina anomalo
```

Una anomalía documental **nunca** se convierte en una afirmación clínica. La duda clínica se valida en `extraction/validators.ts`.

## 10. Relación con Knowledge Core

El Knowledge Core **consume** artefactos y resultados de extracción. El Skill no escribe en su esquema ni en sus tablas: entrega datos y el Core decide.

## 11. Relación con Predict

Predict consume el Knowledge Core, nunca artefactos crudos sin validar. El Skill no genera predicciones, no decide probabilidades y no produce ningún índice.

## 12. Relación con Study Platform

Independencia total: el Skill no modifica SRS, ni progreso, ni StudyState, ni escribe sobre entidades de Study. `assertSkillResponsibility` bloquea las siete acciones prohibidas.

## 13. Qué NO hace el Skill

- No lee PDF binario ni hace OCR (pendiente de fase posterior autorizada).
- No interpreta ni mejora contenido clínico: el normalizador solo toca formato.
- No llama APIs externas.
- No publica, no autentica, no cobra.
- No escribe en Study/N/SRS.

## 14. Reglas de arquitectura

```
MIR Document Skill PUEDE:   leer documentos, producir artefactos y Markdown,
                            preservar provenance, validar estructura,
                            producir extraction results

MIR Document Skill NO PUEDE: modificar SRS, progreso o StudyState,
                            generar predicciones, decidir probabilidades,
                            escribir entidades de Study,
                            llamar APIs externas sin fase autorizada
```

## 15. Almacén de artefactos

`DocumentArtifactStore` define `put`, `get`, `exists`, `getMetadata` y `list`. Solo existe la implementación local en memoria para pruebas y uso en el dispositivo. `cloudArtifactStore` existe como **contrato**: cualquier método lanza «no implementado». No hay Firebase, S3 ni nube.

## 16. Fixtures

Doce fixtures sintéticos: documento normal, múltiples páginas, pregunta partida, opciones A–E, tabla, imagen, texto huérfano, encabezado roto, columnas, caracteres anómalos, página vacía y contenido no interpretable. Todos verifican que **el sistema nunca elimina silenciosamente un fragmento que no pudo interpretar**.

## 17. Futuras extensiones

1. Adaptador real de PDF que aporte geometría, columnas, imágenes y offsets (entonces `sourceOffset*` dejará de ser `null`).
2. Almacén de artefactos persistente en disco (misma interfaz).
3. Sincronización opcional del Markdown con el Knowledge Core, con autorización explícita.
4. Índice de búsqueda sobre bloques canónicos, reutilizando el contrato de bloques.
5. Conversión Markdown → documento estructurado para el pipeline de importación ya existente.
