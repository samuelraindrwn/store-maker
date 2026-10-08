import * as THREE from 'three';

export type NightLightTag = { color: string; dayIntensity: number; nightIntensity: number; distance: number; kind: 'shop' | 'street' };
export type NightGlowTag = { color: string; dayIntensity: number; nightIntensity: number };
export type NightOpacityTag = { day: number; night: number };

const TRANSITION_SECONDS = 0.8;
export const MAX_LOCAL_LIGHTS = 8;
// Match the city plate. Night illumination already darkens both surfaces;
// darkening only the terrain's albedo made the surrounding land look like void.
const TERRAIN_COLOR = '#c9d1bd';
const DAY = {
  background: new THREE.Color('#e8edf0'), fog: new THREE.Color('#e8edf0'), ground: new THREE.Color(TERRAIN_COLOR),
  sky: new THREE.Color('#fff6e8'), hemisphereGround: new THREE.Color('#ada3b7'), sun: new THREE.Color('#fff1db'), fill: new THREE.Color('#d6d2ff'),
  hemisphere: 2.4, sunlight: 3.1, fillLight: 1.15, exposure: 1.12,
};
const NIGHT = {
  background: new THREE.Color('#111b31'), fog: new THREE.Color('#17243d'), ground: new THREE.Color(TERRAIN_COLOR),
  sky: new THREE.Color('#90a8d6'), hemisphereGround: new THREE.Color('#4a405c'), sun: new THREE.Color('#b6cdff'), fill: new THREE.Color('#8296ce'),
  hemisphere: 1.0, sunlight: 0.62, fillLight: 0.38, exposure: 1.05,
};

function visible(object: THREE.Object3D) {
  let ancestor: THREE.Object3D | null = object;
  while (ancestor) {
    if (!ancestor.visible) return false;
    ancestor = ancestor.parent;
  }
  return true;
}

type Source = { object: THREE.Object3D; tag: NightLightTag; color: THREE.Color; wall: boolean };
type Glow = { material: THREE.MeshStandardMaterial; tag: NightGlowTag; dayColor: THREE.Color; nightColor: THREE.Color };
type Opacity = { material: THREE.Material; tag: NightOpacityTag };

/** One fixed light rig. Tagged content supplies positions and glow, never new lights. */
export class NightLighting {
  readonly group = new THREE.Group();
  readonly hemisphere = new THREE.HemisphereLight(DAY.sky, DAY.hemisphereGround, DAY.hemisphere);
  readonly sun = new THREE.DirectionalLight(DAY.sun, DAY.sunlight);
  readonly fill = new THREE.DirectionalLight(DAY.fill, DAY.fillLight);
  readonly localLights = Array.from({ length: MAX_LOCAL_LIGHTS }, () => new THREE.PointLight('#ffd79b', 0, 4, 2));
  private readonly background = DAY.background.clone();
  private readonly fog = new THREE.Fog(DAY.fog, 32, 70);
  private readonly originalGlow = new WeakMap<THREE.Material, THREE.Color>();
  private sources: Source[] = [];
  private glows: Glow[] = [];
  private opacities: Opacity[] = [];
  private progress = 0;
  private target = 0;
  private from = 0;
  private elapsed = TRANSITION_SECONDS;
  private sourcesDirty = true;
  private shopLights = 0;
  private cityLights = 0;
  private wallLights = 0;
  private readonly position = new THREE.Vector3();

