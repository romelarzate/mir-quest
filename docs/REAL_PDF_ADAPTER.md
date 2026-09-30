# Adaptador real de PDF

Fase 5.7 implementa el primer adaptador **real** de PDF para el MIR Document Skill. El objetivo **no** es extraer preguntas MIR, sino transformar un PDF binario local en una representación de páginas lo bastante rica para alimentar el Skill.

```
PDF binario local
      |
      v
RealPdfAdapter  (pdfjs-dist, Node)
      |
      v
RichPdfDocument / RichPdfPage
      |  bridge: toPdfPage / createRealPdfTextSource
      v
MIR Document Skill
      |
      v
Canonical Markdown
      |
      v
Extraction Service (Fase 5.5, intacto)
```

## 1. Alternativas consideradas

| Librería | Licencia | Node 26 | TypeScript | Texto | Coordenadas | Páginas | Imágenes | Tablas/columnas | Mantenimiento | Limitaciones clave |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **pdfjs-dist** (elegida) | Apache-2.0 | Sí, build legacy | Sí | Sí | Sí (matriz por ítem) | Sí | Sí (lista de operadores) | No detecta estructura; hay que inferirla | Excelente (Mozilla) | Orden de lectura = flujo de contenido; sin OCR; pesada |
| unpdf | MIT | Sí | Sí | Sí | Solo a través de pdfjs | Sí | Limitada | No | Activa | Capa fina sobre pdfjs: no evita pdfjs para geometría |
| pdf-parse | MIT | Parcial | Tipos pobres | Sí | No | Sí | No | No | Baja/media | Insuficiente para provenance y geometría |
| pdf-lib | MIT | Sí | Sí | No (no extrae) | No | Sí | No | No | Buena | Sirve para escribir/editar, no para leer |
| mupdf (npm) | AGPL-3.0 o comercial | Sí | Parcial | Sí | Sí | Sí | Sí | Limitada | Buena | **AGPL**: incompatible con uso propietario sin licencia comercial |
| node-poppler / poppler CLI | GPL | Requiere binario del sistema | No | Sí | Sí | Sí | Sí | Limitada | Media | Dependencia de sistema + GPL |
| @hyzyla/pdfium | MIT | Sí (WASM) | Sí | Sí | Sí | Sí | Parcial | No | Nueva, menos probada | Menos rodaje; API en evolución |
| tesseract.js / OCR cloud | Apache-2.0 / comercial | Sí | Sí | OCR | No | Sí | Parcial | No | Buena | **OCR prohibido en esta fase**; introduce error de reconocimiento |

**Decisión: `pdfjs-dist`.** No por popularidad, sino porque es la única opción que combina (a) licencia Apache-2.0 sin obligaciones copyleft, (b) extracción de texto **con matrices de transformación**, (c) dimensiones de página, (d) detección de imágenes por lista de operadores, (e) mantenimiento de primer nivel y (f) cero dependencias nativas. `unpdf` es una capa sobre pdfjs: elegirla habría añadido una librería intermedia sin eliminar pdfjs para geometría.

## 2. Dependencia añadida

```
nombre           pdfjs-dist
version exacta   6.3.289 (instalada y fijada en package-lock.json)
licencia         Apache-2.0
motivo           texto con coordenadas, dimensiones, imágenes y mantenimiento sólido, sin copyleft
punto de entrada pdfjs-dist/legacy/build/pdf.mjs  (build de Node, sin canvas)
limitaciones     sin OCR; sin deteccion de tablas o columnas; orden de lectura = flujo de contenido;
                 paquete grande (irrelevante: solo corre en Node, nunca en el bundle de la PWA)
```

Es la **única** dependencia añadida. No se añade OCR. La PWA no la incluye: el build sigue con el mismo precache (791,33 KiB).

## 3. Contrato del adaptador

```ts
type RealPdfAdapter = {
  id: string
  label: string
  status: "ready" | "not-implemented"
  library: { name, version, license, entry }
  inspect: (input: { filePath: string; limits?: Partial<PdfLimits> }) => Promise<RichPdfDocument>
}

type RichPdfPage = {
  pageNumber: number
  width: number | null          // del viewport real de la libreria
  height: number | null
  text: string                  // segmentos unidos en orden de flujo
  textSegments: PdfTextSegment[]  // con x, y, width, height reales
  images: PdfImageCandidate[]   // presencia confirmada; geometria null
  tables: PdfTableCandidate[]   // solo candidatos; nunca convertidos
  columns: { detected, method, confidence: null, note }
  readingOrder: { order: "content-stream", confidence: null, note }
  sourceOffsetsAvailable: false
  hasText: boolean
}
```

Cada segmento lleva `segmentId`, `pageNumber`, `text`, `x`, `y`, `width`, `height` y `hasEol`. El puente `toPdfPage` produce el contrato `PdfPage` de la Fase 5.5 y `createRealPdfTextSource` entrega un `PdfTextSource` con `status: "real-pdf"`, de modo que el Skill y el extractor consumen el PDF real **sin cambiar su código**.

## 4. Lo que NO se inventa

