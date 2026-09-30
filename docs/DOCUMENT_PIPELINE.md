# Pipeline documental

Describe cómo entra un documento, cómo se procesa, cómo se fragmenta, cómo se recupera y cómo se construye contexto. Todo es local en esta fase.

## 1. Cómo entra un documento

Un documento entra por `DocumentSearchProvider.uploadDocument()` con nombre de archivo, tipo MIME, checksum, texto, asignatura, tipo de fuente y metadatos opcionales. La Biblioteca registra marcadores DEMO con texto sin contenido clínico. No se sube ningún archivo ni se envía nada a la red.

## 2. Cómo se procesa

1. Se comprueba el checksum contra los documentos existentes: si coincide, se devuelve `duplicate-document`.
2. Se rechaza el texto vacío con `invalid-document`.
3. Se crea el `DocumentRecord` en estado `pending` con metadatos sin inventar: autor, edición, año y editorial quedan a `null` si no se aportan.
4. `indexDocument()` aplica la transición `pending -> processing -> indexed`, cuenta fragmentos y sella `lastIndexedAt`.

Estados posibles: `pending`, `processing`, `indexed`, `failed`, `outdated`. Las transiciones están restringidas y probadas.

## 3. Cómo se fragmenta

`planChunks()` divide el texto entregado en fragmentos de longitud máxima configurable, cortando en párrafo o frase cuando es posible. Genera identificadores deterministas con el patrón `documentId:versionId:cN`, de modo que las citas siguen siendo válidas tras recargar. No genera texto: solo divide el que recibe.

## 4. Cómo se recupera

`search()` normaliza la consulta (sin acentos), la trocea en términos y puntúa cada fragmento por coincidencia léxica entre 0 y 1. Filtra por asignatura y por identificadores de documento, descarta documentos desactualizados y ordena por puntuación. Devuelve `RetrievalResult` con estado `ok`, `empty`, `not-implemented` o `error`.

## 5. Cómo se construye contexto

`buildStudyContext(provider, { query, subjectId, topicId, documentIds, maxResults })` recupera fragmentos y ensambla `StudyContext`:

- `chunks`: fragmentos recuperados con su cita.
- `sources`: documentos implicados con su tipo de fuente.
- `citations`: citas únicas.
- `text`: texto con encabezado de cita por fragmento, recortado a `maxChars`.
- `metadata`: consulta, filtros, proveedor, estado, número de fragmentos y caracteres.
- `warnings`: avisos cuando no hay fragmentos, el proveedor no está conectado o las citas carecen de localización.

## 6. Cómo se generará contenido

En una fase futura el `StudyContext` se entregará al generador, que devolverá resumen, preguntas, flashcards o respuesta de ATLAS conservando la procedencia. Hoy los generadores son mock: devuelven contenido vacío, estado `mock` y la procedencia del contexto.

## 7. Cómo se conserva la procedencia

Ver `PROVENANCE.md`. Cada resultado generado lleva `sourceIds`, `documentIds`, `chunkIds` y `citations`, y existe una comprobación que falla si una cita no corresponde a un fragmento recuperado.

## 8. Qué parte es mock

- `MockDocumentSearchProvider`: registro, fragmentación, indexación y búsqueda en memoria.
- Los cuatro generadores: contrato y procedencia sin contenido.
- Los documentos de la Biblioteca: marcadores DEMO con texto explícitamente vacío de contenido clínico.

## 9. Qué quedará conectado a Gemini

Únicamente `GeminiFileSearchProvider`, detrás de `DocumentSearchProvider`. La interfaz de usuario, el constructor de contexto y los generadores no cambian.

## 10. Qué NO se ha implementado

- Ninguna llamada de red, ningún SDK, ninguna clave.
- Subida real de documentos, OCR, extracción de texto de PDF y detección de páginas reales.
- Búsqueda semántica o embeddings.
- Generación real de contenido clínico.
- Almacenamiento de fragmentos reales y control de versiones de material subido.
