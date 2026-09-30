# Modelo de contenido de MIR Quest

Este documento describe las entidades de contenido, sus relaciones y qué partes son DEMO.

## Entidades

- `Curriculum`: raíz del temario. `id`, `label`, `examYear`, `isDemo`, `description`.
- `Subject`: asignatura. `id`, `label`, `blockId`, `order`, `contentStatus`, `isDemo`, `notes`.
- `Topic`: tema. `id`, `subjectId`, `label`, `order`, `contentStatus`, `isDemo`.
- `Subtopic`: subtema. `id`, `topicId`, `subjectId`, `label`, `order`, `contentStatus`, `isDemo`.
- `ContentBlock`: bloque de contenido. `kind` (summary, note, reference, image, algorithm, table), `title`, `body`, `sourceIds`.
- `Question`: pregunta. `id`, `subjectId`, `topicId`, `subtopicId`, `stem`, `options`, `correctOptionId`, `explanation`, `distractorExplanations`, `difficulty`, `sourceType`, `sourceIds`, `year`, `examVersionId`, `tags`, `createdAt`, `isDemo`.
- `QuestionOption`: opción. `id`, `text`.
- `QuestionExplanation`: `explanation` más `distractorExplanations` por opción incorrecta.
- `SourceReference`: procedencia. `type` (demo, manual, authorized, historical, ai), `label`, `citation`, `url`, `year`, `examVersionId`, `notes`.
- `Flashcard`: tarjeta. `origin` (question, manual, ai, error), `questionId`, `errorId`, `subjectId`, `topicId`, `subtopicId`, `sourceIds`, `tags` y los campos de SRS.
- `Exam`: examen definido. `title`, `examVersionId`, `questionIds`, `durationMinutes`.
- `ExamQuestion`: posición de una pregunta dentro de un examen. `examId`, `questionId`, `position`, `points`.
- `ExamVersion`: convocatoria. `label`, `year`, `sourceIds`, `isDemo`, `notes`.
- `Tag`: etiqueta. `label`, `kind` (subject, topic, difficulty, year, custom).

## Relaciones

```
Curriculum
  Subject (36)
    Topic
      Subtopic
      ContentBlock -> SourceReference
    Question -> Topic / Subtopic / SourceReference / Tag / ExamVersion
      Flashcard (desde error o manual)
Exam -> ExamVersion -> Question
SourceReference es transversal: da procedencia a bloques, preguntas y tarjetas.
```

- `Subject.blockId` agrupa en Medicina, Clínica, Quirúrgica, Salud pública, Básicas, Diagnóstico y Transversal.
- `createCurriculumIndex` construye mapas por id y agrupaciones por asignatura y tema.
- `buildCurriculumTree` devuelve el árbol navegable.
- `findBrokenReferences` detecta referencias inexistentes.
- `findUnsourcedProvenance` detecta contenido DEMO que declare año o versión de examen.

## Estados de contenido

- `contentStatus: demo`: estructura de prueba.
- `contentStatus: pending-import`: reservado para el temario oficial.
- `contentStatus: imported`: cargado por un importador.

## Cómo importar contenido

Ver `IMPORT_FORMAT.md`. Cada importador valida esquema, versión, campos obligatorios, identificadores duplicados y referencias inválidas.

## Cómo una pregunta genera una flashcard

1. El usuario responde en el banco de preguntas o en un simulacro.
2. `recordAttempt` compara la opción elegida con `correctOptionId`.
3. Si falla, se crea o incrementa una entrada de error y, si no existía tarjeta para esa pregunta, se crea una flashcard con `origin: question`, `errorId` de la entrada y el tema de la pregunta.
4. El anverso es el enunciado; el reverso es la opción correcta más la explicación.
5. Si acierta después, el error se marca como resuelto.

## Cómo un error alimenta el SRS

1. La flashcard nace vencida (`dueAt` igual al momento de creación) para forzar el primer repaso.
2. En el repaso se califica con Otra vez, Difícil, Bien o Fácil.
3. `scheduleReview` ajusta facilidad, intervalo, lapso y próxima fecha: fallo reprograma en diez minutos; primeras respuestas buenas usan 1, 2 o 4 días; después el intervalo se multiplica por la facilidad, acotada entre 1.3 y 2.8.
4. El algoritmo de Fase 2 se mantiene sin cambios: Fase 3 solo añadió campos de procedencia y vínculo.

## Qué es DEMO

- Las 36 asignaturas y sus identificadores son reales como taxonomía de trabajo, pero la estructura se marcó como DEMO.
- Los temas y subtemas cargados son marcadores estructurales sin contenido clínico.
- Las 12 preguntas son DEMO, sin año ni convocatoria.
- Las fuentes no tienen citas ni URLs reales.
- La versión `MIR 2027` es un marcador vacío.

## Qué no está conectado

- Gemini, Google AI Studio, Firebase, Supabase y cualquier API externa.
- Cuentas de usuario y sincronización.
- Procesamiento de PDFs y File Search.
- Motor Predict.
