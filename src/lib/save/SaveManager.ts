import { newestSave, type SaveFile } from '@/game/save/SaveFile';
import type { LocalSaveBackend, SaveBackend, SaveOptions } from './SaveBackend';

/** Where the latest save landed. `offline` means the device copy is ahead of the server. */
export type SyncStatus = 'idle' | 'saving' | 'online' | 'offline';

/**
 * Device-first persistence: every save is written locally at once, then
 * pushed online. If the server is unreachable the save stays local and the
 * next save (or the periodic autosave) retries. Loads merge both copies and
 * keep the newest.
 */
export class SaveManager {
  private remotePending = false;

  constructor(
    readonly local: LocalSaveBackend,
    private readonly remote: SaveBackend | null,
    private readonly onStatus: (status: SyncStatus) => void = () => {},
  ) {}

  /** True when a local save has not yet reached the server. */
  get hasPendingUpload(): boolean {
    return this.remotePending;
  }

  async load(gameId: string): Promise<SaveFile | null> {
    const local = this.local.loadSync(gameId);
    let remote: SaveFile | null = null;
    if (this.remote) {
      try {
        remote = await this.remote.load(gameId);
      } catch {
        remote = null;
      }
    }
    return newestSave(local, remote);
  }

  async save(file: SaveFile, opts: SaveOptions = {}): Promise<void> {
    await this.local.save(file);
    this.local.lastGameId = file.gameId;
    if (!this.remote) {
      this.onStatus('online');
      return;
    }
    this.remotePending = true;
    this.onStatus('saving');
    try {
      await this.remote.save(file, opts);
      this.remotePending = false;
      this.onStatus('online');
    } catch {
      this.onStatus('offline');
    }
  }
}
