import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';

/** Wide enough to reach the fog from the car on every side. */
const SIZE = 1000;

/** The sea: one flat plane at sea level that follows the car, so the coast's water never runs out. */
export class SeaPlane {
  readonly group = new Group();
  private readonly geometry = new PlaneGeometry(SIZE, SIZE);
  private readonly material: MeshStandardMaterial;
  private readonly mesh: Mesh;

  constructor(seaLevel: number, color: string) {
    this.group.name = 'sea';
    this.material = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.45 });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = seaLevel;
    this.group.add(this.mesh);
  }

  update(x: number, z: number): void {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
