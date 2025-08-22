// js/layouts.js - Catálogo de Diseños de Escena

// El "plano" de todos nuestros layouts.
// Cada layout define las coordenadas [columna-inicio / fin, fila-inicio / fin]
// para cada participante dentro de nuestra cuadrícula de 4x4.
const SCENE_LAYOUTS = {
    'solo': {
        participantCount: 1,
        grid: [
            { column: '1 / 5', row: '1 / 5' } // Ocupa toda la grilla 4x4
        ]
    },
    'duo-horizontal': {
        participantCount: 2,
        grid: [
            { column: '1 / 3', row: '1 / 5' }, // Participante 1 ocupa la mitad izquierda
            { column: '3 / 5', row: '1 / 5' }  // Participante 2 ocupa la mitad derecha
        ]
    },
    'sidebar-derecha': {
        participantCount: 2, // Lo haremos para 2 personas para empezar
        grid: [
            { column: '1 / 4', row: '1 / 5' }, // Principal ocupa 3/4 a la izquierda
            { column: '4 / 5', row: '1 / 5' }  // Secundario en la barra lateral derecha
        ]
    },
    'feature': {
        participantCount: 3, // 1 principal (pantalla compartida) y 2 personas
        grid: [
            { column: '1 / 5', row: '1 / 5' }, // Fondo (pantalla compartida)
            { column: '1 / 2', row: '4 / 5' }, // Persona 1 abajo a la izquierda
            { column: '4 / 5', row: '4 / 5' }  // Persona 2 abajo a la derecha
        ]
    }
    // ¡Añadir un nuevo layout es tan fácil como añadir una nueva entrada aquí!
};