import type { Messages } from './en';

export const es: Messages = {
  meta: {
    title: 'Micro Rally',
    description:
      'Un rally acogedor de pocos polígonos para tu navegador. Conduce tramos procedurales, gana premios y mejora tu coche. Gratis, sin anuncios ni rastreo.',
    ogAlt:
      'Logo de Micro Rally sobre un tramo forestal acogedor de pocos polígonos con un coche de rally naranja',
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
  paceNotes: {
    label: 'Nota de ruta',
    left: 'Izquierda',
    right: 'Derecha',
    grades: { acute: 'aguda', hairpin: 'horquilla', square: 'escuadra' },
    long: 'larga',
    into: 'a',
    and: 'y',
    distance: '{m} m',
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
  install: {
    title: 'Instala la app',
    android:
      'Añade Micro Rally a tu pantalla de inicio y juega a pantalla completa, sin barras del navegador.',
    ios: 'Toca Compartir y luego «Añadir a pantalla de inicio» para jugar a pantalla completa, sin barras del navegador.',
    install: 'Instalar',
    dismiss: 'Ahora no',
  },
  privacy: {
    title: 'Privacidad',
    updated: 'Última actualización: 9 de noviembre de 2026',
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
      {
        title: 'Comentarios',
        body: 'Si envías comentarios, tu mensaje y el nombre y el email que decidas añadir se envían por correo al autor, a través de un servicio de envío de email, y solo se usan para leerlos y responderte.',
      },
    ],
    contact: 'Para preguntas sobre esta política, contacta con el autor en',
    back: 'Volver al juego',
  },
  feedback: {
    title: 'Comparte tu opinión',
    intro:
      '¿Has encontrado un fallo, tienes una idea o te ha gustado un tramo? Cuéntaselo al autor. El nombre y el email son opcionales; añade un email si quieres respuesta.',
    nameLabel: 'Nombre (opcional)',
    emailLabel: 'Email (opcional)',
    messageLabel: 'Mensaje',
    messagePlaceholder: '¿Qué ha pasado o qué te gustaría ver?',
    send: 'Enviar',
    sending: 'Enviando…',
    sent: '¡Gracias! Tu mensaje va de camino.',
    another: 'Enviar otro',
    tooShort: 'Escribe al menos {n} caracteres.',
    badEmail: 'Ese email no parece correcto.',
    question: '¿Qué marca de coches fabrica el Focus y el Mustang?',
    questionHint: 'Una palabra: así dejamos fuera a los robots.',
    wrongAnswer: 'No es esa. Prueba otra vez.',
    failed: 'No se ha podido enviar ahora mismo. Inténtalo de nuevo en un momento.',
    privacy: 'Cómo se tratan los comentarios: consulta la página de privacidad.',
    back: 'Volver al juego',
  },
  about: {
    title: 'Acerca de Micro Rally',
    intro:
      'Un pequeño juego de rally para navegador: encuentra tu ritmo, aprende cada carretera y haz tuyo cada coche.',
    tabs: { gameplay: 'Juego', changelog: 'Novedades', faqs: 'Preguntas', contact: 'Contacto' },
    gameplay: {
      intro:
        'Cada carrera te lleva por un mundo de rally low-poly generado con una semilla. Termina tramos, gana premios y prepara el coche para las carreteras que vienen.',
      highlights: [
        {
          title: 'Tramos y progresión',
          body: 'Las rutas de rally pasan por bosques, Alpes, costa, Ártico y desierto. Cada noveno tramo es una ciudad y cada décimo es un circuito de tres vueltas; si coinciden, primero va la ciudad y después el circuito. El ciclo de rally continúa con carreteras más largas y curvas más cerradas.',
        },
        {
          title: 'Conduce, reinicia y repite',
          body: 'Pasa los controles en orden y llega a la meta. Las superficies fuera de la carretera te frenan; los golpes fuertes añaden tiempo y reparaciones. Pulsa R para volver al último control. Puedes repetir las carreras terminadas.',
        },
        {
          title: 'Prepara tu coche',
          body: 'Gasta los premios en mejoras de motor, turbo, neumáticos, suspensión, frenos, caja de cambios y peso, o compra otro coche. Los cambios se aplican al instante, incluso durante un tramo.',
        },
        {
          title: 'Elige la cámara',
          body: 'Cambia entre las cámaras de persecución, interior, isométrica y cinematográfica con C o desde Ajustes. Usa la rueda para acercar o alejar las cámaras de persecución, isométrica y cinematográfica.',
        },
      ],
      controlsTitle: 'Controles',
      controls: [
        {
          keys: 'W / S · ↑ / ↓',
          action: 'Acelerar y frenar; mantén el freno para ir marcha atrás',
        },
        { keys: 'A / D · ← / →', action: 'Girar' },
        { keys: 'Espacio', action: 'Freno de mano' },
        { keys: 'Mayús', action: 'Turbo, si está instalado' },
        { keys: 'R', action: 'Volver al último control' },
        { keys: 'C', action: 'Cambiar cámara' },
        { keys: 'Esc', action: 'Cerrar un panel o abrir el panel Juego' },
      ],
      touch:
        'En pantallas táctiles, los controles de dirección, pedales y el menú Pausa ofrecen lo esencial.',
    },
    changelog: {
      intro: 'Todas las versiones desde la primera entrega jugable, de más reciente a más antigua.',
      entries: [
        {
          date: '10 de noviembre de 2026',
          title: 'Página Acerca de',
          body: 'La página Acerca de reúne información de juego, cambios recientes, respuestas a preguntas habituales y datos de contacto.',
        },
        {
          date: '9 de noviembre de 2026',
          title: 'Novedades de invierno y comentarios',
          body: 'Los tramos alpinos incorporaron público; los árticos, carreras al anochecer, carreteras totalmente nevadas y paneles de control sobre la nieve. Se quitaron los pueblos árticos y las notas de ruta siempre están activas. Llegó la página de comentarios, junto con arreglos en las horquillas costeras y las escapatorias de grava, y un cambio en la zaga del Focus.',
        },
        {
          date: '8 de noviembre de 2026',
          title: 'Calendario fijo de tramos',
          body: 'Ahora hay una ciudad cada nueve tramos y un circuito cada diez; si coinciden, primero va la ciudad y después el circuito. Entre ambos se repite un ciclo de rally de siete regiones, con los récords afectados borrados para las nuevas carreteras.',
        },
        {
          date: '7 de noviembre de 2026',
          title: 'Tramos árticos y mejoras invernales',
          body: 'El Ártico se incorporó al ciclo de regiones con carreteras nevadas, bancos de nieve, muros de abetos, luz del atardecer y público. Llegaron los postes de nieve y los iconos propios de cada región; se mejoraron la nieve, los árboles, las carreteras y los controles. Se corrigieron cruces y calles urbanas, los tranvías ya no chocan con conos y las ciudades cargan más rápido.',
        },
        {
          date: '6 de noviembre de 2026',
          title: 'Tranvías y una ciudad más detallada',
          body: 'Las ciudades incorporaron tranvías con horario, edificios detallados, pasos peatonales, coches aparcados, árboles, farolas y mobiliario urbano. Se remodeló el Boreal Saloon y se corrigieron cruces, aceras, rotondas, calles laterales y la posición de los coches.',
        },
        {
          date: '5 de noviembre de 2026',
          title: 'Ciudades, circuitos y una costa cambiante',
          body: 'Llegaron las etapas urbanas y los circuitos de tres vueltas, con asfalto de carreras, bordillos, escapatorias de grava y barreras. Se actualizó el ciclo de regiones y las partidas guardadas; las costas ganaron líneas de playa variadas, acantilados y terreno más rico. También se ajustó el modo de pantalla completa en móviles.',
        },
        {
          date: '4 de noviembre de 2026',
          title: 'Instalación móvil y un nuevo especial',
          body: 'El Mulsanne LM Prototype se incorporó al concesionario. Móviles y tabletas recibieron un aviso de instalación, orientación libre, pantalla completa en Android e iconos de inicio a sangre. El Albion RS Hatch se reconstruyó con la forma de su coche de calle.',
        },
        {
          date: '3 de noviembre de 2026',
          title: 'Costa, desierto y rally raid',
          body: 'Llegaron las regiones Costa y Desierto con carreteras y terrenos propios, junto al Toro Dakar Buggy y los colores otoñales en los tramos de barro del bosque. Mejoraron la conducción de la pantalla inicial y las repeticiones; el desierto no tiene pueblos, la costa tiene su propio icono y se ajustó la rotación de regiones.',
        },
        {
          date: '2 de noviembre de 2026',
          title: 'Cámara cinematográfica, repeticiones y opciones del HUD',
          body: 'Se añadieron la cámara cinematográfica y las repeticiones al terminar, además de la opción de ocultar el HUD. Se mejoraron pueblos, cruces y premios; las marcas de neumáticos ahora siguen la repetición y se incorporaron documentos de juego, contenido, pruebas y novedades.',
        },
        {
          date: '1 de noviembre de 2026',
          title: 'Pueblos, interiores e historial de tramos',
          body: 'Llegaron los pueblos, los interiores propios de cada coche, el historial de tramos y un menú de pausa táctil, junto al Sochaux T16 y nuevos modelos. Se ajustaron las cámaras, el freno de mano y las calles de los pueblos; también se mejoraron las pruebas del techo y del concesionario.',
        },
        {
          date: '31 de octubre de 2026',
          title: 'Región alpina y más coches',
          body: 'Llegaron la región alpina, las casas nevadas, los paneles de control y el historial de tramos. El Boreal Saloon, el Sirocco Dakar Truck, el Albion RS Hatch y el Edelweiss S1 se incorporaron o se renovaron. Se mejoraron las cámaras, las revoluciones de salida, el terreno bajo la carretera, las tarjetas del concesionario y la colocación de árboles.',
        },
        {
          date: '30 de octubre de 2026',
          title: 'Taller, conducción y marcas de neumáticos',
          body: 'Se estrenó el Taller con siete mejoras activas y un concesionario 3D, además de coches procedurales, el Riviera WRC, el Edelweiss S1 y marcas de neumáticos que se desvanecen. Los guardados en línea pasaron a Supabase; también se actualizaron la conducción, las ruedas, el diseño adaptable del taller, los metadatos y la analítica.',
        },
        {
          date: '29 de octubre de 2026',
          title: 'Primera versión jugable',
          body: 'La primera versión presentó la base del juego web, la simulación del coche a paso fijo y tramos forestales procedurales con semilla, controles, tiempos, penalizaciones y premios. También incluyó el coche de rally, el paisaje low-poly, el HUD y el panel Juego, IDs de partida con guardado en línea, cuatro cámaras, información de privacidad y la configuración de pruebas e integración continua.',
        },
      ],
    },
    faqs: [
      {
        question: '¿Cómo empiezo una partida?',
        answer:
          'Escribe el nombre del piloto y pulsa Conducir. Deja vacío el ID de partida para empezar una nueva o introduce uno existente para continuar.',
      },
      {
        question: '¿Qué es el ID de partida?',
        answer:
          'Es la llave de tu partida y aparece en su URL. Cualquiera que tenga el ID puede cargarla; compártelo solo con personas de confianza.',
      },
      {
        question: '¿Se guarda mi progreso?',
        answer:
          'El progreso se guarda primero en tu dispositivo y después en línea. Si el servidor no está disponible, se conserva la copia local y se vuelve a intentar más tarde.',
      },
      {
        question: '¿Cambian los tramos cada vez?',
        answer:
          'Cada tramo se genera a partir de las semillas de tu partida y del tramo, así que el mismo tramo de la misma partida se mantiene igual. El calendario continúa con carreteras más largas y curvas más cerradas.',
      },
      {
        question: '¿Cómo cambio la cámara?',
        answer:
          'Pulsa C mientras conduces o elige una cámara en Ajustes. Hay vistas de persecución, interior, isométrica y cinematográfica.',
      },
    ],
    contact: {
      intro: '¿Has encontrado un fallo, tienes una idea o quieres hacer una pregunta? Escríbenos.',
      emailLabel: 'Correo',
      feedbackTitle: 'Enviar un comentario',
      feedbackBody:
        'Usa el formulario para escribir. El nombre y el email son opcionales; añade un email si quieres recibir respuesta.',
      feedbackCta: 'Abrir formulario',
    },
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
    special: 'Especial',
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
    },
    coupe: {
      name: 'Tricolore Coupé',
    },
    t16: {
      name: 'Sochaux T16',
    },
    saloon: {
      name: 'Boreal Saloon',
    },
    wrc: {
      name: 'Riviera WRC',
    },
    groupb: {
      name: 'Tempesta Grupo B',
    },
    s1: {
      name: 'Edelweiss S1',
    },
    focus: {
      name: 'Albion RS Hatch',
    },
    dakar: {
      name: 'Sirocco Dakar Truck',
    },
    lemans: {
      name: 'Mulsanne LM Prototype',
    },
    buggy: {
      name: 'Toro Dakar Buggy',
    },
  },
  touch: {
    left: 'Girar a la izquierda',
    right: 'Girar a la derecha',
    gas: 'Acelerador',
    brake: 'Freno',
    handbrake: 'Freno de mano',
    turbo: 'Turbo',
  },
  toolbar: {
    label: 'Menú del juego',
    settings: 'Ajustes',
    game: 'Juego',
    pause: 'Pausa',
    pauseTitle: 'En pausa',
    resume: 'Continuar',
  },
  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    controls: 'Controles',
    camera: 'Cámara',
    cameraHint: 'Pulsa C mientras conduces para cambiar.',
    cameras: {
      chase: 'Persecución',
      interior: 'Interior',
      iso: 'Isométrica',
      cinematic: 'Cinemática',
    },
    languages: { en: 'English', es: 'Español', it: 'Italiano' },
    close: 'Cerrar',
  },
  game: {
    title: 'Juego',
    restartStage: 'Reiniciar tramo',
    close: 'Cerrar',
    stageSection: 'Este tramo',
    stageName: 'Tramo',
    stageType: 'Tipo de tramo',
    length: 'Longitud',
    km: '{km} km',
    laps: '{laps} vueltas · {km} km',
    par: 'Tiempo de referencia',
    best: 'Tu mejor tiempo',
    none: '—',
    stagesSection: 'Tramos',
    showMore: 'Mostrar {n} más',
    currentStage: 'Tramo actual',
    driverSection: 'Piloto',
    driver: 'Nombre',
    gameId: 'ID de partida',
    copy: 'Copiar',
    copied: '¡Copiado!',
    syncOnline: 'Progreso guardado en línea.',
    syncOffline: 'Guardado solo en este dispositivo. Se reintentará en línea.',
    syncSaving: 'Guardando…',
    syncIdle: 'El progreso se guarda automáticamente.',
    feedback: 'Opinión',
    about: 'Acerca de',
  },
  stageTypes: {
    arctic: 'Ártico',
    circuit: 'Circuito',
    autumnal: 'Otoñal',
    pinewood: 'Pinar',
    alpine: 'Alpino',
    forest: 'Bosque',
    urban: 'Urbano',
    coastal: 'Costero',
    desert: 'Desierto',
  },
  controls: [
    { keys: 'W / S · ↑ / ↓', action: 'Acelerar / frenar, mantén para marcha atrás' },
    { keys: 'A / D · ← / →', action: 'Girar' },
    { keys: 'Espacio', action: 'Freno de mano' },
    { keys: 'Mayús', action: 'Turbo (si está instalado)' },
    { keys: 'R', action: 'Volver al último control' },
    { keys: 'C', action: 'Cambiar de cámara (persecución / interior / isométrica / cinemática)' },
    { keys: 'H', action: 'Ocultar o mostrar la interfaz' },
    { keys: 'Rueda del ratón', action: 'Zoom de cámara' },
    { keys: '`', action: 'Panel de depuración' },
    { keys: 'Esc', action: 'Cerrar cualquier panel, o abrir el panel Juego' },
  ],
  controlsTouch: [
    { keys: '◀ ▶', action: 'Girar (abajo a la izquierda)' },
    {
      keys: '▼ ▲',
      action: 'Frenar / acelerar (abajo a la derecha), mantén el freno para marcha atrás',
    },
    { keys: 'Botón de pedal', action: 'Freno de mano' },
    { keys: 'Pausa', action: 'Menú de pausa: Juego, Garaje y Ajustes' },
    {
      keys: 'Ajustes › Cámara',
      action: 'Cambiar de cámara (persecución / interior / isométrica / cinemática)',
    },
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
    track: 'Asfalto de circuito',
    gravel: 'Grava',
    mud: 'Barro',
    snow: 'Nieve',
    grass: 'Hierba',
    sand: 'Arena',
    dune: 'Dunas',
  },
  stage: {
    go: '¡YA!',
    progress: 'Progreso del tramo',
    checkpoint: 'Control {n}/{total}',
    lap: 'Vuelta {n}/{total}',
    lapTime: 'Vuelta {n}',
    bestLap: 'Mejor vuelta',
    raceTitle: 'Carrera completada',
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
    replay: 'Ver repetición',
    replayTag: 'Repetición',
    exitReplay: 'Salir de la repetición',
    replayHint: 'Esc sale · C cambia la cámara',
    resetHint: '¿Perdido? Pulsa R para volver al último control.',
  },
};
