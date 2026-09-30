# Formato de importación

Los importadores viven en `src/domain/importers.ts` y aceptan JSON, CSV y Markdown. No conectan PDFs ni servicios externos.

## Importadores

- `CurriculumImporter`: asignaturas, temas y subtemas.
- `QuestionImporter`: preguntas con opciones y explicaciones.
- `FlashcardImporter`: flashcards manuales.
- `ContentImporter`: enruta cada registro por su forma a la entidad correspondiente.

## Estructura de un resultado

`ImportResult` devuelve `ok`, `entity`, `format`, `schemaVersion`, `recordCount` e `issues`.

Cada `ImportIssue` tiene `severity` (error o warning), `code`, `message`, `entity`, `entityId` y `field`.

## Validaciones

- `invalid-json`: el texto no es JSON válido.
- `no-records`: no hay lista de registros.
- `unsupported-version`: la versión de esquema no coincide con la esperada (2).
- `invalid-record`: faltan campos obligatorios.
- `duplicate-id`: identificador repetido en el archivo o ya existente.
- `invalid-reference`: asignatura, tema, subtema, fuente, etiqueta o versión de examen inexistente.
- `invalid-correct-option`: `correctOptionId` no coincide con ninguna opción.
- `invalid-block`: bloque de asignatura desconocido.
- `bundle-references`: aviso si el contenido base tiene referencias rotas.

## JSON

```json
{
  "schemaVersion": 2,
  "entity": "questions",
  "records": [
    {
      "id": "q-ejemplo-1",
      "subjectId": "cardiologia",
      "topicId": "topic-cardio-arritmias",
      "stem": "Enunciado",
      "optionA": "Primera",
      "optionB": "Segunda",
      "correctOptionId": "a",
      "explanation": "Explicación",
      "difficulty": "Media",
      "sourceIds": "src-demo-bank",
      "tags": "tag-demo"
    }
  ]
}
```

También se acepta un array plano de registros, sin cabecera.

## CSV

```csv
id,subjectId,stem,optionA,optionB,correctOptionId,difficulty
q-csv-1,cardiologia,Enunciado,Primera,Segunda,a,Media
```

- La primera línea son cabeceras.
- Los campos entre comillas dobles admiten comas.
- Las listas usan punto y coma como separador.

## Markdown

```markdown
# mir-quest import
schemaVersion: 2
entity: questions

## q-md-1
subjectId: cardiologia
stem: Enunciado markdown
optionA: Primera
optionB: Segunda
correctOptionId: a
```

- La cabecera declara `schemaVersion` y `entity`.
- Cada bloque `## id` abre un registro.
- Las líneas `campo: valor` rellenan campos.

## Uso desde código

```ts
const result = QuestionImporter.import(text, "json", {
  bundle: { ...demoCurriculumBundle, questions: demoQuestionBank },
  expectedSchemaVersion: 2,
  existingIds: ["q-ya-existe"],
})
```

Si `result.ok` es falso, no se debe aplicar el contenido: hay que revisar `result.issues`.