```
coordenadas de imagen        null   (se confirma presencia, no geometria)
bounding boxes de tabla      null   (solo candidatos)
offsets de origen            false  (la libreria no los entrega)
confianza de columnas        null   (heuristica sin verificar)
confianza de orden de lectura null  (no se asume orden visual)
respuestas y estructura clinica      no se tocan
```

## 5. Orden de lectura

Hallazgo documentado: **pdfjs entrega el orden del flujo de contenido, no el orden visual**. En páginas a dos columnas el flujo puede alternar columnas. Por eso:

1. Se **conservan todos los segmentos** con sus coordenadas.
2. `readingOrder.confidence` es `null` y la nota lo declara explícitamente.
3. Si la heurística de coordenadas X sugiere varias columnas, `toPdfPage` declara `declaredColumns` pero deja `columnTexts: null`, de forma que el validador del Skill emite `possible-column-loss` en lugar de ocultar la duda.

## 6. Tablas e imágenes

- **Tablas**: solo candidatos. Dos reglas conservadoras: filas con separadores verticales, o varias alineaciones X repetidas. `rowCount`/`columnCount` se calculan de la estructura observada y `confidence` es `null`. El texto **nunca** se convierte ni se destruye: el fixture `table.pdf` conserva `| Valor 1 | Valor 2 |` en el texto de página.
- **Imágenes**: se confirma presencia desde la lista de operadores (`paintImageXObject`). Se registra `imageId`, `page` y una nota; `boundingBox` y `confidence` quedan en `null` porque la geometría dentro de la lista de operadores no se interpreta en esta fase. No se lee el contenido clínico de la imagen.

## 7. Seguridad y errores tipados

```
file-not-found       el archivo no existe o no es regular
not-a-pdf            el archivo no empieza por %PDF-
corrupted-pdf        InvalidPDFException o estructura ilegible
encrypted-pdf        PasswordException: no se fuerza la contrasena
unsupported-pdf      estructura no soportada
too-large            supera maxBytes (25 MB) o maxPages (2000)
empty-document       el PDF no contiene paginas
library-unavailable  no se pudo cargar pdfjs-dist
unknown              cualquier otro fallo, con detalle acotado
```

El tamaño se comprueba **antes** de leer el archivo entero, y la firma `%PDF-` antes de invocar a la librería. Son contratos de esta fase, no límites de producción.

## 8. Fixtures

Diez PDF sintéticos generados con un escritor propio **sin dependencias** (ningún PDF descargado, ningún material MIR real, ningún libro protegido):

```
one-page.pdf        1042 bytes  2e80fdf7292cb389...
multi-page.pdf      1930 bytes  0c845479678b9616...
two-columns.pdf      972 bytes  2622821eda672233...
options-a-e.pdf     1045 bytes  f1daa965a50a6cd4...
table.pdf            999 bytes  abb8ed236c1cb8ea...
image.pdf           1119 bytes  3e10c525c1e2defd...
header-footer.pdf   1530 bytes  47288839283d275e...
special-chars.pdf    903 bytes  03d2ab88118aa6ab...
split-question.pdf  1293 bytes  1735933ffe1b03c7...
empty-page.pdf      1064 bytes  d920af810c6fbeb5...
```

Los PDF se construyen con texto en posiciones absolutas, por lo que dos columnas, tabla, imagen embebida (XObject 2×2), cabecera/pie, acentos y pregunta partida son **geometría real**, no texto simulado.

## 9. Pruebas

+28 pruebas nuevas: lectura binaria, recuento de páginas, extracción de texto, preservación de segmentos, geometría real, imágenes, candidatos a tabla (por separadores y por geometría), columnas, orden de lectura, página vacía, caracteres especiales, cabecera/pie, cinco errores tipados, determinismo, puente al Skill y **la prueba clave**: `PDF → adaptador → MIR Document Skill → Markdown` con `findLostSourceText() === []` en los diez fixtures. Además, el extractor de la Fase 5.5 corre sobre el PDF real sin cambios y acepta la pregunta del fixture.

## 10. Limitaciones

1. Sin OCR: un PDF escaneado sin capa de texto produce páginas vacías declaradas como tales.
2. Sin detección real de tablas ni de columnas: solo candidatos y heurísticas con confianza `null`.
3. `boundingBox` de imágenes siempre `null`: no se interpreta la geometría de la lista de operadores.
4. Offsets de origen no disponibles: `sourceOffsetsAvailable` es siempre `false`.
5. El orden de lectura no se corrige: se conserva y se marca como no verificado.
6. Sin límite de producción, sin cuotas y sin control de usuarios.
7. Los fixtures son sintéticos: **no** demuestran precisión clínica ni exactitud del extractor; solo que el adaptador alimenta correctamente al Skill.

## 11. Siguiente fase recomendada

1. Interpretar la matriz CTM de la lista de operadores para dar `boundingBox` real a las imágenes.
2. Algoritmo de orden de lectura por columnas (usar `declaredColumns` + coordenadas) con confianza declarada.
3. Candidatos a tabla con bounding box a partir de alineaciones X/Y y reglas gráficas.
4. Detección de páginas escaneadas (sin capa de texto) para declarar `needs-ocr` **sin** activar OCR.
5. Validar con **un** PDF real autorizado antes de tocar cualquier métrica.
