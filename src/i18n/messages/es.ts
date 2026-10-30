import type { Messages } from './en';

export const es: Messages = {
  meta: {
    title: 'Micro Rally',
    description:
      'Un rally acogedor de pocos polígonos para tu navegador. Conduce tramos procedurales, gana premios y mejora tu coche. Gratis, sin anuncios ni rastreo.',
  },
  boot: {
    loading: 'Calentando el motor…',
    canvasLabel: 'Vista 3D de Micro Rally',
  },
  hud: {
    kmh: 'km/h',
    gear: 'Marcha',
    reverse: 'R',
  },
  splash: {
    nameLabel: 'Nombre del piloto',
    namePlaceholder: 'Tu nombre',
    idLabel: 'ID de partida',
    idPlaceholder: 'Pega un ID de partida para continuar',
    idHelp: 'Acerca del ID de partida',
    idHint:
      'Déjalo vacío para empezar una partida nueva. Encontrarás tu ID en el panel Juego; cualquiera que lo tenga puede jugar esa partida.',
    play: 'Conducir',
    continue: 'Continuar',
    checking: 'Comprobando…',
    notFound:
      'No se encontró ninguna partida guardada para {id}. Revísalo o vacía el campo para empezar una partida nueva.',
  },
  footer: {
    copyright: '© {year} Micro Rally',
    privacy: 'Privacidad',
    createdBy: 'Creado por',
    language: 'Idioma',
  },
  privacy: {
    title: 'Privacidad',
    updated: 'Última actualización: 29 de octubre de 2026',
    intro:
      'Micro Rally es un juego gratuito sin cuentas, sin anuncios y sin rastreo. Esta página explica lo poco que guarda.',
    sections: [
      {
        title: 'Qué se guarda',
        body: 'Tu nombre de piloto y el estado de tu partida: dinero, tramo actual, récords de tramo y la semilla del mundo, junto con el ID de partida que los identifica. Nada más. Ni correo, ni contraseña, ni identificadores del dispositivo.',
      },
      {
        title: 'Dónde se guarda',
        body: 'En tu dispositivo, en el almacenamiento local del navegador, y en el servidor del juego bajo tu ID de partida para que puedas continuar en otro dispositivo. El servidor solo conserva el archivo de guardado; no registra quién lo envió.',
      },
      {
        title: 'IDs de partida',
        body: 'El ID de partida es la única llave de una partida. Cualquiera que lo tenga puede cargarla, así que compártelo solo con quien quieras que juegue.',
      },
      {
        title: 'Cookies y analítica',
        body: 'El juego no usa cookies ni analítica, publicidad o scripts de terceros. Las fuentes y el motor 3D se sirven con el juego.',
      },
      {
        title: 'Tus opciones',
        body: 'Borrar los datos de este sitio en tu navegador elimina la copia local. Aún no hay botón de borrado; para eliminar una partida del servidor, envía su ID al autor.',
      },
    ],
    contact: 'Para preguntas sobre esta política, contacta con el autor en',
    back: 'Volver al juego',
  },
  garage: {
    button: 'Taller',
    title: 'Taller',
    hint: 'Los cambios se aplican al instante, incluso en mitad del tramo.',
    tabs: { upgrades: 'Mejoras', dealership: 'Concesionario' },
    buy: 'Comprar',
    maxed: 'Al máximo',
    select: 'Elegir',
    inUse: 'En uso',
    owned: 'En propiedad',
    level: 'Nivel {n} de {max}',
    stats: { power: 'Potencia', grip: 'Agarre', agility: 'Agilidad' },
    prev: 'Coche anterior',
    next: 'Coche siguiente',
  },
  upgrades: {
    engine: {
      name: 'Puesta a punto',
      desc: 'Respira mejor y con un mapa más afilado: más par en todo el rango.',
    },
    turbo: {
      name: 'Kit turbo',
      desc: 'Mantén Mayús para un empujón de potencia. Se recarga mientras conduces.',
    },
    tyres: {
      name: 'Neumáticos de rally',
      desc: 'Compuesto más blando y huella más ancha para agarrar en cualquier superficie.',
    },
    suspension: {
      name: 'Suspensión',
      desc: 'Muelles y amortiguadores más firmes mantienen el coche asentado en crestas y baches.',
    },
    brakes: {
      name: 'Frenos',
      desc: 'Discos más grandes frenan más fuerte y más tarde en la curva.',
    },
    gearbox: {
      name: 'Caja de cambio rápido',
      desc: 'Cambios más rápidos y menos pérdidas entre marchas.',
    },
    weight: {
      name: 'Reducción de peso',
      desc: 'Paneles y cristales más ligeros: más rápido en todo y más fácil de girar.',
    },
  },
  cars: {
    hatchback: {
      name: 'Rally Hatch',
      blurb: 'El compacto amable y de tracción delantera con el que empezaste.',
    },
    coupe: {
      name: 'Tricolore Coupé',
      blurb: 'Una cuña baja de los 70: tracción trasera, batalla corta y una zaga muy viva.',
    },
    saloon: {
      name: 'Boreal Saloon',
      blurb:
        'Una berlina turbo con tracción total y un gran alerón trasero: pegada al suelo, rápida y noble.',
    },
    wrc: {
      name: 'Riviera WRC',
      blurb:
        'Un World Rally Car de cambio de siglo: compacto alto, librea a rayas, turbo con brida y un reparto 50/50 muy estable.',
    },
    groupb: {
      name: 'Tempesta Grupo B',
      blurb:
        'Una máquina del Grupo B de motor central: alerones enormes, potencia enorme y una zaga que hay que domar.',
    },
    s1: {
      name: 'Edelweiss S1',
      blurb:
        'Un coupé del Grupo B de batalla corta con aletas cuadradas y un alerón como una balda: el más potente del concesionario, y el más nervioso.',
    },
  },
  touch: {
    left: 'Girar a la izquierda',
    right: 'Girar a la derecha',
    gas: 'Acelerador',
    brake: 'Freno',
    handbrake: 'Freno de mano',
  },
  toolbar: {
    label: 'Menú del juego',
    settings: 'Ajustes',
    game: 'Juego',
  },
  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    controls: 'Controles',
    camera: 'Cámara',
    cameraHint: 'Pulsa C mientras conduces para cambiar.',
    cameras: { chase: 'Persecución', cockpit: 'Cabina', interior: 'Interior', iso: 'Isométrica' },
    languages: { en: 'English', es: 'Español', it: 'Italiano' },
    skidMarks: 'Marcas de neumáticos',
    skidMarksHint: 'Huellas de goma y grava que dejan las ruedas al derrapar.',
    close: 'Cerrar',
  },
  game: {
    title: 'Juego',
    restartStage: 'Reiniciar tramo',
    paused: 'En pausa mientras este panel esté abierto.',
    close: 'Cerrar',
    stageSection: 'Este tramo',
    stageName: 'Tramo',
    region: 'Región',
    surface: 'Superficie',
    length: 'Longitud',
    km: '{km} km',
    par: 'Tiempo de referencia',
    best: 'Tu mejor tiempo',
    none: '—',
    driverSection: 'Piloto',
    driver: 'Nombre',
    gameId: 'ID de partida',
    copy: 'Copiar',
    copied: '¡Copiado!',
    syncOnline: 'Progreso guardado en línea.',
    syncOffline: 'Guardado solo en este dispositivo. Se reintentará en línea.',
    syncSaving: 'Guardando…',
    syncIdle: 'El progreso se guarda automáticamente.',
  },
  regions: {
    forest: 'Bosque',
    coast: 'Costa',
    desert: 'Desierto',
    alpine: 'Alpes',
    night: 'Noche',
  },
  controls: [
    { keys: 'W / S · ↑ / ↓', action: 'Acelerar / frenar, mantén para marcha atrás' },
    { keys: 'A / D · ← / →', action: 'Girar' },
    { keys: 'Espacio', action: 'Freno de mano' },
    { keys: 'Mayús', action: 'Turbo (si está instalado)' },
    { keys: 'R', action: 'Volver al último control' },
    { keys: 'C · V', action: 'Cambiar de cámara (persecución / cabina / interior / isométrica)' },
    { keys: 'Rueda del ratón', action: 'Zoom de cámara' },
    { keys: '`', action: 'Panel de depuración' },
    { keys: 'Esc', action: 'Abrir / cerrar el panel Juego' },
  ],
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
    progress: 'Progreso del tramo',
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
