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
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof en>;
