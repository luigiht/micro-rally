import { create } from 'zustand';

/** Modal HUD panels. Driving pauses while one is open. */
export type HudPanel = 'game' | 'settings' | 'garage';

interface UiState {
  panel: HudPanel | null;
  openPanel: (panel: HudPanel) => void;
  closePanel: () => void;
  /** Open `panel`, or close it if it's already the open one. */
  togglePanel: (panel: HudPanel) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  panel: null,
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),
  togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
}));
