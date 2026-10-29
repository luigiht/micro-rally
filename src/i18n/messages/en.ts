export const en = {
  meta: {
    title: 'Micro Rally',
    description:
      'A cozy low-poly rally game. Drive procedural stages, earn prize money, upgrade your car.',
  },
  boot: {
    tagline: 'Tabletop diorama rally',
    loading: 'Warming up the engine…',
    canvasLabel: 'Micro Rally 3D view',
  },
  hud: {
    kmh: 'km/h',
    gear: 'Gear',
    reverse: 'R',
    controlsHint: 'WASD / arrows drive · Space handbrake · R reset · ` debug',
  },
  debug: {
    title: 'Debug',
    fps: 'FPS',
    drawCalls: 'Draw calls',
    triangles: 'Triangles',
    speed: 'Speed',
    rpm: 'RPM',
    surface: 'Surface',
    airborne: 'Airborne',
    slip: 'Rear slip',
    yes: 'yes',
    no: 'no',
  },
  surfaces: {
    tarmac: 'Tarmac',
    gravel: 'Gravel',
    mud: 'Mud',
    snow: 'Snow',
    grass: 'Grass',
  },
  stage: {
    go: 'GO!',
    checkpoint: 'Checkpoint {n}/{total}',
    penalties: '+{s}s penalties',
    money: 'Money',
    resultTitle: 'Stage complete',
    time: 'Time',
    par: 'Par',
    best: 'Previous best',
    prize: 'Prize money',
    repairs: 'Repairs',
    newRecord: 'New stage record!',
    retry: 'Drive it again',
    next: 'Next stage',
    resetHint: 'Lost? Press R to return to the last checkpoint.',
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;
