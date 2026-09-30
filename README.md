# MIR Quest 2027

PWA DEMO para estudiar el MIR de España con dashboard, ruta de estudio, asignaturas, biblioteca, preguntas, flashcards, simulacros, tutor ATLAS mock y estadísticas.

## Estado

Fase 5.7 completada: adaptador real de PDF (pdfjs-dist 6.3.289, Apache-2.0) que convierte un PDF binario local en páginas ricas (texto con coordenadas, dimensiones, imágenes y candidatos a tabla) y alimenta al MIR Document Skill sin cambiar el extractor. Sin OCR y sin corpus MIR real.

Fase 5.6: MIR Document Skill con artefactos documentales versionados, Markdown canónico auditable, page map, normalizador determinista, validación documental separada de la clínica, almacén de artefactos como contrato e integración con el extractor existente sin duplicar validación.

Fase 5.5: pipeline de extracción validado con un examen piloto sintético (servicio de extracción por capa de texto, calidad multidimensional de 6 componentes, 16 validadores, cuarentena, métricas, revisión humana y ground truth preparado). Sin PDF real, sin LLM y sin escalar al corpus.

Fase 5: Knowledge Data Warehouse en SQLite local (`node:sqlite`) con documentos, versiones, exámenes, preguntas, opciones, clasificación, procedencia, extracción, cuarentena, datasets versionados, snapshots reproducibles, pipeline de importación y migraciones propias. Sin Predict Engine, sin probabilidades, sin LLM y sin API de producción.

Todo dato médico incluido en la app está marcado o tratado como DEMO. No hay conexiones reales a Firebase, Gemini, File Search, Predict Engine ni servicios externos.

## Requisitos

- Node.js
- npm
- Git
- Python 3 reservado para fases futuras de Predict Engine

## Comandos

```bash
cd /Users/rom/Projects/mir-quest/web
npm install
npm run dev
```

Build de producción local:

```bash
cd /Users/rom/Projects/mir-quest/web
npm run build
```

Preview local:

```bash
cd /Users/rom/Projects/mir-quest/web
npm run preview
```

Pruebas automatizadas:

```bash
cd /Users/rom/Projects/mir-quest/web
npm test
```

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Lucide React
- Recharts
- vite-plugin-pwa

## Estructura principal

```text
OPENCLAW_MASTER.md
README.md
docs/
  PHASE_1_REPORT.md
  FASE_2_REPORT.md
  FASE_3_REPORT.md
  FASE_4_REPORT.md
  CONTENT_SCHEMA.md
  PREDICT_ENGINE_SPEC.md
  IMPORT_FORMAT.md
  DOCUMENT_PIPELINE.md
  GEMINI_ADAPTER.md
  PROVENANCE.md
  PREDICT_INTEGRATION_ARCHITECTURE.md
  PREDICT_DATA_CONTRACTS.md
  PREDICT_VERSIONING.md
  PREDICT_BACKTEST_SPEC.md
  KNOWLEDGE_DATABASE.md
  KNOWLEDGE_SCHEMA.md
  DATASET_VERSIONING.md
  KNOWLEDGE_IMPORT_PIPELINE.md
  PDF_EXTRACTION_ARCHITECTURE.md
  EXTRACTION_QUALITY.md
  DATASET_PILOT.md
  MIR_DOCUMENT_SKILL.md
  REAL_PDF_ADAPTER.md
  extraction-report.json
  extraction-review-queue.json
  screenshots/
web/
  src/
    components/
    data/          currículo DEMO y banco de preguntas
    domain/        tipos, contenido, SRS, selectores, búsqueda, simulacros, documentos, recuperación, contexto, generación, flujo e importadores
    knowledge/     warehouse SQLite del Knowledge Core
      extraction/  extractor por capa de texto, calidad, validadores y piloto
      documents/   MIR Document Skill: artefactos, Markdown canonico y page map
        pdf/       adaptador real de PDF con pdfjs-dist y fixtures PDF sinteticos
    predict/       contratos de integración con el motor de conocimiento
    lib/
    pages/
    repositories/  store y binding de React
    storage/       almacenamiento local y validación
```

## Dependencia de PDF

- `pdfjs-dist` 6.3.289 (Apache-2.0) es la única dependencia añadida para leer PDF.
- Solo se usa en Node, dentro de `src/knowledge/documents/pdf/`: **no entra en el bundle de la PWA**.
- No hay OCR, ni servicios cloud, ni corpus MIR real.

## Limitaciones de Fase 5

- No usa claves reales, no publica y no gasta dinero.
- No hay Predict Engine, ni probabilidades, ni backtesting real.
- No se importan documentos reales ni se extrae texto de PDFs: solo mocks DEMO.
- No hay clasificación con LLM ni APIs conectadas.
- Los 20 dominios clínicos siguen siendo marcadores pendientes del análisis aprobado del Hito 0; el warehouse los almacena tal como se los declare el importador.
- El warehouse vive en `web/.knowledge/` (ignorado por Git) y no se incluye en el bundle de la PWA.
- El warehouse no modifica StudyState ni el SRS: son dominios separados con migraciones propias.

## Capturas de validación

- `docs/screenshots/dashboard-desktop-1280x720.png`
- `docs/screenshots/dashboard-mobile-390x844.png`
- `docs/screenshots/dashboard-mobile-dark-390x844.png`
- `docs/screenshots/validation-report.json`
- `docs/screenshots/phase-2-questions-desktop-1280x720.png`
- `docs/screenshots/phase-2-flashcards-mobile-390x844.png`
- `docs/screenshots/phase-2-settings-mobile-390x844.png`
- `docs/screenshots/phase-2-dashboard-desktop-1280x720.png`
- `docs/screenshots/phase-2-dashboard-mobile-dark-390x844.png`
- `docs/screenshots/phase-2-validation-report.json`
- `docs/screenshots/phase-3-search-mobile-390x844.png`
- `docs/screenshots/phase-3-flashcard-editor-mobile-390x844.png`
- `docs/screenshots/phase-3-exam-result-mobile-390x844.png`
- `docs/screenshots/phase-3-validation-report.json`
- `docs/screenshots/phase-4-library-mobile-390x844.png`
- `docs/screenshots/phase-4-validation-report.json`
