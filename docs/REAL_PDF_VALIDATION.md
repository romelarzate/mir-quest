# Validación controlada con PDF real

**Estado: NO EJECUTADA. No existe ningún PDF real autorizado en el workspace.**

No se descargó nada, no se buscó material MIR en Internet, no se incorporó ningún libro protegido y **no se inventó un PDF real**. Los únicos PDF del proyecto son los diez fixtures sintéticos que yo mismo generé en la Fase 5.7, y están marcados como tales.

## 1. Identificación del documento

```
PDF real autorizado          NO PRESENTE en el workspace
búsqueda ejecutada           find . -name "*.pdf" -not -path "*/node_modules/*" -not -path "*/__fixtures__/*"
resultado                    (sin coincidencias)
únicos PDF encontrados       10 fixtures sintéticos en src/knowledge/documents/pdf/__fixtures__/
estado de web/.knowledge/    no existe (nunca se creó una base local)
```

## 2. SHA-256

`pendiente` — no hay archivo que hashear. El arnés calcula SHA-256 en el momento de la inspección, así que se rellenará automáticamente cuando se aporte el archivo.

## 3. Número de páginas

`pendiente` por el mismo motivo. `RichPdfDocument.pageCount` lo entrega la inspección real.

## 4. Pipeline ejecutado

El pipeline **sí está implementado y probado de extremo a extremo**; lo que falta es el material real:

```
PDF real -> RealPdfAdapter -> RichPdfDocument -> MIR Document Skill
         -> Canonical Markdown -> Document validation -> Extraction Service
         -> ExtractedQuestion -> ExtractionRun
```

Se ejecutó un **dry-run** del arnés completo sobre un fixture sintético (`multi-page.pdf`) para demostrar que la maquinaria funciona y para fijar la forma del informe. Está etiquetado como `sourceKind: synthetic-fixture` y el propio arnés emite el aviso «Dry-run: la fuente no es un PDF real autorizado, no constituye validacion real».

Evidencia legible por máquina: `docs/real-pdf-validation-dry-run.json`.

Etapas del dry-run: adapter (3 paginas leidas) -> skill (15 bloques) -> document-validation (0 errores y 0 avisos) -> extraction (4 preguntas detectadas).

## 5. Versiones registradas

```
pdfjs-dist                 6.3.289
MIR Document Skill          1.0.0
normalizador                normalizer-1
extractor                   text-layer-extractor-v1
hash de contenido           excluye nombre, ruta y fecha (probado)
```

## 6. Métricas descriptivas (del dry-run, no de un PDF real)

```
páginas procesadas          3
páginas vacías              0
bloques Markdown            15
caracteres fuente           305
caracteres Markdown         340
preguntas detectadas        4
preguntas aceptadas         3
preguntas en cuarentena     1
preguntas rechazadas        0
anomalías documentales      0
páginas multicolumna        0
páginas con imágenes        0
candidatos de tabla         0
```

**No hay precisión, exactitud, accuracy, recall ni F1 en ninguna parte.** Una prueba falla si aparece alguno de esos nombres entre las métricas. Estas cifras describen el procesamiento; no miden acierto.

## 7. Problemas encontrados

1. **Bloqueante de la fase:** no existe PDF real autorizado, por lo que la validación real no puede ejecutarse. Es el único problema que impide cerrar la fase.
2. El dry-run confirmó que el arnés funciona y que el pipeline completo se ejecuta sin excepciones.
3. Los fixtures sintéticos disparan avisos benignos del parser de pdfjs (`Skipping command Tm`), ya documentados en la Fase 5.7; con un PDF real el comportamiento puede diferir.
4. `web/.knowledge/` no existe: correcto, porque esta fase **no** debía escribir el dataset histórico.

## 8. Páginas ambiguas

Del dry-run (`multi-page.pdf`): 3 verificadas, 0 inciertas, 0 problemáticas.

Criterios aplicados, sin corregir nada:

```
verified     una columna, sin imagenes ni tablas, coordenadas Y monotonas
uncertain    columnas detectadas, imagenes o candidatos a tabla
problematic  las coordenadas Y retroceden: el orden del flujo no es el visual
```

