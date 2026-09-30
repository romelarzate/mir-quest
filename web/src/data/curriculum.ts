import { createCurriculumIndex } from '../domain/content'
import type { ContentBundle } from '../domain/content'
import type { Subject, SubjectBlockId } from '../domain/types'

/**
 * Estructura de temario DEMO.
 *
 * IMPORTANTE: no contiene temario médico real. Solo reproduce la jerarquía
 * asignatura -> tema -> subtema para validar la interfaz y la arquitectura.
 * Los temas listados son marcadores estructurales sin contenido clínico.
 */

const demoNote = 'Estructura DEMO pendiente de sustituir por el temario oficial autorizado.'

type SubjectSeed = [id: string, label: string, blockId: SubjectBlockId]

const subjectSeeds: SubjectSeed[] = [
  ['cardiologia', 'Cardiología', 'medicina'],
  ['neumologia', 'Neumología', 'medicina'],
  ['digestivo', 'Digestivo', 'medicina'],
  ['nefrologia', 'Nefrología', 'medicina'],
  ['endocrinologia', 'Endocrinología', 'medicina'],
  ['neurologia', 'Neurología', 'medicina'],
  ['reumatologia', 'Reumatología', 'medicina'],
  ['hematologia', 'Hematología', 'medicina'],
  ['oncologia', 'Oncología', 'medicina'],
  ['infecciosas', 'Enfermedades infecciosas', 'medicina'],
  ['geriatria', 'Geriatría', 'medicina'],
  ['pediatria', 'Pediatría', 'clinica'],
  ['ginecologia', 'Ginecología', 'clinica'],
  ['obstetricia', 'Obstetricia', 'clinica'],
  ['cirugia-general', 'Cirugía general', 'quirurgica'],
  ['traumatologia', 'Traumatología', 'quirurgica'],
  ['urologia', 'Urología', 'quirurgica'],
  ['otorrino', 'Otorrinolaringología', 'quirurgica'],
  ['oftalmologia', 'Oftalmología', 'quirurgica'],
  ['dermatologia', 'Dermatología', 'clinica'],
  ['psiquiatria', 'Psiquiatría', 'clinica'],
  ['anestesia', 'Anestesiología', 'quirurgica'],
  ['urgencias', 'Urgencias', 'clinica'],
  ['medicina-preventiva', 'Medicina preventiva', 'salud-publica'],
  ['epidemiologia', 'Epidemiología', 'salud-publica'],
  ['bioestadistica', 'Bioestadística', 'salud-publica'],
  ['farmacologia', 'Farmacología', 'basicas'],
  ['genetica', 'Genética', 'basicas'],
  ['inmunologia', 'Inmunología', 'basicas'],
  ['microbiologia', 'Microbiología', 'basicas'],
  ['anatomia-patologica', 'Anatomía patológica', 'basicas'],
  ['radiologia', 'Radiología', 'diagnostico'],
  ['medicina-nuclear', 'Medicina nuclear', 'diagnostico'],
  ['cuidados-paliativos', 'Cuidados paliativos', 'clinica'],
  ['etica', 'Ética médica', 'transversal'],
  ['gestion-clinica', 'Gestión clínica', 'transversal'],
]

export const curriculumSubjects: Subject[] = subjectSeeds.map((seed, index) => ({
  id: seed[0],
  label: seed[1],
  blockId: seed[2],
  order: index + 1,
  contentStatus: 'demo',
  isDemo: true,
  notes: demoNote,
}))

type TopicSeed = [id: string, subjectId: string, label: string]

const topicSeeds: TopicSeed[] = [
  ['topic-cardio-insuficiencia-cardiaca', 'cardiologia', 'Insuficiencia cardíaca'],
  ['topic-cardio-cardiopatia-isquemica', 'cardiologia', 'Cardiopatía isquémica'],
  ['topic-cardio-arritmias', 'cardiologia', 'Arritmias'],
  ['topic-cardio-valvulopatias', 'cardiologia', 'Valvulopatías'],
  ['topic-cardio-hipertension', 'cardiologia', 'Hipertensión arterial'],
  ['topic-neumo-epoc', 'neumologia', 'EPOC'],
  ['topic-neumo-tep', 'neumologia', 'Tromboembolismo pulmonar'],
  ['topic-digestivo-ulcera', 'digestivo', 'Úlcera péptica'],
  ['topic-digestivo-cirrosis', 'digestivo', 'Cirrosis'],
  ['topic-preventiva-cribado', 'medicina-preventiva', 'Cribado'],
  ['topic-infecciosas-meningitis', 'infecciosas', 'Meningitis'],
  ['topic-nefro-sindrome-nefrotico', 'nefrologia', 'Síndrome nefrótico'],
  ['topic-pediatria-fiebre-sin-foco', 'pediatria', 'Fiebre sin foco'],
  ['topic-farmaco-cardiovascular', 'farmacologia', 'Farmacología cardiovascular'],
]

