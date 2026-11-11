export const en = {
  meta: {
    title: 'Micro Rally',
    description:
      'A cozy low-poly rally game for your browser. Drive procedural stages, earn prize money and upgrade your car. Free, no ads, no tracking.',
    ogAlt: 'Micro Rally logo over a cozy low-poly forest stage with an orange rally car',
  },
  boot: {
    loading: 'Warming up the engine…',
    canvasLabel: 'Micro Rally 3D view',
  },
  hud: {
    kmh: 'km/h',
    gear: 'Gear',
    reverse: 'R',
  },
  paceNotes: {
    label: 'Pace note',
    left: 'Left',
    right: 'Right',
    grades: { acute: 'acute', hairpin: 'hairpin', square: 'square' },
    long: 'long',
    into: 'into',
    and: 'and',
    distance: '{m} m',
  },
  splash: {
    nameLabel: 'Driver name',
    namePlaceholder: 'Your name',
    idLabel: 'Game ID',
    idPlaceholder: 'Paste a Game ID to continue',
    idHelp: 'About the Game ID',
    idHint:
      'Leave it empty to start a new game. You’ll find your ID in the Game panel; anyone who has it can play that game.',
    play: 'Drive',
    continue: 'Continue',
    checking: 'Checking…',
    notFound: 'No saved game was found for {id}. Check it, or clear the field to start a new game.',
  },
  footer: {
    copyright: '© {year} Micro Rally',
    privacy: 'Privacy',
    createdBy: 'Created by',
    language: 'Language',
  },
  install: {
    title: 'Install the app',
    android: 'Add Micro Rally to your home screen and play full screen, with no browser bars.',
    ios: 'Tap Share, then “Add to Home Screen”, to play full screen with no browser bars.',
    install: 'Install',
    dismiss: 'Not now',
  },
  privacy: {
    title: 'Privacy',
    updated: 'Last updated: 9 November 2026',
    intro:
      'Micro Rally is a free game with no accounts, no ads and no tracking. This page explains the little it does store.',
    sections: [
      {
        title: 'What is stored',
        body: 'Your driver name and your game state: money, current stage, stage records and the world seed, together with the Game ID that identifies them. Nothing else. No email, no password, no device identifiers.',
      },
      {
        title: 'Where it lives',
        body: 'On your device, in the browser’s local storage, and on the game server under your Game ID so you can continue on another device. The server keeps only the save file; it does not record who sent it.',
      },
      {
        title: 'Game IDs',
        body: 'A Game ID is the only key to a game. Anyone who has it can load that game, so share it only with people you want playing it.',
      },
      {
        title: 'Cookies and analytics',
        body: 'The game sets no cookies and uses no analytics, advertising or third-party scripts. Fonts and the 3D engine ship with the game.',
      },
      {
        title: 'Your choices',
        body: 'Clearing this site’s data in your browser removes the local copy. There is no delete button yet; to have a save removed from the server, send its Game ID to the author.',
      },
      {
        title: 'Feedback',
        body: 'If you send feedback, your message and the name and email you choose to add are emailed to the author, through an email delivery service, and used only to read and answer it.',
      },
    ],
    contact: 'Questions about this policy? Reach the author at',
    back: 'Back to the game',
  },
  feedback: {
    title: 'Share your feedback',
    intro:
      'Found a bug, have an idea, or just enjoyed a stage? Tell the author. Name and email are optional; add an email if you would like a reply.',
    nameLabel: 'Name (optional)',
    emailLabel: 'Email (optional)',
    messageLabel: 'Message',
    messagePlaceholder: 'What happened, or what would you like to see?',
    send: 'Send feedback',
    sending: 'Sending…',
    sent: 'Thanks! Your feedback is on its way.',
    another: 'Send more',
    tooShort: 'Write at least {n} characters.',
    badEmail: 'That email address does not look right.',
    question: 'Which carmaker builds the Focus and the Mustang?',
    questionHint: 'One word: it keeps the robots out.',
    wrongAnswer: 'Not quite. Have another go.',
    failed: 'It could not be sent just now. Please try again in a moment.',
    privacy: 'How feedback is handled: see the privacy page.',
    back: 'Back to the game',
  },
  about: {
    title: 'About Micro Rally',
    intro:
      'A small browser rally game about finding your rhythm, learning the road and making each car your own.',
    tabs: { gameplay: 'Gameplay', changelog: 'Changelog', faqs: 'FAQs', contact: 'Contact' },
    gameplay: {
      intro:
        'Each run takes you through a seeded, low-poly rally world. Finish stages, earn prize money and tune your car for the roads ahead.',
      highlights: [
        {
          title: 'Stages and progression',
          body: 'Rally stages cycle through seven stage types, each with its own road surface: Pinewood gravel, Alpine snow, Forest and Coastal tarmac, Arctic snow, Autumnal mud and Desert sand. Every ninth stage is a city and every tenth is a three-lap circuit; when they coincide, the city comes first and the circuit follows. The rally mix then loops with longer, tighter roads.',
        },
        {
          title: 'Drive, reset and replay',
          body: 'Each stage starts and finishes under a chequered gantry, with red boards marking the start (a stopwatch) and the finish (a chequered flag). Pass the checkpoints in order and reach the finish. Off-road surfaces slow you down, while hard impacts add time and repair costs. R, or the back-to-checkpoint button next to Pause on touchscreens, returns you to the last checkpoint. Finished runs can be replayed.',
        },
        {
          title: 'Surfaces and grip',
          body: 'Tarmac grips best and gravel is the reference; snow and mud are the most slippery. Arctic cars run studded tyres, and Alpine and Autumnal cars run winter and mud tyres, so they can still climb the hills at pace.',
        },
        {
          title: 'Make the car yours',
          body: 'Spend prize money on engine, turbo, tyres, suspension, brakes, gearbox and weight upgrades, or buy another car. Changes take effect immediately, even during a stage.',
        },
        {
          title: 'Choose your view',
          body: 'Switch between chase, interior, isometric and cinematic cameras with C or in Settings. Scroll to zoom the chase, isometric and cinematic views.',
        },
      ],
      controlsTitle: 'Controls',
      controls: [
        { keys: 'W / S · ↑ / ↓', action: 'Throttle and brake; hold brake to reverse' },
        { keys: 'A / D · ← / →', action: 'Steer' },
        { keys: 'Space', action: 'Handbrake' },
        { keys: 'Shift', action: 'Turbo, when fitted' },
        { keys: 'R', action: 'Return to the last checkpoint' },
        { keys: 'C', action: 'Change camera' },
        { keys: 'Esc', action: 'Close a panel or open the Game panel' },
      ],
      touch:
        'On touchscreens, steering pads, pedals, a back-to-checkpoint button and the Pause menu provide the same essentials.',
    },
    changelog: {
      intro: 'Every release since the first playable build, newest first.',
      entries: [
        {
          date: '11 November 2026',
          title: 'Start and finish gates, touch reset and grippier climbs',
          body: 'Every start and finish now has a chequered gantry; on rally stages red boards mark the start with a stopwatch and the finish with a chequered flag. Touchscreens gained a back-to-checkpoint button next to Pause, and the touch toolbar, clock and speed readout now line up with the pedals. Alpine and Autumnal stages grip harder so cars climb faster, mud drives a little quicker, and Autumnal verges and edge tracks were refined.',
        },
        {
          date: '10 November 2026',
          title: 'Stage types, crowds and the About page',
          body: 'Stages now come in nine fixed types, each with its own road surface, and the muddy type became Autumnal, with tyre ruts and faded edge lines. Spectators stand behind small protective mounds, desert crowds gather at the start, checkpoints and finish, and circuits gained empty grandstands at tight corners. The About page brings gameplay notes, recent changes, FAQs and contact details together, and the hidden night city mode was removed.',
        },
        {
          date: '9 November 2026',
          title: 'Winter rally updates and feedback',
          body: 'Alpine stages gained spectators; Arctic stages gained dusk runs, fully snow-covered roads and checkpoint boards set into the snow. Arctic villages were removed and pace notes are always on. The Feedback page arrived, alongside fixes for Coast hairpins and circuit gravel traps and a Focus tail update.',
        },
        {
          date: '8 November 2026',
          title: 'A fixed stage calendar',
          body: 'The schedule now places a city at every ninth stage and a circuit at every tenth; when they coincide, the city comes first and the circuit follows. The stages between them cycle through seven rally regions, with affected records cleared for the new roads.',
        },
        {
          date: '7 November 2026',
          title: 'Arctic stages and winter polish',
          body: 'The Arctic joined the region rotation with snow roads, snowbanks, spruce walls, dusk lighting and roadside spectators. Snow poles and region-specific stage icons arrived; snow marks, trees, roads and checkpoint boards were refined. City junctions and side streets were cleaned up, trams clear cones, and city stages load faster.',
        },
        {
          date: '6 November 2026',
          title: 'Trams and a detailed city',
          body: 'Urban stages gained scheduled trams, detailed buildings, crossings, parked cars, street trees, lamps and street furniture. The Boreal Saloon was reshaped, while city junctions, sidewalks, roundabouts, side streets and parked-car placement received fixes.',
        },
        {
          date: '5 November 2026',
          title: 'Cities, circuits and a changing coast',
          body: 'Urban stages and three-lap circuit races joined the schedule, with race asphalt, kerbs, gravel traps and barriers. The region cycle and save migrations were updated; Coast stages gained varied shorelines, richer cliffs and terrain. Mobile fullscreen behavior was adjusted.',
        },
        {
          date: '4 November 2026',
          title: 'Mobile installation and a new special',
          body: 'The Mulsanne LM Prototype joined the dealership, and phones and tablets gained an install prompt, rotating orientation, Android fullscreen support and full-bleed home-screen icons. The Albion RS Hatch was rebuilt from its road-car shape.',
        },
        {
          date: '3 November 2026',
          title: 'Coast, Desert and rally raid',
          body: 'The Coast and Desert regions arrived with distinct roads and terrain, alongside the Toro Dakar Buggy and autumn colours for Forest mud stages. Splash-screen driving and replays were improved; Desert stages stay open road, Coast roads gained their own icon, and the region rotation was refined.',
        },
        {
          date: '2 November 2026',
          title: 'Cinematic camera, replays and HUD options',
          body: 'A cinematic camera and finish replays joined the game, along with an option to hide the HUD. Town geometry, junctions and prize progression were refined, replay tyre marks now follow the recording, and the project gained its gameplay, content, testing and changelog documents.',
        },
        {
          date: '1 November 2026',
          title: 'Towns, interiors and stage history',
          body: 'Village sections, per-car rally interiors, a stage list and a touch pause menu arrived, alongside the Sochaux T16 and new car model work. Camera controls, handbrake placement and town streets were refined, with fixes to canopy testing and Garage end-to-end coverage.',
        },
        {
          date: '31 October 2026',
          title: 'Alpine region and more cars',
          body: 'The Alpine region, snow-covered houses, checkpoint boards and stage history arrived. The Boreal Saloon, Sirocco Dakar Truck, Albion RS Hatch and Edelweiss S1 joined or were rebuilt for the catalogue. Camera behavior, launch revs, terrain under roads, dealership cards and tree placement were refined.',
        },
        {
          date: '30 October 2026',
          title: 'Garage, handling and tyre marks',
          body: 'The Garage launched with seven live upgrades and a 3D dealership, alongside lofted procedural cars, the Riviera WRC, Edelweiss S1 and fading tyre marks. Online saves moved to Supabase; handling, wheel placement, responsive Garage layout, search metadata and analytics were updated.',
        },
        {
          date: '29 October 2026',
          title: 'First playable release',
          body: 'The first build introduced the browser game foundation, fixed-step vehicle simulation, seeded procedural Forest stages, checkpoints, timing, penalties and prize money. It also brought the rally hatch, low-poly scenery, HUD and Game panel, Game IDs with online saves, four camera views, privacy information and the test and CI setup.',
        },
      ],
    },
    faqs: [
      {
        question: 'How do I start a game?',
        answer:
          'Enter a driver name and choose Drive. Leave Game ID empty to begin a new game, or enter an existing ID to continue it.',
      },
      {
        question: 'What is a Game ID?',
        answer:
          'It is the key to your game and appears in its URL. Anyone with the ID can load that game, so share it only with people you trust.',
      },
      {
        question: 'Is my progress saved?',
        answer:
          'Progress is saved on your device first and then online. If the server is unavailable, the local save stays in place and the game retries later.',
      },
      {
        question: 'Do the stages change each time?',
        answer:
          'A stage is generated from your game and stage seeds, so the same stage in the same game is consistent. The schedule continues with longer and tighter roads.',
      },
      {
        question: 'How do I change the camera?',
        answer:
          'Press C while driving or choose a camera in Settings. The game has chase, interior, isometric and cinematic views.',
      },
      {
        question: 'How do I get back on the road if I am stuck or lost?',
        answer:
          'Press R, or tap the back-to-checkpoint button next to Pause on a touchscreen. The car returns to the road just past the last checkpoint you passed (or to the start), facing down the road; the stage clock keeps running.',
      },
    ],
    contact: {
      intro: 'Found a bug, have an idea, or want to ask a question? Get in touch.',
      emailLabel: 'Email',
      feedbackTitle: 'Send feedback',
      feedbackBody:
        'Use the feedback form for a message. Your name and email are optional; add an email if you would like a reply.',
      feedbackCta: 'Open feedback form',
    },
    back: 'Back to the game',
  },
  garage: {
    button: 'Garage',
    title: 'Garage',
    hint: 'Changes apply right away, even mid-stage.',
    tabs: { upgrades: 'Upgrades', dealership: 'Dealership' },
    buy: 'Buy',
    maxed: 'Maxed out',
    select: 'Select',
    inUse: 'In use',
    owned: 'Owned',
    level: 'Level {n} of {max}',
    stats: { power: 'Power', grip: 'Grip', agility: 'Agility' },
    special: 'Special',
    prev: 'Previous car',
    next: 'Next car',
  },
  upgrades: {
    engine: {
      name: 'Engine tune',
      desc: 'Freer breathing and a sharper map: more torque everywhere.',
    },
    turbo: {
      name: 'Turbo kit',
      desc: 'Hold Shift for a burst of boost. Recharges while you drive.',
    },
    tyres: {
      name: 'Rally tyres',
      desc: 'Softer compound and a wider footprint for grip on every surface.',
    },
    suspension: {
      name: 'Suspension',
      desc: 'Stiffer springs and dampers keep the car settled over crests and ruts.',
    },
    brakes: { name: 'Brakes', desc: 'Bigger discs stop harder and later into the corner.' },
    gearbox: {
      name: 'Quick-shift gearbox',
      desc: 'Faster shifts and less drivetrain loss between gears.',
    },
    weight: {
      name: 'Weight reduction',
      desc: 'Lighter panels and glass: quicker everywhere, easier to turn.',
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
      name: 'Tempesta Group B',
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
    left: 'Steer left',
    right: 'Steer right',
    gas: 'Gas',
    brake: 'Brake',
    handbrake: 'Handbrake',
    turbo: 'Turbo',
  },
  toolbar: {
    label: 'Game menu',
    settings: 'Settings',
    game: 'Game',
    pause: 'Pause',
    reset: 'Back to checkpoint',
    pauseTitle: 'Paused',
    resume: 'Resume',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    controls: 'Controls',
    camera: 'Camera',
    cameraHint: 'Press C while driving to switch.',
    cameras: { chase: 'Chase', interior: 'Interior', iso: 'Isometric', cinematic: 'Cinematic' },
    languages: { en: 'English', es: 'Español', it: 'Italiano' },
    close: 'Close',
  },
  game: {
    title: 'Game',
    restartStage: 'Restart stage',
    close: 'Close',
    stageSection: 'This stage',
    stageName: 'Stage',
    stageType: 'Stage type',
    length: 'Length',
    km: '{km} km',
    laps: '{laps} laps · {km} km',
    par: 'Par time',
    best: 'Your best',
    none: '—',
    stagesSection: 'Stages',
    showMore: 'Show {n} more',
    currentStage: 'Current stage',
    driverSection: 'Driver',
    driver: 'Name',
    gameId: 'Game ID',
    copy: 'Copy',
    copied: 'Copied!',
    syncOnline: 'Progress saved online.',
    syncOffline: 'Saved on this device only. Will retry online.',
    syncSaving: 'Saving…',
    syncIdle: 'Progress is saved automatically.',
    feedback: 'Feedback',
    about: 'About',
  },
  stageTypes: {
    arctic: 'Arctic',
    circuit: 'Circuit',
    autumnal: 'Autumnal',
    pinewood: 'Pinewood',
    alpine: 'Alpine',
    forest: 'Forest',
    urban: 'Urban',
    coastal: 'Coastal',
    desert: 'Desert',
  },
  controls: [
    { keys: 'W / S · ↑ / ↓', action: 'Throttle / brake, hold to reverse' },
    { keys: 'A / D · ← / →', action: 'Steer' },
    { keys: 'Space', action: 'Handbrake' },
    { keys: 'Shift', action: 'Turbo (when fitted)' },
    { keys: 'R', action: 'Back to the last checkpoint' },
    { keys: 'C', action: 'Switch camera (chase / interior / isometric / cinematic)' },
    { keys: 'H', action: 'Hide or show the HUD' },
    { keys: 'Mouse wheel', action: 'Zoom the camera' },
    { keys: '`', action: 'Debug overlay' },
    { keys: 'Esc', action: 'Close any panel, or open the Game panel' },
  ],
  controlsTouch: [
    { keys: '◀ ▶', action: 'Steer (bottom left)' },
    { keys: '▼ ▲', action: 'Brake / gas (bottom right), hold brake to reverse' },
    { keys: 'Pedal button', action: 'Handbrake' },
    { keys: 'Pause', action: 'Pause menu: Game, Garage and Settings' },
    {
      keys: 'Settings › Camera',
      action: 'Switch camera (chase / interior / isometric / cinematic)',
    },
  ],
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
    track: 'Race asphalt',
    gravel: 'Gravel',
    mud: 'Mud',
    snow: 'Snow',
    grass: 'Grass',
    sand: 'Sand',
    dune: 'Dunes',
  },
  stage: {
    go: 'GO!',
    progress: 'Stage progress',
    checkpoint: 'Checkpoint {n}/{total}',
    lap: 'Lap {n}/{total}',
    lapTime: 'Lap {n}',
    bestLap: 'Best lap',
    raceTitle: 'Race complete',
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
    replay: 'Watch replay',
    replayTag: 'Replay',
    exitReplay: 'Exit replay',
    replayHint: 'Esc exits · C switches camera',
    resetHint: 'Lost? Press R to return to the last checkpoint.',
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;
