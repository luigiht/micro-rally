'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Object3D, type InstancedMesh } from 'three';
import { TEST_TRACK } from '@/game/stage/TestTrack';
import { buildRampGeometry } from '@/render/testTrack/buildRampGeometry';

const SURFACE_COLORS = {
  tarmac: '#55565e',
  gravel: '#b59a72',
  snow: '#eef3f7',
  mud: '#6b4d33',
  grass: '#8fbf6a',
} as const;

const CONE_COUNT = 72;
const TREE_COUNT = 140;

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function useInstanceLayout(
  ref: React.RefObject<InstancedMesh | null>,
  layout: (dummy: Object3D, i: number) => void,
) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    for (let i = 0; i < mesh.count; i++) {
      layout(dummy, i);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, layout]);
}

export function TestTrackView() {
  const { ring, pads, ramp, size } = TEST_TRACK;
  const rampGeo = useMemo(
    () => buildRampGeometry(ramp.length, ramp.height, ramp.width),
    [ramp.length, ramp.height, ramp.width],
  );
  useEffect(() => () => rampGeo.dispose(), [rampGeo]);

  const cones = useRef<InstancedMesh>(null);
  const trees = useRef<InstancedMesh>(null);

  const coneLayout = useMemo(
    () => (d: Object3D, i: number) => {
      const a = (i / (CONE_COUNT / 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? ring.innerRadius - 0.6 : ring.outerRadius + 0.6;
      d.position.set(Math.cos(a) * r, 0.35, Math.sin(a) * r);
      d.scale.setScalar(1);
    },
    [ring.innerRadius, ring.outerRadius],
  );
  const treeLayout = useMemo(() => {
    const rand = seededRandom(7);
    const placed: [number, number, number][] = [];
    while (placed.length < TREE_COUNT) {
      const x = (rand() - 0.5) * size;
      const z = (rand() - 0.5) * size;
      if (Math.hypot(x, z) > ring.outerRadius + 6) placed.push([x, z, 0.8 + rand() * 0.9]);
    }
    return (d: Object3D, i: number) => {
      const [x, z, s] = placed[i]!;
      d.position.set(x, 2.2 * s, z);
      d.scale.setScalar(s);
    };
  }, [ring.outerRadius, size]);

  useInstanceLayout(cones, coneLayout);
  useInstanceLayout(trees, treeLayout);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size * 3, size * 3]} />
        <meshStandardMaterial color={SURFACE_COLORS.grass} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <ringGeometry args={[ring.innerRadius, ring.outerRadius, 96]} />
        <meshStandardMaterial color={SURFACE_COLORS.tarmac} roughness={0.9} />
      </mesh>
      {pads.map((p) => (
        <mesh
          key={p.surface}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[p.cx, 0.02, p.cz]}
          receiveShadow
        >
          <planeGeometry args={[p.w, p.d]} />
          <meshStandardMaterial color={SURFACE_COLORS[p.surface]} roughness={1} />
        </mesh>
      ))}
      <mesh geometry={rampGeo} position={[ramp.cx, 0, ramp.z0]} castShadow receiveShadow>
        <meshStandardMaterial color={SURFACE_COLORS.tarmac} flatShading />
      </mesh>
      <instancedMesh ref={cones} args={[undefined, undefined, CONE_COUNT]} castShadow>
        <coneGeometry args={[0.3, 0.7, 6]} />
        <meshStandardMaterial color="#e8623a" flatShading />
      </instancedMesh>
      <instancedMesh ref={trees} args={[undefined, undefined, TREE_COUNT]} castShadow>
        <coneGeometry args={[1.4, 4.4, 6]} />
        <meshStandardMaterial color="#3f7a4a" flatShading />
      </instancedMesh>
    </group>
  );
}
