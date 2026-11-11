import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { TerrainField } from '@/game/stage/TerrainField';
import { ChunkStreamer, chunkCoords, chunkKey } from '../ChunkStreamer';
import { meshTerrainChunk, type ChunkMeshData, type TerrainColors } from './meshTerrainChunk';
import type { TerrainWorkerReply, TerrainWorkerRequest } from './terrain.worker';
import type { StageSlot } from '@/game/stage/StageGenerator';

/** Main-thread meshing budget per frame (ms): a chunk takes about 0.5–3 ms. */
const SYNC_BUDGET_MS = 4;

/** The one material every chunk shares, with the worker's baked colours. */
export function terrainMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
}

export interface TerrainChunkOptions {
  size: number;
  resolution: number;
  radius: number;
}

/**
 * Streams terrain chunks around the car. A Web Worker meshes them once it has
 * rebuilt the stage; until it says so (its script still loading, the stage
 * still generating), and for good if it fails, the main thread meshes the
 * nearest chunks itself within a small per-frame budget, so the ground is
 * never missing while the road and scenery already stand.
 */
export class TerrainChunkManager {
  readonly group = new Group();
  private material: MeshStandardMaterial;
  private readonly meshes = new Map<number, Mesh>();
  private readonly streamer: ChunkStreamer;
  private worker: Worker | null = null;
  private workerReady = false;
  /** Chunks waiting for the main thread, nearest first (the streamer asks in that order). */
  private readonly syncQueue: [number, number][] = [];

  constructor(
    gameSeed: number,
    stageIndex: number,
    slot: StageSlot,
    private readonly field: TerrainField,
    private readonly colors: TerrainColors,
    private readonly amplitude: number,
    private readonly opts: TerrainChunkOptions,
  ) {
    this.group.name = 'terrain';
    this.material = terrainMaterial();
    this.streamer = new ChunkStreamer(opts.size, opts.radius, this.request, this.drop);
    try {
      this.worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<TerrainWorkerReply>) => {
        if (e.data.type === 'ready') this.handOver();
        else this.receive(e.data);
      };
      this.worker.onerror = () => this.dropWorker();
      this.post({ type: 'init', gameSeed, stageIndex, slot });
    } catch {
      this.worker = null;
    }
  }

  update(x: number, z: number): void {
    this.streamer.update(x, z);
    // Until the worker is ready (or without one), mesh the nearest chunks here within the budget.
    const start = performance.now();
    while (this.syncQueue.length > 0 && performance.now() - start < SYNC_BUDGET_MS) {
      const [cx, cz] = this.syncQueue.shift()!;
      const key = chunkKey(cx, cz);
      if (!this.streamer.loaded.has(key) || this.meshes.has(key)) continue;
      this.receive(
        meshTerrainChunk(
          this.field,
          this.colors,
          this.amplitude,
          cx,
          cz,
          this.opts.size,
          this.opts.resolution,
        ),
      );
    }
  }

  get loadedCount(): number {
    return this.meshes.size;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.workerReady = false;
    this.streamer.clear();
    this.material.dispose();
  }

  private post(msg: TerrainWorkerRequest): void {
    this.worker?.postMessage(msg);
  }

  /** The worker is ready: it takes the chunks the main thread has not reached yet. */
  private handOver(): void {
    this.workerReady = true;
    for (const [cx, cz] of this.syncQueue.splice(0)) this.request(cx, cz);
  }

  /** The worker failed (its script did not load, or it threw): the main thread meshes everything. */
  private dropWorker(): void {
    this.worker?.terminate();
    this.worker = null;
    this.workerReady = false;
    for (const key of this.streamer.loaded) {
      if (this.meshes.has(key)) continue;
      const [cx, cz] = chunkCoords(key);
      if (!this.syncQueue.some(([x, z]) => x === cx && z === cz)) this.syncQueue.push([cx, cz]);
    }
  }

  private readonly request = (cx: number, cz: number): void => {
    if (this.worker && this.workerReady) {
      this.post({ type: 'chunk', cx, cz, size: this.opts.size, res: this.opts.resolution });
    } else {
      this.syncQueue.push([cx, cz]);
    }
  };

  private readonly drop = (key: number): void => {
    const mesh = this.meshes.get(key);
    if (!mesh) return;
    this.group.remove(mesh);
    mesh.geometry.dispose();
    this.meshes.delete(key);
  };

  private receive(data: ChunkMeshData): void {
    const key = chunkKey(data.cx, data.cz);
    // Chunk may have been unloaded while it was being meshed.
    if (!this.streamer.loaded.has(key) || this.meshes.has(key)) return;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new BufferAttribute(data.normals, 3));
    geo.setAttribute('color', new BufferAttribute(data.colors, 3));
    geo.computeBoundingSphere();
    const mesh = new Mesh(geo, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.meshes.set(key, mesh);
    this.group.add(mesh);
  }
}
