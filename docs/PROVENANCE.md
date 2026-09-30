# Procedencia y trazabilidad

Regla central: ningún fragmento, cita o resultado generado puede existir sin origen verificable. Si un dato no se conoce, es `null`; nunca se rellena con una suposición.

## Cadena de procedencia

```
Document -> DocumentVersion -> DocumentChunk -> Citation -> SourceReference -> ContentBlock
```

- `Document` identifica el material y su checksum.
- `DocumentVersion` fija la versión concreta indexada.
- `DocumentChunk` es el fragmento con rango de caracteres, página y sección cuando constan.
- `Citation` es la referencia mostrable, con documento, versión, fragmento y localización.
- `SourceReference` enlaza con la fuente bibliográfica declarada.
- `ContentBlock` es el contenido de estudio que se apoya en esas fuentes.

## Estructura de una cita

```ts
type Citation = {
  documentId: string
  documentVersionId: string
  chunkId: string
  documentTitle: string
  page: number | null
  section: string | null
  range: CitationRange | null
  label: string
}
```

`buildCitation` descarta páginas no positivas, secciones vacías y rangos invertidos. La etiqueta indica "sin página" cuando no hay localización, para que la ausencia sea visible en lugar de silenciosa.

## Procedencia en la generación

```ts
type GenerationProvenance = {
  sourceIds: string[]
  documentIds: string[]
  chunkIds: string[]
  citations: Citation[]
}
```

Cada resultado de `SummaryGenerator`, `QuestionGenerator`, `FlashcardGenerator` y `AtlasGenerator` lleva su procedencia. Así una pregunta futura podrá responder: de qué documento, de qué fragmento y con qué cita se generó.

## Comprobaciones automáticas

- `provenanceIsTraceable`: falla si una cita apunta a un fragmento o documento que no está en el contexto recuperado.
- `findBrokenReferences`: detecta referencias inexistentes entre asignaturas, temas, subtemas, fuentes, etiquetas y versiones de examen.
- `findUnsourcedProvenance`: detecta contenido DEMO que declare año o versión de examen.
- `citationFromChunk`: obliga a construir la cita desde un fragmento real.
- El mock de recuperación nunca genera texto: solo indexa el texto que recibe.

## Qué queda a null y por qué

- Autor, edición, año, editorial y páginas de un marcador DEMO.
- Página y sección de un fragmento cuando no se conocen.
- Año y versión de examen de las preguntas DEMO.
- Puntuación de Predict MIR, que siempre es `null`.

## Qué no se hace

- No se inventan documentos, páginas, secciones ni citas.
- No se presenta contenido médico generado como si proviniera de una fuente.
- No se rellena una página desconocida con un valor aproximado.
