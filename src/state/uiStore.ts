import { create } from 'zustand';

interface UiState {
  /** The Game panel (controls + info). Driving pauses while it's open. */
  gamePanelOpen: boolean;
  toggleGamePanel: () => void;
  setGamePanelOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  gamePanelOpen: false,
  toggleGamePanel: () => set((s) => ({ gamePanelOpen: !s.gamePanelOpen })),
  setGamePanelOpen: (open) => set({ gamePanelOpen: open }),
}));
