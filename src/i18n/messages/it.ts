import type { Messages } from './en';

export const it: Messages = {
  meta: {
    title: 'Micro Rally',
    description:
      'Un rally accogliente low-poly per il tuo browser. Guida prove procedurali, vinci premi e migliora la tua auto. Gratis, senza pubblicità né tracciamento.',
    ogAlt:
      'Logo di Micro Rally su una prova forestale accogliente low-poly con un’auto da rally arancione',
  },
  boot: {
    loading: 'Scaldando il motore…',
    canvasLabel: 'Vista 3D di Micro Rally',
  },
  hud: {
    kmh: 'km/h',
    gear: 'Marcia',
    reverse: 'R',
  },
  splash: {
    nameLabel: 'Nome del pilota',
    namePlaceholder: 'Il tuo nome',
    idLabel: 'ID partita',
    idPlaceholder: 'Incolla un ID partita per continuare',
    idHelp: 'Informazioni sull’ID partita',
    idHint:
      'Lascialo vuoto per iniziare una nuova partita. Troverai il tuo ID nel pannello Gioco; chiunque lo abbia può giocare quella partita.',
    play: 'Guida',
    continue: 'Continua',
    checking: 'Controllo…',
    notFound:
      'Nessuna partita salvata trovata per {id}. Controllalo o svuota il campo per iniziare una nuova partita.',
  },
  footer: {
    copyright: '© {year} Micro Rally',
    privacy: 'Privacy',
    createdBy: 'Creato da',
    language: 'Lingua',
  },
  privacy: {
    title: 'Privacy',
    updated: 'Ultimo aggiornamento: 29 ottobre 2026',
    intro:
      'Micro Rally è un gioco gratuito senza account, senza pubblicità e senza tracciamento. Questa pagina spiega il poco che salva.',
    sections: [
      {
        title: 'Cosa viene salvato',
        body: 'Il tuo nome da pilota e lo stato della partita: denaro, prova attuale, record delle prove e il seme del mondo, insieme all’ID partita che li identifica. Nient’altro. Niente email, password o identificativi del dispositivo.',
      },
      {
        title: 'Dove si trova',
        body: 'Sul tuo dispositivo, nella memoria locale del browser, e sul server del gioco sotto il tuo ID partita, così puoi continuare su un altro dispositivo. Il server conserva solo il file di salvataggio; non registra chi lo ha inviato.',
      },
      {
        title: 'ID partita',
        body: 'L’ID partita è l’unica chiave di una partita. Chiunque lo abbia può caricarla, quindi condividilo solo con chi vuoi che giochi.',
      },
      {
        title: 'Cookie e analisi',
        body: 'Il gioco non imposta cookie e non usa analisi, pubblicità o script di terze parti. I font e il motore 3D sono distribuiti con il gioco.',
      },
      {
        title: 'Le tue scelte',
        body: 'Cancellare i dati di questo sito nel browser rimuove la copia locale. Non c’è ancora un pulsante di eliminazione; per rimuovere un salvataggio dal server, invia il suo ID all’autore.',
      },
    ],
    contact: 'Domande su questa informativa? Contatta l’autore su',
    back: 'Torna al gioco',
  },
  garage: {
    button: 'Officina',
    title: 'Officina',
    hint: 'Le modifiche si applicano subito, anche a metà prova.',
    tabs: { upgrades: 'Potenziamenti', dealership: 'Concessionaria' },
    buy: 'Compra',
    maxed: 'Al massimo',
    select: 'Scegli',
    inUse: 'In uso',
    owned: 'Posseduta',
    level: 'Livello {n} di {max}',
    stats: { power: 'Potenza', grip: 'Aderenza', agility: 'Agilità' },
    prev: 'Auto precedente',
    next: 'Auto successiva',
  },
  upgrades: {
    engine: {
      name: 'Messa a punto',
      desc: 'Respira meglio con una mappa più aggressiva: più coppia ovunque.',
    },
    turbo: {
      name: 'Kit turbo',
      desc: 'Tieni premuto Maiusc per una spinta extra. Si ricarica mentre guidi.',
    },
    tyres: {
      name: 'Gomme da rally',
      desc: 'Mescola più morbida e impronta più larga per aderire su ogni fondo.',
    },
    suspension: {
      name: 'Sospensioni',
      desc: 'Molle e ammortizzatori più rigidi tengono l’auto composta su dossi e solchi.',
    },
    brakes: { name: 'Freni', desc: 'Dischi più grandi frenano più forte e più tardi in curva.' },
    gearbox: {
      name: 'Cambio rapido',
      desc: 'Cambiate più veloci e meno perdite tra una marcia e l’altra.',
    },
    weight: {
      name: 'Alleggerimento',
      desc: 'Pannelli e vetri più leggeri: più rapida ovunque e più facile da girare.',
    },
  },
  cars: {
    hatchback: {
      name: 'Rally Hatch',
      blurb: 'La compatta amichevole a trazione anteriore con cui hai iniziato.',
    },
    coupe: {
      name: 'Tricolore Coupé',
      blurb: 'Un cuneo basso anni ’70: trazione posteriore, passo corto e coda vivace.',
    },
    saloon: {
      name: 'Boreal Saloon',
      blurb:
        'Una berlina turbo a trazione integrale con un grande alettone: incollata, veloce e docile.',
    },
    wrc: {
      name: 'Riviera WRC',
      blurb:
        'Una World Rally Car di fine secolo: compatta alta, livrea a strisce, turbo con flangia e una ripartizione 50/50 solidissima.',
    },
    groupb: {
      name: 'Tempesta Gruppo B',
      blurb:
        'Una macchina Gruppo B a motore centrale: alettoni enormi, potenza enorme e una coda da domare.',
    },
    s1: {
      name: 'Edelweiss S1',
      blurb:
        'Una coupé Gruppo B a passo corto con parafanghi squadrati e un alettone a mensola: la più potente del salone, e la più nervosa.',
    },
  },
  touch: {
    left: 'Sterza a sinistra',
    right: 'Sterza a destra',
    gas: 'Acceleratore',
    brake: 'Freno',
    handbrake: 'Freno a mano',
  },
  toolbar: {
    label: 'Menu di gioco',
    settings: 'Impostazioni',
    game: 'Gioco',
  },
  settings: {
    title: 'Impostazioni',
    language: 'Lingua',
    controls: 'Comandi',
    camera: 'Telecamera',
    cameraHint: 'Premi C mentre guidi per cambiare.',
    cameras: {
      chase: 'Inseguimento',
      cockpit: 'Abitacolo',
      interior: 'Interni',
      iso: 'Isometrica',
    },
    languages: { en: 'English', es: 'Español', it: 'Italiano' },
    skidMarks: 'Segni di pneumatici',
    skidMarksHint: 'Tracce di gomma e ghiaia lasciate dalle ruote in derapata.',
    close: 'Chiudi',
  },
  game: {
    title: 'Gioco',
    restartStage: 'Ricomincia la prova',
    paused: 'In pausa finché questo pannello è aperto.',
    close: 'Chiudi',
    stageSection: 'Questa prova',
    stageName: 'Prova',
    region: 'Regione',
    surface: 'Fondo',
    length: 'Lunghezza',
    km: '{km} km',
    par: 'Tempo di riferimento',
    best: 'Il tuo record',
    none: '—',
    driverSection: 'Pilota',
    driver: 'Nome',
    gameId: 'ID partita',
    copy: 'Copia',
    copied: 'Copiato!',
    syncOnline: 'Progressi salvati online.',
    syncOffline: 'Salvato solo su questo dispositivo. Riproverà online.',
    syncSaving: 'Salvataggio…',
    syncIdle: 'I progressi si salvano automaticamente.',
  },
  regions: {
    forest: 'Foresta',
    coast: 'Costa',
    desert: 'Deserto',
    alpine: 'Alpi',
    night: 'Notte',
  },
  controls: [
    { keys: 'W / S · ↑ / ↓', action: 'Acceleratore / freno, tieni premuto per la retro' },
    { keys: 'A / D · ← / →', action: 'Sterzo' },
    { keys: 'Spazio', action: 'Freno a mano' },
    { keys: 'Maiusc', action: 'Turbo (se montato)' },
    { keys: 'R', action: 'Torna all’ultimo controllo' },
    {
      keys: 'C · V',
      action: 'Cambia telecamera (inseguimento / abitacolo / interni / isometrica)',
    },
    { keys: 'Rotella del mouse', action: 'Zoom della telecamera' },
    { keys: '`', action: 'Pannello di debug' },
    { keys: 'Esc', action: 'Apri / chiudi il pannello Gioco' },
  ],
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
    progress: 'Avanzamento della prova',
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
