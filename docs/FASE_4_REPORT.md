# MIR Quest 2027 - Fase 4: pipeline documental

Fase 4 construye la arquitectura de ingestión documental y la capa de servicio que después podrá conectarse a Gemini File Search. No se ha conectado ninguna API, no se ha usado ninguna clave real y no se ha subido ningún documento.

## Hitos

1. Modelo documental: `Document`, `DocumentVersion`, `DocumentChunk`, `DocumentMetadata`, `DocumentIndex`, `RetrievalResult`, `Citation` y `CitationRange`.
2. Estados y errores: `pending`, `processing`, `indexed`, `failed`, `outdated` y códigos `unsupported-format`, `invalid-document`, `duplicate-document`, `indexing-error`, `retrieval-error`, `unknown`.
3. Trazabilidad: cada fragmento se rastrea hasta documento, versión, página, sección, fragmento y rango de caracteres. Lo que no se conoce queda a `null`.
4. Adaptador: interfaz `DocumentSearchProvider` con `uploadDocument`, `indexDocument`, `search`, `getDocument` y `deleteDocument`, más `MockDocumentSearchProvider` y `geminiFileSearchProvider` como marcador.
5. Contrato de recuperación: `RetrievalResult` con consulta, resultados, puntuación, cita y metadatos, y capacidades declaradas para búsqueda semántica, tema, pregunta, ATLAS, resumen y flashcards.
6. Context builder: `buildStudyContext` devuelve `StudyContext` con fragmentos, fuentes, citas, texto y metadatos.
7. Generación: interfaces `SummaryGenerator`, `QuestionGenerator`, `FlashcardGenerator` y `AtlasGenerator` con implementaciones mock que conservan `sourceIds`, `documentIds`, `chunkIds` y `citations`.
8. Biblioteca: documentos con estado, asignatura, año y edición cuando constan, número de fragmentos, última indexación y errores, con acciones de añadir, ver, buscar, reindexar, eliminar y generar.
9. Flujo de estudio: documento, contenido, contexto, resumen, preguntas, flashcards y SRS, con los pasos de IA bloqueados.
10. Seguridad: `.env.example` en raíz y en `web/`, `.gitignore` robusto y pruebas que impiden claves en el código.
11. Pruebas: 212 en verde.
12. Documentación: este informe, `DOCUMENT_PIPELINE.md`, `GEMINI_ADAPTER.md` y `PROVENANCE.md`.

## Arquitectura

```
Document -> DocumentVersion -> DocumentChunk -> Citation -> SourceReference -> ContentBlock
                                    |
                             DocumentSearchProvider
                            /                      \
      MockDocumentSearchProvider        geminiFileSearchProvider (TODO)
                                    |
                             RetrievalResult
                                    |
                             buildStudyContext -> StudyContext
                                    |
          SummaryGenerator / QuestionGenerator / FlashcardGenerator / AtlasGenerator
                            (mock: sin contenido, con procedencia)
```

La aplicación depende siempre de la interfaz, nunca de un SDK. Cambiar de proveedor no toca la interfaz de usuario.

## Archivos

Nuevos:
- `web/src/domain/documents.ts`
- `web/src/domain/citations.ts`
- `web/src/domain/retrieval.ts`
- `web/src/domain/context.ts`
- `web/src/domain/generation.ts`
- `web/src/domain/workflow.ts`
- `web/src/pages/LibraryPage.tsx` (reescrita)
- `web/.env.example` y `.env.example`
- Pruebas: `documents.test.ts`, `citations.test.ts`, `retrieval.test.ts`, `context.test.ts`, `generation.test.ts`, `workflow.test.ts`, `secrets.test.ts`

Modificados:
- `web/src/domain/types.ts`: `SCHEMA_VERSION = 3` y `StudyState.documents`.
- `web/src/domain/migrations.ts`: migración `2 -> 3`.
- `web/src/storage/localStore.ts`: valida el registro de documentos.
- `web/src/repositories/studyStore.ts`: `upsertDocument` y `removeDocument`.
- `web/tsconfig.app.json`: añade tipos de Node para las pruebas de seguridad.
- `.gitignore` y `web/.gitignore` reforzados.

## Pruebas

Antes: 15 archivos, 133 pruebas.
Después: 20 archivos, 212 pruebas, todas en verde.

Cobertura nueva: modelo documental y metadatos sin invención, estados y transiciones, fragmentación determinista, duplicados, validación, citas y rangos, trazabilidad fragmento a cita, contrato de recuperación con proveedor mock, proveedor Gemini como no implementado, constructor de contexto y avisos, procedencia de la generación, flujo de estudio y seguridad de credenciales.

## Build

`npm run build` correcto. Aviso conocido de bundle mayor de 500 kB por Recharts sin división de rutas.

## Riesgos

- El proveedor es mock: la recuperación funciona sobre texto marcador, no sobre material real.
- El índice vive en memoria y se rehidrata desde el registro persistido con el texto marcador; no hay almacenamiento de texto real.
- La segmentación es por longitud con corte en párrafo o frase, no semántica.
- La puntuación de recuperación es coincidencia léxica, no similitud semántica.
- Los generadores devuelven contenido vacío: cualquier texto clínico queda pendiente del proveedor real.
- Con material real hará falta almacenamiento de fragmentos, control de versiones y límites de tamaño.

## Siguiente paso recomendado

1. Implementar `GeminiFileSearchProvider` detrás de la misma interfaz usando SecretRefs y variables de entorno.
2. Añadir almacenamiento de fragmentos reales con verificación de checksum y versiones.
3. Definir el contrato de subida (límites, tipos permitidos, tamaño máximo) antes de aceptar documentos.
4. Conectar un generador real y exigir que toda salida conserve documento, fragmento y cita.
5. Dividir rutas con carga diferida antes de cargar material extenso.
