import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, Vector3, type Material } from 'three';

/** A small, reusable curved tube: no asset fetches or geometry allocation while its endpoints move. */
export class CarouselLeash {
  readonly mesh: Mesh;
  private readonly geometry = new BufferGeometry();
  private readonly segments = 12;
  private readonly sides = 6;
  private readonly positions = new BufferAttribute(new Float32Array((this.segments + 1) * (this.sides + 1) * 3), 3).setUsage(DynamicDrawUsage);
  private readonly normals = new BufferAttribute(new Float32Array(this.positions.array.length), 3).setUsage(DynamicDrawUsage);
  private readonly delta = new Vector3();
  private readonly tangent = new Vector3();
  private readonly side = new Vector3();
  private readonly normal = new Vector3();

  constructor(material: Material, private readonly cell: number) {
    const indices: number[] = [], stride = this.sides + 1;
    for (let row = 0; row < this.segments; row++) for (let col = 0; col < this.sides; col++) {
      const a = row * stride + col, b = a + stride;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    this.geometry.setIndex(indices);
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('normal', this.normals);
    this.mesh = new Mesh(this.geometry, material);
    this.mesh.name = 'render3d-carousel-tether';
    this.mesh.visible = false;
  }

  update(from: Vector3, to: Vector3): void {
    const delta = this.delta.subVectors(to, from), length = delta.length();
    this.mesh.visible = length > 1;
    if (!this.mesh.visible) return;
    this.mesh.position.copy(from);
    // A little slack at rest, bounded even if a receipt arrives before its walk.
    const sag = Math.min(this.cell * 0.18, length * 0.14), radius = this.cell * 0.022;
    this.side.set(delta.z, 0, -delta.x);
    if (this.side.lengthSq() < 1e-8) this.side.set(1, 0, 0);
    this.side.normalize();
    for (let row = 0; row <= this.segments; row++) {
      const t = row / this.segments;
      this.tangent.copy(delta); this.tangent.y -= 4 * sag * (1 - 2 * t); this.tangent.normalize();
      this.normal.crossVectors(this.tangent, this.side).normalize();
      for (let col = 0; col <= this.sides; col++) {
        const angle = col / this.sides * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
        const x = this.side.x * c + this.normal.x * s, y = this.side.y * c + this.normal.y * s, z = this.side.z * c + this.normal.z * s;
        const index = row * (this.sides + 1) + col;
        this.positions.setXYZ(index, delta.x * t + x * radius, delta.y * t - 4 * sag * t * (1 - t) + y * radius, delta.z * t + z * radius);
        this.normals.setXYZ(index, x, y, z);
      }
    }
    this.positions.needsUpdate = this.normals.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  /** The material belongs to the stage and is shared by seats. */
  dispose(): void { this.mesh.removeFromParent(); this.geometry.dispose(); }
}