export const curriculumTopics = topicSeeds.map((seed, index) => ({
  id: seed[0],
  subjectId: seed[1],
  label: seed[2],
  order: index + 1,
  contentStatus: 'demo' as const,
  isDemo: true,
}))

type SubtopicSeed = [id: string, topicId: string, subjectId: string, label: string]

const subtopicSeeds: SubtopicSeed[] = [
  ['subtopic-cardio-arritmias-fa', 'topic-cardio-arritmias', 'cardiologia', 'Fibrilación auricular'],
  ['subtopic-cardio-ic-fevi-reducida', 'topic-cardio-insuficiencia-cardiaca', 'cardiologia', 'Insuficiencia cardíaca con FEVI reducida'],
]

export const curriculumSubtopics = subtopicSeeds.map((seed, index) => ({
  id: seed[0],
  topicId: seed[1],
  subjectId: seed[2],
  label: seed[3],
  order: index + 1,
  contentStatus: 'demo' as const,
  isDemo: true,
}))

export const curriculumSources = [
  {
    id: 'src-demo-bank',
    type: 'demo' as const,
    label: 'Banco DEMO interno',
    citation: null,
    url: null,
    year: null,
    examVersionId: null,
    notes: 'Contenido de prueba creado para validar la interfaz. No procede de ninguna convocatoria MIR.',
  },
  {
    id: 'src-pending-program',
    type: 'manual' as const,
    label: 'Programa MIR oficial pendiente de importar',
    citation: null,
    url: null,
    year: null,
    examVersionId: null,
    notes: 'Marcador vacío. No contiene temario ni citas reales.',
  },
]

export const curriculumTags = [
  { id: 'tag-demo', label: 'DEMO', kind: 'custom' as const },
  { id: 'tag-revisar', label: 'pendiente de revisión', kind: 'custom' as const },
]

export const curriculumExamVersions = [
  {
    id: 'exam-version-mir-2027-placeholder',
    label: 'MIR 2027 (marcador DEMO)',
    year: 2027,
    isDemo: true,
    sourceIds: [],
    notes: 'Marcador de versión. No contiene preguntas históricas reales ni atribuciones de convocatoria.',
  },
]

export const curriculumContentBlocks = [
  {
    id: 'block-cardio-arritmias-fa-summary',
    subjectId: 'cardiologia',
    topicId: 'topic-cardio-arritmias',
    subtopicId: 'subtopic-cardio-arritmias-fa',
    kind: 'summary' as const,
    title: 'Resumen DEMO: fibrilación auricular',
    body: 'Bloque vacío de ejemplo. El contenido clínico real se importará desde fuentes autorizadas.',
    sourceIds: ['src-demo-bank'],
    contentStatus: 'demo' as const,
    isDemo: true,
  },
  {
    id: 'block-cardio-ic-note',
    subjectId: 'cardiologia',
    topicId: 'topic-cardio-insuficiencia-cardiaca',
    subtopicId: null,
    kind: 'note' as const,
    title: 'Nota DEMO: insuficiencia cardíaca',
    body: 'Bloque vacío de ejemplo para validar la jerarquía de contenido.',
    sourceIds: ['src-demo-bank'],
    contentStatus: 'demo' as const,
    isDemo: true,
  },
]

export const demoCurriculumBundle: ContentBundle = {
  curriculum: {
    id: 'curriculum-mir-2027',
    label: 'MIR 2027',
    examYear: 2027,
    isDemo: true,
    description: 'Jerarquía DEMO de 36 asignaturas MIR. Los temas y subtemas listados son marcadores estructurales.',
  },
  subjects: curriculumSubjects,
  topics: curriculumTopics,
  subtopics: curriculumSubtopics,
  contentBlocks: curriculumContentBlocks,
  sources: curriculumSources,
  tags: curriculumTags,
  questions: [],
  examVersions: curriculumExamVersions,
}

export const demoCurriculumIndex = createCurriculumIndex(demoCurriculumBundle)