  constructor(scene: THREE.Scene, private renderer: Pick<THREE.WebGLRenderer, 'toneMappingExposure'>, private groundMaterial: THREE.MeshStandardMaterial) {
    this.group.name = 'shop-lighting';
    this.sun.position.set(-4, 11, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 12;
    this.sun.shadow.camera.bottom = -12;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 35;
    this.sun.shadow.normalBias = 0.022;
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.radius = 4;
    this.fill.position.set(7, 5, -3);
    this.localLights.forEach((light, index) => {
      light.name = `pooled-shop-light:${index}`;
      // Keep all eight visible, even at zero intensity, so shader light counts stay fixed.
      light.castShadow = false;
    });
    this.group.add(this.hemisphere, this.sun, this.fill, ...this.localLights);
    scene.add(this.group);
    scene.background = this.background;
    scene.fog = this.fog;
    this.applyAtmosphere();
  }

  get mode(): 'day' | 'night' { return this.target ? 'night' : 'day'; }
  get nightProgress() { return this.progress; }
  get activeShopLights() { return this.shopLights; }
  get activeCityLights() { return this.cityLights; }
  get activeWallLights() { return this.wallLights; }
  get activeFloorLights() { return this.shopLights - this.wallLights; }

  setMode(night: boolean, snap = false) {
    const target = night ? 1 : 0;
    if (snap) {
      this.target = this.from = this.progress = target;
      this.elapsed = TRANSITION_SECONDS;
      this.applyAtmosphere();
      this.applyMaterials();
      this.sourcesDirty = true;
    } else if (target !== this.target) {
      this.from = this.progress;
      this.target = target;
      this.elapsed = 0;
    }
  }

  /** Call only when real content is rebuilt. Never include editor ghosts/helpers. */
  refreshSources(roots: readonly (THREE.Object3D | null)[]) {
    this.sources = [];
    this.glows = [];
    this.opacities = [];
    const materials = new Set<THREE.Material>();
    const objects = new Set<THREE.Object3D>();
    roots.forEach(root => root?.traverse(object => {
      if (objects.has(object)) return;
      objects.add(object);
      const lightTag = object.userData.nightLight as NightLightTag | undefined;
      if (lightTag) {
        let ancestor: THREE.Object3D | null = object, wall = false;
        while (ancestor) { wall ||= typeof ancestor.userData.wallItemId === 'string'; ancestor = ancestor.parent; }
        this.sources.push({ object, tag: lightTag, color: new THREE.Color(lightTag.color), wall });
      }
      if (!(object instanceof THREE.Mesh)) return;
      const entries = Array.isArray(object.material) ? object.material : [object.material];
      entries.forEach(material => {
        if (materials.has(material)) return;
        materials.add(material);
        const glow = material.userData.nightGlow as NightGlowTag | undefined;
        if (glow && material instanceof THREE.MeshStandardMaterial) {
          let dayColor = this.originalGlow.get(material);
          if (!dayColor) { dayColor = material.emissive.clone(); this.originalGlow.set(material, dayColor); }
          this.glows.push({ material, tag: glow, dayColor, nightColor: new THREE.Color(glow.color) });
        }
        const opacity = material.userData.nightOpacity as NightOpacityTag | undefined;
        if (opacity) this.opacities.push({ material, tag: opacity });
      });
    }));
    this.sources.sort((a, b) => Number(a.tag.kind === 'street') - Number(b.tag.kind === 'street'));
    this.applyMaterials();
    this.sourcesDirty = true;
  }

  private applyAtmosphere() {
    const p = this.progress;
    this.background.copy(DAY.background).lerp(NIGHT.background, p);
    this.fog.color.copy(DAY.fog).lerp(NIGHT.fog, p);
    this.groundMaterial.color.copy(DAY.ground).lerp(NIGHT.ground, p);
    this.hemisphere.color.copy(DAY.sky).lerp(NIGHT.sky, p);
    this.hemisphere.groundColor.copy(DAY.hemisphereGround).lerp(NIGHT.hemisphereGround, p);
    this.sun.color.copy(DAY.sun).lerp(NIGHT.sun, p);
    this.fill.color.copy(DAY.fill).lerp(NIGHT.fill, p);
    this.hemisphere.intensity = THREE.MathUtils.lerp(DAY.hemisphere, NIGHT.hemisphere, p);
    this.sun.intensity = THREE.MathUtils.lerp(DAY.sunlight, NIGHT.sunlight, p);
    this.fill.intensity = THREE.MathUtils.lerp(DAY.fillLight, NIGHT.fillLight, p);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, p);
  }

  private applyMaterials() {
    this.glows.forEach(({ material, tag, dayColor, nightColor }) => {
      material.emissive.copy(dayColor).lerp(nightColor, this.progress);
      material.emissiveIntensity = THREE.MathUtils.lerp(tag.dayIntensity, tag.nightIntensity, this.progress);
    });
    this.opacities.forEach(({ material, tag }) => { material.opacity = THREE.MathUtils.lerp(tag.day, tag.night, this.progress); });
  }

  private updatePool() {
    let slot = 0, changed = false;
    this.shopLights = 0;
    this.cityLights = 0;
    this.wallLights = 0;
    for (const source of this.sources) {
      if (!visible(source.object)) continue;
      const intensity = THREE.MathUtils.lerp(source.tag.dayIntensity, source.tag.nightIntensity, this.progress);
      if (intensity <= 0) continue;
      const light = this.localLights[slot++];
      source.object.getWorldPosition(this.position);
      changed ||= !light.position.equals(this.position) || light.intensity !== intensity || !light.color.equals(source.color) || light.distance !== source.tag.distance;
      light.position.copy(this.position);
      light.color.copy(source.color);
      light.intensity = intensity;
      light.distance = source.tag.distance;
      if (source.tag.kind === 'shop') { this.shopLights++; if (source.wall) this.wallLights++; }
      else this.cityLights++;
      if (slot === this.localLights.length) break;
    }
    for (; slot < this.localLights.length; slot++) {
      changed ||= this.localLights[slot].intensity !== 0;
      this.localLights[slot].intensity = 0;
    }
    return changed;
  }

  /** Returns true only when another render is needed; idle scenes remain idle. */
  update(deltaSeconds: number, refreshPositions = false) {
    const previous = this.progress;
    if (this.progress !== this.target) {
      this.elapsed = Math.min(TRANSITION_SECONDS, this.elapsed + Math.max(0, deltaSeconds));
      const t = this.elapsed / TRANSITION_SECONDS;
      this.progress = THREE.MathUtils.lerp(this.from, this.target, t * t * (3 - 2 * t));
      if (this.elapsed === TRANSITION_SECONDS) this.progress = this.target;
    }
    let changed = previous !== this.progress || this.sourcesDirty;
    if (previous !== this.progress) { this.applyAtmosphere(); this.applyMaterials(); }
    if (changed || refreshPositions) changed = this.updatePool() || changed;
    this.sourcesDirty = false;
    return changed;
  }

  /** An export uses the selected mode even during a transition, then restores editing. */
  capture<T>(render: () => T): T {
    const previous = this.progress;
    try {
      this.progress = this.target;
      this.applyAtmosphere(); this.applyMaterials(); this.updatePool();
      return render();
    } finally {
      this.progress = previous;
      this.applyAtmosphere(); this.applyMaterials(); this.updatePool();
    }
  }

  dispose() {
    this.sun.dispose(); this.fill.dispose(); this.localLights.forEach(light => light.dispose());
    this.group.removeFromParent(); this.group.clear();
    this.sources = []; this.glows = []; this.opacities = [];
  }
}
