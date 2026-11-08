'use client';

import { LOCALES, type Locale } from '@/i18n';
import { useMessages } from '@/i18n/useMessages';
import { CAMERA_MODES, type CameraMode } from '@/lib/cameraMode';
import { useSettingsStore } from '@/state/settingsStore';
import { useUiStore } from '@/state/uiStore';
import { ControlsTable } from './ControlsTable';
import { HudDialog } from './HudDialog';

/** The Settings panel: language, camera, pace notes and the controls reference. Audio and quality arrive in milestone 7. */
export function SettingsPanel() {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const camera = useSettingsStore((s) => s.camera);
  const paceNotes = useSettingsStore((s) => s.paceNotes);

  return (
    <HudDialog
      id="settings-panel"
      title={m.settings.title}
      closeLabel={m.settings.close}
      onClose={() => useUiStore.getState().closePanel()}
    >
      <label htmlFor="settings-language" className="mt-5 block font-pixel text-xs">
        {m.settings.language}
      </label>
      <select
        id="settings-language"
        value={locale}
        onChange={(e) => useSettingsStore.getState().setLocale(e.target.value as Locale)}
        className="pixel-select mt-3 w-full"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {m.settings.languages[l]}
          </option>
        ))}
      </select>

      <label htmlFor="settings-camera" className="mt-6 block font-pixel text-xs">
        {m.settings.camera}
      </label>
      <select
        id="settings-camera"
        value={camera}
        onChange={(e) => useSettingsStore.getState().setCamera(e.target.value as CameraMode)}
        className="pixel-select mt-3 w-full"
      >
        {CAMERA_MODES.map((c) => (
          <option key={c} value={c}>
            {m.settings.cameras[c]}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-ink/70 coarse:hidden">{m.settings.cameraHint}</p>

      <label className="mt-6 flex items-center gap-3 font-pixel text-xs">
        <input
          type="checkbox"
          className="pixel-checkbox"
          checked={paceNotes}
          onChange={(e) => useSettingsStore.getState().setPaceNotes(e.target.checked)}
          aria-describedby="settings-pace-notes-hint"
        />
        {m.settings.paceNotes}
      </label>
      <p id="settings-pace-notes-hint" className="mt-2 text-xs text-ink/70">
        {m.settings.paceNotesHint}
      </p>

      <h3 className="mt-6 font-pixel text-xs">{m.settings.controls}</h3>
      <ControlsTable />
    </HudDialog>
  );
}
