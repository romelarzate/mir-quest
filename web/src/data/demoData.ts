import type { AtlasMessage, StatCard, SubjectProgress } from '../types'
import { subjectBlockOptions, subjectBlockLabels } from '../domain/content'

export const demoNotice =
  'DEMO: datos simulados para validar navegación, experiencia y arquitectura.'

export const nextBestAction = {
  title: 'Empezar sesión de Cardiología',
  description: 'Practicar 20 preguntas de insuficiencia cardíaca y convertir los errores en flashcards.',
  cta: 'Empezar sesión',
  target: 'questions',
}

export const netasEstimate = {
  value: '138,4',
  period: 'Estimación DEMO de las últimas 6 semanas',
  explanation: 'Calculada con precisión, volumen reciente y tendencia mock de simulacros cortos. No es una predicción real.',
}

export const dashboardStats: StatCard[] = [
  { label: 'Progreso global MIR', value: '42%', detail: '1.226 tareas completadas', tone: 'blue' },
  { label: 'Racha', value: '18 días', detail: 'Objetivo diario cubierto', tone: 'gold' },
  { label: 'XP', value: '12.840', detail: 'Nivel 17 - Residente Alfa', tone: 'violet' },
  { label: 'Netas estimadas', value: '138,4', detail: '+6,2 vs semana previa', tone: 'green' },
  { label: 'Precisión global', value: '71%', detail: '3.482 preguntas DEMO', tone: 'blue' },
  { label: 'Flashcards pendientes', value: '86', detail: '32 vencen hoy', tone: 'coral' },
]

export { subjectBlockOptions }

export const subjects: SubjectProgress[] = [
  ['cardiologia', 'Cardiología', 'medicina', 68, 420, 74, 18, 24, 'Alta'],
  ['neumologia', 'Neumología', 'medicina', 51, 330, 69, 22, 42, 'Alta'],
  ['digestivo', 'Digestivo', 'medicina', 58, 365, 72, 15, 31, 'Alta'],
  ['nefrologia', 'Nefrología', 'medicina', 39, 210, 64, 26, 61, 'Media'],
  ['endocrinologia', 'Endocrinología', 'medicina', 44, 245, 67, 20, 49, 'Media'],
  ['neurologia', 'Neurología', 'medicina', 47, 300, 66, 19, 46, 'Alta'],
  ['reumatologia', 'Reumatología', 'medicina', 36, 185, 62, 17, 53, 'Media'],
  ['hematologia', 'Hematología', 'medicina', 49, 275, 70, 14, 37, 'Alta'],
  ['oncologia', 'Oncología', 'medicina', 32, 160, 61, 21, 58, 'Media'],
  ['infecciosas', 'Enfermedades infecciosas', 'medicina', 55, 390, 73, 13, 29, 'Alta'],
  ['geriatria', 'Geriatría', 'medicina', 28, 120, 59, 12, 57, 'Baja'],
  ['pediatria', 'Pediatría', 'clinica', 46, 315, 68, 24, 47, 'Alta'],
  ['ginecologia', 'Ginecología', 'clinica', 52, 340, 71, 16, 34, 'Alta'],
  ['obstetricia', 'Obstetricia', 'clinica', 48, 290, 69, 18, 39, 'Alta'],
  ['cirugia-general', 'Cirugía general', 'quirurgica', 41, 260, 65, 19, 48, 'Media'],
  ['traumatologia', 'Traumatología', 'quirurgica', 37, 225, 63, 15, 51, 'Media'],
  ['urologia', 'Urología', 'quirurgica', 35, 170, 62, 11, 44, 'Media'],
  ['otorrino', 'Otorrinolaringología', 'quirurgica', 33, 155, 60, 10, 50, 'Baja'],
  ['oftalmologia', 'Oftalmología', 'quirurgica', 38, 190, 66, 13, 43, 'Media'],
  ['dermatologia', 'Dermatología', 'clinica', 57, 310, 75, 9, 27, 'Alta'],
  ['psiquiatria', 'Psiquiatría', 'clinica', 45, 240, 68, 17, 41, 'Media'],
  ['anestesia', 'Anestesiología', 'quirurgica', 26, 110, 57, 8, 62, 'Baja'],
  ['urgencias', 'Urgencias', 'clinica', 53, 280, 70, 14, 35, 'Alta'],
  ['medicina-preventiva', 'Medicina preventiva', 'salud-publica', 61, 360, 76, 20, 18, 'Alta'],
  ['epidemiologia', 'Epidemiología', 'salud-publica', 59, 330, 74, 18, 22, 'Alta'],
  ['bioestadistica', 'Bioestadística', 'salud-publica', 42, 260, 65, 23, 45, 'Media'],
  ['farmacologia', 'Farmacología', 'basicas', 40, 250, 64, 25, 52, 'Media'],
  ['genetica', 'Genética', 'basicas', 31, 145, 60, 12, 54, 'Baja'],
  ['inmunologia', 'Inmunología', 'basicas', 34, 165, 61, 13, 50, 'Media'],
  ['microbiologia', 'Microbiología', 'basicas', 50, 320, 70, 16, 36, 'Alta'],
  ['anatomia-patologica', 'Anatomía patológica', 'basicas', 29, 140, 58, 11, 59, 'Baja'],
  ['radiologia', 'Radiología', 'diagnostico', 43, 230, 66, 15, 40, 'Media'],
  ['medicina-nuclear', 'Medicina nuclear', 'diagnostico', 22, 90, 55, 7, 66, 'Baja'],
  ['cuidados-paliativos', 'Cuidados paliativos', 'clinica', 30, 125, 60, 10, 55, 'Baja'],
  ['etica', 'Ética médica', 'transversal', 63, 205, 78, 6, 19, 'Media'],
  ['gestion-clinica', 'Gestión clínica', 'transversal', 27, 100, 58, 9, 64, 'Baja'],
].map(([id, name, blockId, progress, questions, accuracy, dueCards, forgettingRisk, priority]) => ({
  id: String(id),
  name: String(name),
  blockId: blockId as SubjectProgress['blockId'],
  blockLabel: subjectBlockLabels[blockId as string],
  progress: Number(progress),
  questions: Number(questions),
  accuracy: Number(accuracy),
  dueCards: Number(dueCards),
  forgettingRisk: Number(forgettingRisk),
  priority: priority as SubjectProgress['priority'],
}))