## 9. Problemas de orden de lectura

Se registra el estado por página y **no se corrige automáticamente**, tal como pedía la fase. El hallazgo de la Fase 5.7 sigue vigente: pdfjs entrega el orden del flujo de contenido, no el visual, y así queda declarado con `confidence: null`.

## 10. Contenido potencialmente perdido

Guarda anti-pérdida ejecutada con estas salidas del dry-run:

```
líneas preservadas          15
líneas no localizadas       0
páginas afectadas           0
bloques afectados           0
posibles reordenamientos    0
líneas duplicadas           3
bloques no interpretados    0
bloques de figura           0
bloques de fila de tabla    0
```

**La comparación es solo por líneas y lo declaro explícitamente.** `findLostSourceText()` devolviendo lista vacía es **condición necesaria, no suficiente**: no demuestra preservación semántica, ni que el orden sea correcto, ni que la estructura original se conserve. Por eso el arnés añade duplicaciones, reordenamientos, bloques afectados y contenido estructural, y por eso **no se afirma «sin pérdida»** en ningún punto de este informe.

## 11. Cuarentena

Del dry-run se recogieron 1 registro(s) en cuarentena. Cada uno conserva texto original, página, artefacto Markdown, códigos de error, confianza y provenance (documento, versión y bloques de la página). Nada se elimina y nada se acepta por la fuerza: esa es la garantía que sí puedo afirmar, porque está implementada y probada con un caso real de texto huérfano.

## 12. Limitaciones

1. **Sin PDF real**: la validación real está pendiente y no puede sustituirse con fixtures sintéticos.
2. Sin ground truth humano, así que no hay ninguna medida de acierto y no la habrá hasta que una persona rellene los registros.
3. Sin OCR: un PDF escaneado produciría páginas vacías declaradas como tales.
4. Columnas y tablas siguen siendo heurísticas con confianza `null`; el orden de lectura no se corrige.
5. `boundingBox` de imágenes siempre `null`; offsets de origen no disponibles.
6. La guarda de pérdida es literal: no demuestra preservación semántica.
7. Umbrales sin tocar: `minChars`, `maxChars`, confianza, heurísticas de columnas y tablas y reglas de unión de páginas permanecen **exactamente** como estaban.

## 13. Observaciones para mejora

Ninguna basada en un PDF real, porque no lo hay. Del dry-run y del diseño actual sí observo:

1. El informe de orden de lectura ganaría con el algoritmo de columnas por coordenadas (fase futura), pero **no debe tocarse sin evidencia de un PDF real**.
2. Convendría exponer el snapshot y las métricas también en Markdown legible, no solo JSON.
3. La plantilla de revisión humana ya está separada del resultado automático; falta decidir el formato de intercambio con el revisor.

## 14. Decisión sobre si el adaptador está listo para otro PDF

```
adaptador y arnes          LISTOS (455 pruebas + 11 nuevas, tsc y build correctos)
validacion con PDF real    NO EJECUTADA
causa                      no existe PDF real autorizado en el workspace
dataset historico          NO creado, correcto
```

**No declaro la fase exitosa en el sentido de «validó un PDF real».** La declaro honestamente bloqueada en ese punto y lista en todo lo demás. Para cerrarla basta con depositar el archivo autorizado dentro del workspace y ejecutar la inspección del arnés.

### Cómo aportar el archivo

```
1. Copiar el PDF autorizado dentro del workspace, por ejemplo:
   ~/Projects/mir-quest/private/validacion/examen.pdf
2. Ejecutar el arnés (equivalente a la prueba de dry-run, cambiando la fuente):
   sourceKind: real-pdf
   filePath:   <ruta del PDF>
3. Rellenar HumanReviewRecord con una persona antes de hablar de ninguna tasa.
```

El directorio `private/` no existe todavía y **no debe versionarse**; el `.gitignore` ya ignora `.knowledge/` y los snapshots, y conviene añadir esa ruta cuando se cree.
