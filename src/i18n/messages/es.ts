import type { Messages } from './en';

export const es: Messages = {
  meta: {
    title: 'Micro Rally',
    description:
      'Un rally acogedor de pocos polígonos. Conduce tramos procedurales, gana premios y mejora tu coche.',
  },
  boot: {
    tagline: 'Rally de diorama de sobremesa',
    loading: 'Calentando el motor…',
    canvasLabel: 'Vista 3D de Micro Rally',
  },
  hud: {
    kmh: 'km/h',
    gear: 'Marcha',
    reverse: 'R',
    controlsHint: 'WASD / flechas conducir · Espacio freno de mano · R reiniciar · ` depuración',
  },
  debug: {
    title: 'Depuración',
    fps: 'FPS',
    drawCalls: 'Llamadas de dibujo',
    triangles: 'Triángulos',
    speed: 'Velocidad',
    rpm: 'RPM',
    surface: 'Superficie',
    airborne: 'En el aire',
    slip: 'Deriva trasera',
    yes: 'sí',
    no: 'no',
  },
  surfaces: {
    tarmac: 'Asfalto',
    gravel: 'Grava',
    mud: 'Barro',
    snow: 'Nieve',
    grass: 'Hierba',
  },
  stage: {
    go: '¡YA!',
    checkpoint: 'Control {n}/{total}',
    penalties: '+{s}s de penalización',
    money: 'Dinero',
    resultTitle: 'Tramo completado',
    time: 'Tiempo',
    par: 'Referencia',
    best: 'Mejor anterior',
    prize: 'Premio',
    repairs: 'Reparaciones',
    newRecord: '¡Nuevo récord del tramo!',
    retry: 'Repetir tramo',
    next: 'Siguiente tramo',
    resetHint: '¿Perdido? Pulsa R para volver al último control.',
  },
};
