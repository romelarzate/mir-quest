# Esquema del Knowledge Warehouse

Trece tablas, una vista y veintiséis índices. Todas las claves foráneas se aplican con `PRAGMA foreign_keys = ON`.

## Relaciones

```
source_document 1──N document_version
source_document 1──N historical_exam
source_document 1──N historical_question   (procedencia obligatoria)
document_version 1──N historical_question  (procedencia obligatoria)
historical_exam 1──N historical_question
historical_question 1──N question_option
historical_question 1──N question_classification N──1 clinical_domain
clinical_domain 1──N curriculum_mapping
historical_question 1──N extraction_result
extraction_result 1──N quarantine_question
dataset_version 1──N dataset_question N──1 historical_question
```

## Tablas

### source_document
`id`, `title`, `author`, `edition`, `year`, `publisher`, `language`, `page_count`, `mime_type`, `file_name`, `sha256`, `source_type`, `notes`, `created_at`, `is_demo`.

### document_version
`id`, `document_id` (FK), `version_label`, `sha256`, `created_at`, `notes`.

### source_reference
`id`, `type`, `label`, `citation`, `url`, `year`, `document_id` (FK), `document_version_id` (FK), `notes`, `created_at`.

### clinical_domain
`id`, `label`, `order_index`, `taxonomy_version`, `is_demo`, `created_at`. Los nombres reales llegan desde fuera: la taxonomía clínica no se inventa.

### historical_exam
`id`, `exam_version`, `exam_year`, `label`, `source_document_id` (FK), `document_version_id` (FK), `question_count`, `created_at`, `is_demo`.

### historical_question
`id` (identidad interna estable), `exam_id` (FK), `original_question_number`, `stem`, `stem_hash`, `normalized_text_hash`, `subject_id`, `topic_id`, `subtopic_id`, `difficulty`, `source_document_id` (FK), `document_version_id` (FK), `page`, `source_hash`, `raw_text`, `validation_status`, `created_at`.

### question_option
`question_id` (FK), `option_label`, `text`, `is_correct`, `order_index`. Clave primaria compuesta.

### question_classification
`id`, `question_id` (FK), `clinical_domain_id` (FK), `confidence`, `source`, `taxonomy_version`, `created_at`.

### curriculum_mapping
`id`, `mir_subject_id`, `mir_topic_id`, `mir_subtopic_id`, `clinical_domain_id` (FK), `confidence`, `source`, `taxonomy_version`, `created_at`.

### extraction_result
`id`, `historical_question_id` (FK), `source_document_id` (FK), `document_version_id` (FK), `page`, `confidence`, `validation_status`, `validation_errors_json`, `raw_text`, `extracted_at`, `is_demo`.

### quarantine_question
`id`, `extraction_result_id` (FK), `historical_question_id` (FK), `raw_text`, `confidence`, `validation_errors_json`, `source_document_id` (FK), `page`, `review_status`, `reviewed_by`, `reviewed_at`, `created_at`.

### dataset_version
`id`, `name`, `version`, `created_at`, `source_hashes_json`, `question_count`, `accepted_count`, `quarantine_count`, `rejected_count`, `taxonomy_version`, `status`.

### dataset_question
`dataset_version_id` (FK), `question_id` (FK), `position`. Clave primaria compuesta.

### knowledge_migrations
`version`, `description`, `applied_at`. Control de migraciones exclusivo de este dominio.

## Vista de aislamiento

```sql
usable_historical_question = historical_question
  WHERE validation_status = "accepted"
    AND NOT EXISTS (cuarentena con review_status distinto de "approved")
```

Estadísticas, features, Predict y simulacros deben leer siempre esta vista, nunca la tabla base.

## Índices

```
ux_source_document_sha256          documento único por hash
ux_document_version               versión única por documento y etiqueta
idx_document_version_document     versiones por documento
idx_source_reference_document     referencias por documento
ux_clinical_domain_order          orden único por versión de taxonomía
ux_historical_exam                examen único por versión y año
ux_historical_question_hash       pregunta única por hash de enunciado
idx_historical_question_exam      preguntas por examen y número
idx_historical_question_taxonomy  preguntas por asignatura y tema
idx_historical_question_provenance procedencia por documento y versión
idx_historical_question_text_hash texto normalizado
idx_historical_question_status    estado de validación
ux_question_option_order          orden único de opción por pregunta
idx_question_option_correct       respuesta correcta por pregunta
ux_question_classification        clasificación única por pregunta, dominio y taxonomía
idx_question_classification_domain clasificación por dominio
ux_curriculum_mapping             mapping único por asignatura, tema, subtema y dominio
idx_curriculum_mapping_domain     mapping por dominio
idx_extraction_status             extracción por estado
idx_extraction_question           extracción por pregunta
idx_quarantine_status             cuarentena por estado de revisión
idx_quarantine_document           cuarentena por documento
ux_dataset_version                dataset único por nombre y versión
idx_dataset_version_status        dataset por estado
ux_dataset_question_position      posición única dentro del dataset
idx_dataset_question_question     datasets que contienen una pregunta
```

## Constraints

```
CHECK  sha256 con longitud 64 en documento y versión
CHECK  year y page_count en rango razonable
CHECK  source_type en demo | manual | authorized | historical | ai
CHECK  validation_status en accepted | quarantined | rejected
CHECK  review_status en pending | approved | rejected
CHECK  status de dataset en draft | processing | review | accepted | published
CHECK  confidence entre 0 y 1
CHECK  is_correct e is_demo en 0 | 1
CHECK  enunciado no vacío y número de pregunta positivo
CHECK  procedencia: source_hash, raw_text o page presentes
CHECK  cuarentena revisada exige reviewed_by y reviewed_at
CHECK  accepted_count + quarantine_count <= question_count
FK     toda pregunta exige documento y versión documental válidos
FK     toda versión exige documento padre
FK     clasificación y mapping exigen dominio clínico existente
UNIQUE pregunta única por hash de enunciado
```
