import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import type { Prop } from '@/game/stage/SceneryScatter';
import { SceneryChunkManager, type KindKit } from '@/render/scenery/SceneryChunkManager';

const tree = (x: number): Prop => ({
  kind: 'tree',
  x,
  y: 0,
  z: 10,
  scale: 1,
  rotation: 0,
  variant: 0,
});

function kit(name: string, lod?: 'near' | 'far'): KindKit {
  const geometry = new BoxGeometry();
  geometry.name = name;
  return {
    sources: ['tree'],
    geometry,
    material: new MeshBasicMaterial(),
    tint: null,
    castShadow: false,
    ...(lod ? { lod } : {}),
  };
}

/** Which kits each loaded chunk draws, by geometry name. */
function drawn(m: SceneryChunkManager): string[] {
  return m.group.children.map((c) => (c as InstancedMesh).geometry.name).sort();
}

describe('scenery level of detail', () => {
  it('draws near kits close to the target, far ones beyond, and swaps as it moves', () => {
    // Two chunks of 100 m: one at the origin, one 300 m off.
    const m = new SceneryChunkManager(
      [tree(10), tree(310)],
      [kit('detail', 'near'), kit('standin', 'far'), kit('trunk')],
      100,
      500,
      120,
    );
    m.update(50, 50);
    expect(drawn(m)).toEqual(['detail', 'standin', 'trunk', 'trunk']);
    // Drive to the far chunk: it turns detailed, the first one a stand-in.
    m.update(350, 50);
    expect(drawn(m)).toEqual(['detail', 'standin', 'trunk', 'trunk']);
    const first = m.group.children.find(
      (c) =>
        (c as InstancedMesh).geometry.name !== 'trunk' &&
        (c as InstancedMesh).instanceMatrix.array[12]! < 100,
    );
    expect((first as InstancedMesh).geometry.name).toBe('standin');
    m.dispose();
  });

  it('details a chunk once any part of it is within the radius, not only its centre', () => {
    // The car 20 m short of the second chunk's edge: its centre is 70 m off, past the 40 m radius.
    const m = new SceneryChunkManager(
      [tree(10), tree(110)],
      [kit('detail', 'near'), kit('standin', 'far')],
      100,
      500,
      40,
    );
    m.update(80, 50);
    expect(drawn(m)).toEqual(['detail', 'detail']);
    m.dispose();
  });

  it('keeps everything detailed without a detail radius', () => {
    const m = new SceneryChunkManager(
      [tree(10), tree(310)],
      [kit('detail', 'near'), kit('standin', 'far')],
      100,
      500,
    );
    m.update(50, 50);
    expect(drawn(m)).toEqual(['detail', 'detail']);
    m.dispose();
  });
});
