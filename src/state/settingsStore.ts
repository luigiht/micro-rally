import { create } from 'zustand';
import type { Locale } from '@/i18n';
import { DEFAULT_CAMERA, nextCameraMode, type CameraMode } from '@/lib/cameraMode';

interface SettingsState {
  locale: Locale;
  camera: CameraMode;
  /** Tyre marks left on the ground by sliding wheels (a toggleable visual extra). */
  skidMarks: boolean;
  setLocale: (locale: Locale) => void;
  setCamera: (camera: CameraMode) => void;
  /** C key: chase → cab → interior → isometric → chase. */
  cycleCamera: () => void;
  setSkidMarks: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  locale: 'en',
  camera: DEFAULT_CAMERA,
  skidMarks: true,
  setLocale: (locale) => set({ locale }),
  setCamera: (camera) => set({ camera }),
  cycleCamera: () => set((s) => ({ camera: nextCameraMode(s.camera) })),
  setSkidMarks: (skidMarks) => set({ skidMarks }),
}));
