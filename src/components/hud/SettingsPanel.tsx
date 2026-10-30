'use client';

import { LOCALES, type Locale } from '@/i18n';
import { useMessages } from '@/i18n/useMessages';
import { CAMERA_MODES, type CameraMode } from '@/lib/cameraMode';
import { useSettingsStore } from '@/state/settingsStore';
import { useUiStore } from '@/state/uiStore';
import { ControlsTable } from './ControlsTable';
import { HudDialog } from './HudDialog';

/** The Settings panel: language and the controls reference. Audio and quality arrive in milestone 7. */
export function SettingsPanel() {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const camera = useSettingsStore((s) => s.camera);
  const skidMarks = useSettingsStore((s) => s.skidMarks);

  return (
    <HudDialog
      id="settings-panel"
      title={m.settings.title}
      subtitle={m.game.paused}
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
      <p className="mt-2 text-xs text-ink/70">{m.settings.cameraHint}</p>

      <label className="mt-6 flex cursor-pointer items-center gap-3 font-pixel text-xs">
        <input
          type="checkbox"
          checked={skidMarks}
          onChange={(e) => useSettingsStore.getState().setSkidMarks(e.target.checked)}
          className="pixel-checkbox"
        />
        {m.settings.skidMarks}
      </label>
      <p className="mt-2 text-xs text-ink/70">{m.settings.skidMarksHint}</p>

      <h3 className="mt-6 font-pixel text-xs">{m.settings.controls}</h3>
      <ControlsTable />
    </HudDialog>
  );
}
