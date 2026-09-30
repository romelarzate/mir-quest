# Adaptador Gemini File Search

La aplicación no depende del SDK de Gemini: depende de la interfaz `DocumentSearchProvider`.

## Interfaz

```ts
type DocumentSearchProvider = {
  id: string
  label: string
  status: "mock" | "ready" | "not-implemented"
  capabilities: RetrievalCapability[]
  uploadDocument: (input: UploadDocumentInput) => Promise<UploadDocumentResult>
  indexDocument: (documentId: string) => Promise<IndexDocumentResult>
  search: (query: RetrievalQuery) => Promise<RetrievalResult>
  getDocument: (documentId: string) => Promise<DocumentRecord | null>
  deleteDocument: (documentId: string) => Promise<boolean>
}
```

## Implementaciones actuales

- `MockDocumentSearchProvider`: local, en memoria, sin red. Añade un método extra `seedDocument` para rehidratar documentos persistidos sin cambiar el contrato.
- `geminiFileSearchProvider`: marcador `not-implemented`. Todas sus operaciones devuelven error explícito con `TODO`. No importa ningún SDK.

## Cómo se conectará

1. Implementar `GeminiFileSearchProvider` en un archivo aparte, importando el SDK solo ahí.
2. Leer credenciales desde variables de entorno mediante SecretRefs, nunca desde el código.
3. Mantener `uploadDocument`, `indexDocument`, `search`, `getDocument` y `deleteDocument` con las mismas firmas.
4. Traducir la respuesta del proveedor a `RetrievalHit` conservando documento, versión, fragmento, página, sección y rango.
5. Cambiar el proveedor activo en un único punto de composición.

## Variables de entorno previstas

Nombres declarados en `.env.example`; los valores van en `.env.local`, que está ignorado por Git:

- `VITE_DOCUMENT_PROVIDER`
- `VITE_GEMINI_API_KEY`
- `VITE_GEMINI_FILE_SEARCH_STORE`
- `VITE_GENERATION_PROVIDER`
- `VITE_GENERATION_MODEL`
- `VITE_DOCUMENT_MODE` (solo `mock` en esta fase)

## Reglas de seguridad

- Nunca escribir claves en Git, código fuente, `localStorage` ni archivos públicos.
- `.env` y `.env.*` ignorados, con `!.env.example` como única excepción.
- Pruebas automáticas que fallan si aparece una clave con formato de API, si una variable de clave recibe valor en el código o si se guarda una credencial en `localStorage`.
- Sin SDK instalado y sin peticiones de red hasta la fase de conexión.

## Modos de ejecución

- `mock`: proveedor local, sin red. Es el único permitido ahora.
- `real`: reservado para la fase de conexión, con credenciales gestionadas fuera del repositorio.
