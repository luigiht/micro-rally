import type { Messages } from './en';

export const it: Messages = {
  meta: {
    title: 'Micro Rally',
    description:
      'Un rally accogliente low-poly. Guida prove procedurali, vinci premi e migliora la tua auto.',
  },
  boot: {
    tagline: 'Rally da diorama da tavolo',
    loading: 'Scaldando il motore…',
    canvasLabel: 'Vista 3D di Micro Rally',
  },
  hud: {
    kmh: 'km/h',
    gear: 'Marcia',
    reverse: 'R',
    controlsHint: 'WASD / frecce guida · Spazio freno a mano · R riparti · ` debug',
  },
  debug: {
    title: 'Debug',
    fps: 'FPS',
    drawCalls: 'Draw call',
    triangles: 'Triangoli',
    speed: 'Velocità',
    rpm: 'Giri',
    surface: 'Fondo',
    airborne: 'In volo',
    slip: 'Deriva posteriore',
    yes: 'sì',
    no: 'no',
  },
  surfaces: {
    tarmac: 'Asfalto',
    gravel: 'Ghiaia',
    mud: 'Fango',
    snow: 'Neve',
    grass: 'Erba',
  },
  stage: {
    go: 'VIA!',
    checkpoint: 'Controllo {n}/{total}',
    penalties: '+{s}s di penalità',
    money: 'Soldi',
    resultTitle: 'Prova completata',
    time: 'Tempo',
    par: 'Riferimento',
    best: 'Miglior tempo precedente',
    prize: 'Premio',
    repairs: 'Riparazioni',
    newRecord: 'Nuovo record della prova!',
    retry: 'Ripeti la prova',
    next: 'Prova successiva',
    resetHint: 'Perso? Premi R per tornare all’ultimo controllo.',
  },
};
