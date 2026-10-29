import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { TerrainField } from '@/game/stage/TerrainField';
import { ChunkStreamer, chunkKey } from '../ChunkStreamer';
import { meshTerrainChunk, type ChunkMeshData, type TerrainColors } from './meshTerrainChunk';
import type { TerrainWorkerRequest } from './terrain.worker';

export interface TerrainChunkOptions {
  size: number;
  resolution: number;
  radius: number;
}

/** Streams terrain chunks around the car; meshing happens in a Web Worker. */
export class TerrainChunkManager {
  readonly group = new Group();
  private readonly material = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
  });
  private readonly meshes = new Map<number, Mesh>();
  private readonly streamer: ChunkStreamer;
  private worker: Worker | null = null;
  private readonly syncQueue: [number, number][] = [];

  constructor(
    gameSeed: number,
    stageIndex: number,
    private readonly field: TerrainField,
    private readonly colors: TerrainColors,
    private readonly amplitude: number,
    private readonly opts: TerrainChunkOptions,
  ) {
    this.group.name = 'terrain';
    this.streamer = new ChunkStreamer(opts.size, opts.radius, this.request, this.drop);
    try {
      this.worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<ChunkMeshData>) => this.receive(e.data);
      this.post({ type: 'init', gameSeed, stageIndex });
    } catch {
      this.worker = null;
    }
  }

  update(x: number, z: number): void {
    this.streamer.update(x, z);
    // Fallback without workers: mesh one chunk per frame on the main thread.
    const next = this.syncQueue.shift();
    if (next) {
      const [cx, cz] = next;
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
    this.streamer.clear();
    this.material.dispose();
  }

  private post(msg: TerrainWorkerRequest): void {
    this.worker?.postMessage(msg);
  }

  private readonly request = (cx: number, cz: number): void => {
    if (this.worker) {
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