export const routeMilestones = [
  { phase: 'Base clínica', status: 'En curso', progress: 68, focus: 'Cardiología, Infecciosas, Preventiva' },
  { phase: 'Consolidación', status: 'Próxima', progress: 34, focus: 'Errores frecuentes y repasos activos' },
  { phase: 'Simulacros largos', status: 'Bloqueada', progress: 12, focus: 'Activar tras 65% global sostenido' },
  { phase: 'Sprint final', status: 'Planificada', progress: 0, focus: 'Alta densidad, descanso y netas' },
]

export const weeklyChart = [
  { day: 'Lun', preguntas: 84, precisión: 68, xp: 720 },
  { day: 'Mar', preguntas: 112, precisión: 72, xp: 940 },
  { day: 'Mié', preguntas: 76, precisión: 66, xp: 610 },
  { day: 'Jue', preguntas: 128, precisión: 75, xp: 1040 },
  { day: 'Vie', preguntas: 96, precisión: 71, xp: 820 },
  { day: 'Sáb', preguntas: 142, precisión: 74, xp: 1120 },
  { day: 'Dom', preguntas: 64, precisión: 70, xp: 540 },
]

export const netasTrend = [
  { week: 'S-6', netas: 121.6 },
  { week: 'S-5', netas: 124.8 },
  { week: 'S-4', netas: 128.1 },
  { week: 'S-3', netas: 130.5 },
  { week: 'S-2', netas: 134.2 },
  { week: 'S-1', netas: 136.9 },
  { week: 'Hoy', netas: 138.4 },
]

export const riskChart = [
  { name: 'Cardio', riesgo: 24 },
  { name: 'Nefro', riesgo: 61 },
  { name: 'Neumo', riesgo: 42 },
  { name: 'Preventiva', riesgo: 18 },
  { name: 'Pediatría', riesgo: 47 },
]

export const atlasMessages: AtlasMessage[] = [
  { role: 'student', text: 'ATLAS, ¿por qué IECA mejora pronóstico en insuficiencia cardíaca?' },
  {
    role: 'atlas',
    text: 'DEMO: reduce activación neurohormonal, poscarga y remodelado ventricular. Te propondría repasar indicaciones, contraindicaciones y efectos adversos clave.',
  },
]

export const mockQuestion = {
  stem: 'DEMO MIR: Varón de 64 años con disnea progresiva, FEVI 32%, bloqueo de rama izquierda y QRS 160 ms pese a tratamiento médico óptimo. ¿Cuál es la intervención con mayor impacto pronóstico?',
  options: [
    'Añadir verapamilo',
    'Terapia de resincronización cardiaca si cumple criterios',
    'Suspender betabloqueante por disnea',
    'Control aislado con diurético de asa',
  ],
  answer: 1,
  explanation:
    'DEMO: en insuficiencia cardíaca con FEVI reducida, QRS ancho y bloqueo de rama izquierda, la resincronización puede reducir síntomas y eventos si se cumplen criterios.',
}
