import { create } from 'zustand';
import type { Locale } from '@/i18n';
import { DEFAULT_CAMERA, nextCameraMode, type CameraMode } from '@/lib/cameraMode';

interface SettingsState {
  locale: Locale;
  camera: CameraMode;
  /** Show the co-driver's pace notes (the next corner's call) on the HUD. */
  paceNotes: boolean;
  setLocale: (locale: Locale) => void;
  setCamera: (camera: CameraMode) => void;
  setPaceNotes: (on: boolean) => void;
  /** C key: chase → interior → isometric → chase. */
  cycleCamera: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  locale: 'en',
  camera: DEFAULT_CAMERA,
  paceNotes: true,
  setLocale: (locale) => set({ locale }),
  setCamera: (camera) => set({ camera }),
  setPaceNotes: (paceNotes) => set({ paceNotes }),
  cycleCamera: () => set((s) => ({ camera: nextCameraMode(s.camera) })),
}));
