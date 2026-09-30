# MIR Quest 2027 - Phase 1 / 1.5 Report

## Resultado

Se creó MIR Quest v0.1 como PWA navegable, premium, mobile-first y modular dentro de `web/`. En Fase 1.5 se corrigieron UX/UI, navegación móvil, jerarquía del dashboard y estados mock de botones.

## Alcance implementado

- Proyecto Vite con React y TypeScript.
- Tailwind CSS v4 integrado con Vite.
- Lucide React para iconografía.
- Recharts para gráficas.
- vite-plugin-pwa con manifest y service worker generado en build.
- Layout principal con sidebar desktop.
- Navegación inferior móvil con barra de cinco elementos y menú Más.
- Toggle claro/oscuro local.
- Datos mock médicos claramente marcados como DEMO.
- 36 asignaturas MIR en tarjetas con progreso mock.
- Detalle de Cardiología como ejemplo principal.
- Controles mock funcionales para búsqueda, filtros y ordenación de asignaturas.
- Navegación interna responsive para Cardiología.
- CTAs con respuesta visible o navegación mock.

## Pantallas navegables

- Dashboard
- Ruta MIR
- Asignaturas
- Detalle de asignatura: Cardiología
- Biblioteca
- Preguntas
- Flashcards
- Simulacros
- Tutor ATLAS
- Estadísticas
- Ajustes

## Elementos mock

- Métricas del dashboard.
- Netas estimadas.
- Riesgo de olvido.
- Preguntas MIR.
- Explicaciones.
- Flashcards.
- Resultados de simulacros.
- Chat ATLAS.
- Subida de PDF.
- Integraciones futuras.

## Integraciones no conectadas

- Firebase.
- Gemini API.
- File Search.
- Predict 2027.
- Procesamiento real de PDFs.
- Autenticación.
- Persistencia remota.

## Build

Comando ejecutado:

```bash
npm run build
```

Resultado: correcto.

Observación: Vite avisó que el bundle principal supera 500 kB tras minificación. Es aceptable para Fase 1.5 por el uso de Recharts sin code splitting. Se recomienda dividir rutas en Fase 2.

## Validación Fase 1.5

- Build y TypeScript: correctos.
- Consola del navegador: sin errores de página; solo mensajes informativos de Vite/React DevTools en desarrollo.
- Escritorio probado a 1280 x 720.
- Móvil probado a 390 x 844.
- Modo claro y oscuro probados.
- Todas las rutas verificadas.
- Sin scroll horizontal detectado.
- Capturas generadas en `docs/screenshots/`.
- Estados mock visibles verificados en Preguntas, Flashcards y Biblioteca.

## Riesgos y bloqueos

- El prototipo no guarda estado entre sesiones.
- Las gráficas y vistas usan datos DEMO estáticos.
- La navegación usa hash local y no React Router.
- El bundle puede optimizarse con imports dinámicos en Fase 2.
- Node.js disponible es muy reciente; si alguna dependencia futura falla, conviene fijar una version LTS.

## Recomendación Fase 2

- Introducir React Router o rutas equivalentes.
- Separar paginas con lazy loading.
- Crear capa de servicios mock/futuros adaptadores.
- Definir modelo de datos para progreso, preguntas, flashcards y simulacros.
- Agregar persistencia local primero.
- Preparar contratos para Firebase/Gemini/File Search sin claves reales.
- Agregar pruebas básicas de render y build.
