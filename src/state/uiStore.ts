import { create } from 'zustand';

/** Modal HUD panels. Driving pauses while one is open; `menu` is the touch-device pause menu that opens the others. */
export type HudPanel = 'menu' | 'game' | 'settings' | 'garage';

interface UiState {
  panel: HudPanel | null;
  /** The finished run is being played back; the result panel hides until the player leaves it. */
  replay: boolean;
  openPanel: (panel: HudPanel) => void;
  closePanel: () => void;
  /** Open `panel`, or close it if it's already the open one. */
  togglePanel: (panel: HudPanel) => void;
  startReplay: () => void;
  stopReplay: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  panel: null,
  replay: false,
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),
  togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
  startReplay: () => set({ replay: true, panel: null }),
  stopReplay: () => set({ replay: false }),
}));
