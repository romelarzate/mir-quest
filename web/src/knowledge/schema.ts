/**
 * Esquema del Knowledge Data Warehouse.
 *
 * Documentos y versiones -> examenes -> preguntas -> opciones,
 * con clasificacion, procedencia, extraccion, cuarentena y datasets.
 *
 * Reglas clave:
 * - Una pregunta historica exige documento y version documental (NOT NULL).
 * - La procedencia desconocida se guarda como NULL, nunca inventada.
 * - La cuarentena queda aislada mediante vista y guardas de servicio.
 */

export const knowledgeTableNames = [
  'knowledge_migrations',
  'clinical_domain',
  'source_document',
  'document_version',
  'source_reference',
  'historical_exam',
  'historical_question',
  'question_option',
  'question_classification',
  'curriculum_mapping',
  'extraction_result',
  'quarantine_question',
  'dataset_version',
  'dataset_question',
]

export const knowledgeViewNames = ['usable_historical_question']

export const knowledgeSchemaStatements: string[] = [
  `CREATE TABLE source_document (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    edition TEXT,
    year INTEGER CHECK (year IS NULL OR (year >= 1000 AND year <= 3000)),
    publisher TEXT,
    language TEXT,
    page_count INTEGER CHECK (page_count IS NULL OR page_count > 0),
    mime_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
    source_type TEXT NOT NULL CHECK (source_type IN ('demo','manual','authorized','historical','ai')),
    notes TEXT,
    created_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 1 CHECK (is_demo IN (0,1))
  )`,
  'CREATE UNIQUE INDEX ux_source_document_sha256 ON source_document(sha256)',

  `CREATE TABLE document_version (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES source_document(id) ON DELETE RESTRICT,
    version_label TEXT NOT NULL,
    sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
    created_at TEXT NOT NULL,
    notes TEXT
  )`,
  'CREATE UNIQUE INDEX ux_document_version ON document_version(document_id, version_label)',
  'CREATE INDEX idx_document_version_document ON document_version(document_id)',

  `CREATE TABLE source_reference (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('demo','manual','authorized','historical','ai')),
    label TEXT NOT NULL,
    citation TEXT,
    url TEXT,
    year INTEGER CHECK (year IS NULL OR (year >= 1000 AND year <= 3000)),
    document_id TEXT REFERENCES source_document(id) ON DELETE RESTRICT,
    document_version_id TEXT REFERENCES document_version(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TEXT NOT NULL
  )`,
  'CREATE INDEX idx_source_reference_document ON source_reference(document_id)',

  `CREATE TABLE clinical_domain (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    order_index INTEGER NOT NULL CHECK (order_index > 0),
    taxonomy_version TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 1 CHECK (is_demo IN (0,1)),
    created_at TEXT NOT NULL
  )`,
  'CREATE UNIQUE INDEX ux_clinical_domain_order ON clinical_domain(taxonomy_version, order_index)',

  `CREATE TABLE historical_exam (
    id TEXT PRIMARY KEY,
    exam_version TEXT NOT NULL,
    exam_year INTEGER CHECK (exam_year IS NULL OR (exam_year >= 1000 AND exam_year <= 3000)),
    label TEXT NOT NULL,
    source_document_id TEXT NOT NULL REFERENCES source_document(id) ON DELETE RESTRICT,
    document_version_id TEXT NOT NULL REFERENCES document_version(id) ON DELETE RESTRICT,
    question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
    created_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 1 CHECK (is_demo IN (0,1))
  )`,
  'CREATE UNIQUE INDEX ux_historical_exam ON historical_exam(exam_version, COALESCE(exam_year, -1))',

  `CREATE TABLE historical_question (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES historical_exam(id) ON DELETE RESTRICT,
    original_question_number INTEGER NOT NULL CHECK (original_question_number > 0),
    stem TEXT NOT NULL CHECK (length(trim(stem)) > 0),
    stem_hash TEXT NOT NULL CHECK (length(stem_hash) = 64),
    normalized_text_hash TEXT NOT NULL CHECK (length(normalized_text_hash) = 64),
    subject_id TEXT,
    topic_id TEXT,
    subtopic_id TEXT,
    difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('Facil','Media','Dificil')),
    source_document_id TEXT NOT NULL REFERENCES source_document(id) ON DELETE RESTRICT,
    document_version_id TEXT NOT NULL REFERENCES document_version(id) ON DELETE RESTRICT,
    page INTEGER CHECK (page IS NULL OR page > 0),
    source_hash TEXT,
    raw_text TEXT,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('accepted','quarantined','rejected')),
    created_at TEXT NOT NULL,
    CHECK (source_hash IS NOT NULL OR raw_text IS NOT NULL OR page IS NOT NULL)
  )`,
  'CREATE UNIQUE INDEX ux_historical_question_hash ON historical_question(stem_hash)',
  'CREATE INDEX idx_historical_question_exam ON historical_question(exam_id, original_question_number)',
  'CREATE INDEX idx_historical_question_taxonomy ON historical_question(subject_id, topic_id)',
  'CREATE INDEX idx_historical_question_provenance ON historical_question(source_document_id, document_version_id)',
  'CREATE INDEX idx_historical_question_text_hash ON historical_question(normalized_text_hash)',
  'CREATE INDEX idx_historical_question_status ON historical_question(validation_status)',

  `CREATE TABLE question_option (
    question_id TEXT NOT NULL REFERENCES historical_question(id) ON DELETE CASCADE,
    option_label TEXT NOT NULL,
    text TEXT NOT NULL CHECK (length(trim(text)) > 0),
    is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0,1)),
    order_index INTEGER NOT NULL CHECK (order_index >= 0),
    PRIMARY KEY (question_id, option_label)
  )`,
  'CREATE UNIQUE INDEX ux_question_option_order ON question_option(question_id, order_index)',
  'CREATE INDEX idx_question_option_correct ON question_option(question_id, is_correct)',

  `CREATE TABLE question_classification (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES historical_question(id) ON DELETE CASCADE,
    clinical_domain_id TEXT NOT NULL REFERENCES clinical_domain(id) ON DELETE RESTRICT,
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    source TEXT NOT NULL CHECK (source IN ('demo','manual','authorized')),
    taxonomy_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  'CREATE UNIQUE INDEX ux_question_classification ON question_classification(question_id, clinical_domain_id, taxonomy_version)',
  'CREATE INDEX idx_question_classification_domain ON question_classification(clinical_domain_id)',

  `CREATE TABLE curriculum_mapping (
    id TEXT PRIMARY KEY,
    mir_subject_id TEXT NOT NULL,
    mir_topic_id TEXT,
    mir_subtopic_id TEXT,
    clinical_domain_id TEXT NOT NULL REFERENCES clinical_domain(id) ON DELETE RESTRICT,
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    source TEXT NOT NULL CHECK (source IN ('demo','manual','authorized')),
    taxonomy_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  "CREATE UNIQUE INDEX ux_curriculum_mapping ON curriculum_mapping(mir_subject_id, COALESCE(mir_topic_id, ''), COALESCE(mir_subtopic_id, ''), clinical_domain_id, taxonomy_version)",
  'CREATE INDEX idx_curriculum_mapping_domain ON curriculum_mapping(clinical_domain_id)',

  `CREATE TABLE extraction_result (
    id TEXT PRIMARY KEY,
    historical_question_id TEXT REFERENCES historical_question(id) ON DELETE SET NULL,
    source_document_id TEXT NOT NULL REFERENCES source_document(id) ON DELETE RESTRICT,
    document_version_id TEXT REFERENCES document_version(id) ON DELETE RESTRICT,
    page INTEGER CHECK (page IS NULL OR page > 0),
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    validation_status TEXT NOT NULL CHECK (validation_status IN ('accepted','quarantined','rejected')),
    validation_errors_json TEXT NOT NULL DEFAULT '[]',
    raw_text TEXT NOT NULL,
    extracted_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 1 CHECK (is_demo IN (0,1))
  )`,
  'CREATE INDEX idx_extraction_status ON extraction_result(validation_status)',
  'CREATE INDEX idx_extraction_question ON extraction_result(historical_question_id)',

  `CREATE TABLE quarantine_question (
    id TEXT PRIMARY KEY,
    extraction_result_id TEXT NOT NULL REFERENCES extraction_result(id) ON DELETE RESTRICT,
    historical_question_id TEXT REFERENCES historical_question(id) ON DELETE SET NULL,
    raw_text TEXT NOT NULL,
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    validation_errors_json TEXT NOT NULL DEFAULT '[]',
    source_document_id TEXT NOT NULL REFERENCES source_document(id) ON DELETE RESTRICT,
    page INTEGER CHECK (page IS NULL OR page > 0),
    review_status TEXT NOT NULL CHECK (review_status IN ('pending','approved','rejected')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    CHECK (review_status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
  )`,
  'CREATE INDEX idx_quarantine_status ON quarantine_question(review_status)',
  'CREATE INDEX idx_quarantine_document ON quarantine_question(source_document_id)',

  `CREATE TABLE dataset_version (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    created_at TEXT NOT NULL,
    source_hashes_json TEXT NOT NULL DEFAULT '[]',
    question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
    accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
    quarantine_count INTEGER NOT NULL DEFAULT 0 CHECK (quarantine_count >= 0),
    rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
    taxonomy_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','processing','review','accepted','published')),
    CHECK (accepted_count + quarantine_count <= question_count)
  )`,
  'CREATE UNIQUE INDEX ux_dataset_version ON dataset_version(name, version)',
  `CREATE TABLE dataset_question (
    dataset_version_id TEXT NOT NULL REFERENCES dataset_version(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES historical_question(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (dataset_version_id, question_id)
  )`,
  'CREATE UNIQUE INDEX ux_dataset_question_position ON dataset_question(dataset_version_id, position)',
  'CREATE INDEX idx_dataset_question_question ON dataset_question(question_id)',
  'CREATE INDEX idx_dataset_version_status ON dataset_version(status)',

  `CREATE VIEW usable_historical_question AS
    SELECT q.* FROM historical_question q
    WHERE q.validation_status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM quarantine_question z
        WHERE z.historical_question_id = q.id AND z.review_status <> 'approved'
      )`,
]

export const knowledgeIndexNames: string[] = [
  'ux_source_document_sha256',
  'ux_document_version',
  'idx_document_version_document',
  'idx_source_reference_document',
  'ux_clinical_domain_order',
  'ux_historical_exam',
  'ux_historical_question_hash',
  'idx_historical_question_exam',
  'idx_historical_question_taxonomy',
  'idx_historical_question_provenance',
  'idx_historical_question_text_hash',
  'idx_historical_question_status',
  'ux_question_option_order',
  'idx_question_option_correct',
  'ux_question_classification',
  'idx_question_classification_domain',
  'ux_curriculum_mapping',
  'idx_curriculum_mapping_domain',
  'idx_extraction_status',
  'idx_extraction_question',
  'idx_quarantine_status',
  'idx_quarantine_document',
  'ux_dataset_version',
  'idx_dataset_version_status',
  'ux_dataset_question_position',
  'idx_dataset_question_question',
]
