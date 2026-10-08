import * as THREE from 'three';

type Point = { x: number; z: number };
type Bounds = { left: number; right: number; back: number; front: number; centerX: number;
  destinations?: { cafe: Point; florist: Point; studio: Point } };
type Primitive = 'box' | 'cylinder' | 'sphere';
type Part = { actor: number; color: string; position: [number, number, number]; scale: [number, number, number]; swing?: number; jointY?: number; lean?: number };
type Walker = { route: Point[]; distances: number[]; length: number; progress: number; delay: number; walking: boolean };
export type CityPedestrianState = { phase: 'outside' | 'going-home' | 'home' | 'coming-out'; visible: number; total: number };
export const PEDESTRIAN_TRANSITION_SECONDS = 8;

/** Fixed instance buffers animate the same neighbours, without rebuilding the city. */
export class CityPedestrians {
  readonly group = new THREE.Group();
  private readonly walkers: Walker[] = [];
  private readonly batches: { mesh: THREE.InstancedMesh; parts: Part[] }[] = [];
  private readonly world = new THREE.Object3D();
  private readonly local = new THREE.Object3D();
  private readonly matrix = new THREE.Matrix4();
  private night = false;
  private moving = false;
  private elapsed = 0;

  constructor({ left, right, back, front, centerX, destinations }: Bounds) {
    this.group.name = 'city-pedestrians';
    const parts: Record<Primitive, Part[]> = { box: [], cylinder: [], sphere: [] };
    const person = (route: Point[], shirt: string, bag = false) => {
      const actor = this.walkers.length;
      const distances = [0];
      for (let index = 1; index < route.length; index++) distances.push(distances[index - 1] + Math.hypot(route[index].x - route[index - 1].x, route[index].z - route[index - 1].z));
      this.walkers.push({ route, distances, length: distances.at(-1)!, progress: 0, delay: 0, walking: false });
      const part = (kind: Primitive, color: string, position: Part['position'], scale: Part['scale'], extra: Partial<Part> = {}) => parts[kind].push({ actor, color, position, scale, ...extra });
      for (const side of [-1, 1]) {
        part('cylinder', '#777583', [side * 0.065, 0.18, 0], [0.082, 0.45, 0.082], { swing: side, jointY: 0.405 });
        part('box', '#675f6f', [side * 0.065, -0.034, 0.035], [0.1, 0.085, 0.18], { swing: side, jointY: 0.405 });
        part('cylinder', shirt, [side * 0.17, 0.61, 0], [0.072, 0.39, 0.072], { swing: -side, jointY: 0.805, lean: side * 0.17 });
      }
      part('sphere', shirt, [0, 0.64, 0], [0.32, 0.53, 0.26]);
      part('sphere', '#cda98b', [0, 1.02, 0], [0.255, 0.29, 0.25]);
      part('sphere', '#64565d', [0, 1.105, -0.025], [0.267, 0.17, 0.263]);
      if (bag) part('box', '#c3aa82', [0.23, 0.46, 0], [0.17, 0.3, 0.2], { swing: -1, jointY: 0.805 });
    };
    const cafe = destinations?.cafe ?? { x: left - 3.6, z: back + 0.8 };
    const florist = destinations?.florist ?? { x: right + 4, z: back + 1.3 };
    const studio = destinations?.studio ?? { x: right + 8, z: back + 0.45 };
    // Routes stay on the pavements and cross at the zebra crossing. Their final
    // points lie just inside neighbouring entrances, hiding the arrival cleanly.
    person([{ x: left - 1.8, z: front + 1.1 }, { x: left - 1.8, z: back + 2 }, { x: cafe.x, z: back + 2 }, cafe], '#9aafad', true);
    person([{ x: right + 1.25, z: back + 1.85 }, { x: florist.x, z: back + 2 }, florist], '#b2a1b8', true);
    person([{ x: left - 5, z: back + 2.9 }, { x: cafe.x, z: back + 2.9 }, cafe], '#c79c86');
    person([{ x: centerX - 1.6, z: front + 6.3 }, { x: left - 1.7, z: front + 6.3 }, { x: left - 1.7, z: front + 1.2 }, { x: left - 1.7, z: back + 2 }, { x: cafe.x, z: back + 2 }, cafe], '#b4ad87', true);
    person([{ x: centerX - 1.1, z: front + 6.1 }, { x: left - 1.45, z: front + 6.1 }, { x: left - 1.45, z: front + 1.2 }, { x: left - 1.45, z: back + 2.2 }, { x: cafe.x + 0.18, z: back + 2.2 }, { x: cafe.x + 0.18, z: cafe.z }], '#a4b0bd');
    person([{ x: studio.x - 2.5, z: back - 1.9 }, { x: studio.x - 2.9, z: back + 1.8 }, { x: studio.x, z: back + 1.8 }, studio], '#c4a0a2');
    const geometries: Record<Primitive, THREE.BufferGeometry> = {
      box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), sphere: new THREE.IcosahedronGeometry(0.5, 1),
    };
    for (const kind of Object.keys(parts) as Primitive[]) {
      const mesh = new THREE.InstancedMesh(geometries[kind], new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 }), parts[kind].length);
      mesh.name = `city-pedestrian-${kind}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      parts[kind].forEach((part, index) => mesh.setColorAt(index, new THREE.Color(part.color)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
      this.batches.push({ mesh, parts: parts[kind] });
    }
    this.draw();
  }

  get state(): CityPedestrianState {
    return {
      phase: this.moving ? this.night ? 'going-home' : 'coming-out' : this.night ? 'home' : 'outside',
      visible: this.walkers.filter(walker => walker.progress < 1).length,
      total: this.walkers.length,
    };
  }

  setMode(night: boolean, snap = false) {
    if (!snap && this.night === night) return;
    this.night = night;
    const target = night ? 1 : 0;
    this.walkers.forEach((walker, index) => {
      if (snap) walker.progress = target;
      // Reversing a transition continues from the current spot on the route.
      walker.delay = snap ? 0 : (night ? index : this.walkers.length - 1 - index) * 0.12;
      walker.walking = false;
    });
    this.moving = !snap && this.walkers.some(walker => walker.progress !== target);
    this.group.visible = !night || this.moving;
    this.draw();
  }

  update(delta: number): boolean {
    if (!this.moving || !Number.isFinite(delta) || delta <= 0) return false;
    this.elapsed += delta;
    const target = this.night ? 1 : 0;
    this.walkers.forEach(walker => {
      const elapsed = Math.max(0, delta - walker.delay);
      walker.delay = Math.max(0, walker.delay - delta);
      const previous = walker.progress;
      walker.progress = this.night ? Math.min(1, previous + elapsed / PEDESTRIAN_TRANSITION_SECONDS) : Math.max(0, previous - elapsed / PEDESTRIAN_TRANSITION_SECONDS);
      walker.walking = elapsed > 0 && walker.progress !== target;
    });
    this.moving = this.walkers.some(walker => walker.progress !== target);
    this.group.visible = !this.night || this.moving;
    this.draw();
    return true;
  }

  private draw() {
    const poses = this.walkers.map((walker, index) => {
      const distance = walker.progress * walker.length;
      let segment = 1;
      while (segment < walker.distances.length - 1 && walker.distances[segment] < distance) segment++;
      const from = walker.route[segment - 1], to = walker.route[segment];
      const progress = (distance - walker.distances[segment - 1]) / (walker.distances[segment] - walker.distances[segment - 1]);
      const step = walker.walking ? Math.sin(this.elapsed * 9 + index * 1.4) * 0.42 : 0;
      return { x: THREE.MathUtils.lerp(from.x, to.x, progress), z: THREE.MathUtils.lerp(from.z, to.z, progress), step,
        angle: walker.walking ? Math.atan2(to.x - from.x, to.z - from.z) + (this.night ? 0 : Math.PI) : 0,
        hidden: walker.progress === 1 };
    });
    for (const { mesh, parts } of this.batches) {
      parts.forEach((part, index) => {
        const pose = poses[part.actor];
        this.world.position.set(pose.x, Math.abs(pose.step) * 0.055, pose.z);
        this.world.rotation.set(0, pose.angle, 0);
        this.world.scale.setScalar(pose.hidden ? 0 : 1);
        this.world.updateMatrix();
        const angle = pose.step * (part.swing ?? 0), joint = part.jointY ?? 0;
        const [x, y, z] = part.position;
        this.local.position.set(x, joint + (y - joint) * Math.cos(angle) - z * Math.sin(angle), (y - joint) * Math.sin(angle) + z * Math.cos(angle));
        this.local.rotation.set(angle, 0, part.lean ?? 0);
        this.local.scale.set(...part.scale);
        this.local.updateMatrix();
        this.matrix.multiplyMatrices(this.world.matrix, this.local.matrix);
        mesh.setMatrixAt(index, this.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
