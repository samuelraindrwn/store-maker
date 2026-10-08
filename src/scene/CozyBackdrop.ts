import * as THREE from 'three';

const fragmentShader = `
  uniform float uNight;
  uniform float uAspect;
  uniform float uTopView;
  varying vec2 vBackdropUv;

  float hash(float value) { return fract(sin(value * 127.1 + 311.7) * 43758.5453); }
  float ellipse(vec2 point, vec2 center, vec2 radius) {
    return 1.0 - smoothstep(0.78, 1.0, length((point - center) / radius));
  }
  float cloud(vec2 point, vec2 center, float scale) {
    vec2 p = (point - center) / scale;
    float shape = ellipse(p, vec2(-0.055, 0.0), vec2(0.071, 0.022));
    shape = max(shape, ellipse(p, vec2(0.001, 0.016), vec2(0.056, 0.041)));
    shape = max(shape, ellipse(p, vec2(0.058, 0.005), vec2(0.052, 0.028)));
    return shape;
  }
  float towers(vec2 point, float count, float base, float height, float seed) {
    float column = floor(point.x * count);
    float roof = base + hash(column + seed) * height;
    roof += step(0.78, fract(point.x * count)) * 0.007;
    return 1.0 - smoothstep(roof, roof + 0.003, point.y);
  }
  void main() {
    vec2 uv = vBackdropUv;
    float night = clamp(uNight, 0.0, 1.0);
    float decoration = 1.0 - uTopView * 0.88;
    vec3 dayLow = vec3(0.91, 0.84, 0.76);
    vec3 dayHigh = vec3(0.44, 0.65, 0.76);
    vec3 nightLow = vec3(0.071, 0.092, 0.17);
    vec3 nightHigh = vec3(0.011, 0.023, 0.068);
    vec3 color = mix(mix(dayLow, dayHigh, smoothstep(0.06, 0.95, uv.y)),
                     mix(nightLow, nightHigh, smoothstep(0.0, 1.0, uv.y)), night);
    float glow = exp(-pow((uv.y - 0.38) * 5.2, 2.0));
    color += mix(vec3(0.06, 0.031, 0.016), vec3(0.025, 0.016, 0.038), night) * glow;

    vec2 aspect = vec2(uAspect, 1.0);
    float sunDistance = length((uv - vec2(0.18, 0.79)) * aspect);
    float sun = 1.0 - smoothstep(0.044, 0.047, sunDistance);
    color += vec3(0.10, 0.065, 0.012) * exp(-sunDistance * 13.0) * (1.0 - night) * decoration;
    color = mix(color, vec3(1.0, 0.90, 0.61), sun * (1.0 - night) * decoration * 0.86);

    float moon = 1.0 - smoothstep(0.033, 0.036, length((uv - vec2(0.83, 0.81)) * aspect));
    float cutout = 1.0 - smoothstep(0.030, 0.033, length((uv - vec2(0.843, 0.821)) * aspect));
    moon *= 1.0 - cutout;
    color = mix(color, vec3(0.88, 0.91, 0.82), moon * night * decoration);

    vec2 starGrid = uv * vec2(48.0 * uAspect, 42.0);
    vec2 starCell = floor(starGrid);
    float starSeed = starCell.x * 17.0 + starCell.y * 113.0;
    vec2 starPoint = fract(starGrid) - vec2(hash(starSeed), hash(starSeed + 47.0));
    float stars = (1.0 - smoothstep(0.014, 0.075, length(starPoint))) * step(0.95, hash(starSeed + 7.0));
    stars *= smoothstep(0.42, 0.61, uv.y) * night * decoration;
    color += vec3(0.74, 0.76, 0.64) * stars;

    vec2 cloudPoint = vec2((uv.x - 0.5) * uAspect + 0.5, uv.y);
    float clouds = cloud(cloudPoint, vec2(0.36, 0.75), 1.0);
    clouds = max(clouds, cloud(cloudPoint, vec2(0.79, 0.63), 0.86));
    clouds = max(clouds, cloud(cloudPoint, vec2(0.13, 0.54), 1.17));
    clouds = max(clouds, cloud(cloudPoint, vec2(1.19, 0.87), 1.32));
    color = mix(color, mix(vec3(0.99, 0.94, 0.85), vec3(0.13, 0.16, 0.26), night), clouds * decoration * mix(0.54, 0.22, night));

    float horizonFade = smoothstep(0.18, 0.42, uv.y);
    float hill = 0.48 + sin(uv.x * 8.0 + 0.3) * 0.027 + sin(uv.x * 19.0) * 0.012;
    float hillMask = (1.0 - smoothstep(hill, hill + 0.005, uv.y)) * decoration * horizonFade;
    color = mix(color, mix(vec3(0.56, 0.65, 0.66), vec3(0.059, 0.080, 0.13), night), hillMask * 0.40);
    float farBuildings = towers(uv, 39.0 * uAspect, 0.35, 0.10, 8.0) * decoration * horizonFade;
    color = mix(color, mix(vec3(0.62, 0.65, 0.69), vec3(0.040, 0.058, 0.10), night), farBuildings * 0.47);
    float nearBuildings = towers(uv, 24.0 * uAspect, 0.28, 0.11, 93.0) * decoration * horizonFade;
    color = mix(color, mix(vec3(0.66, 0.69, 0.68), vec3(0.030, 0.043, 0.078), night), nearBuildings * 0.52);
    // A tiny dither avoids bands in the large, quiet gradients.
    color += (hash(dot(gl_FragCoord.xy, vec2(0.31, 1.79))) - 0.5) / 700.0;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

type GroundMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type GroundState = {
  mesh: GroundMesh;
  transparent: boolean;
  depthWrite: boolean;
  opacity: number;
  position: THREE.Vector3;
  scale: THREE.Vector3;
  size: THREE.Vector2;
};

/** One screen-filling sky, independent of the active storey's height or camera orbit. */
export class CozyBackdrop {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private ground?: GroundState;
  private disposed = false;
  private readonly groundBounds = new THREE.Box2();
  private readonly corner = new THREE.Vector3();
  private readonly groundPoint = new THREE.Vector2();

  constructor() {
    const material = new THREE.ShaderMaterial({
      uniforms: { uNight: { value: 0 }, uAspect: { value: 1 }, uTopView: { value: 0 } },
      vertexShader: `varying vec2 vBackdropUv;
        void main() { vBackdropUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.name = 'cozy-sky-backdrop';
    this.mesh.renderOrder = -100_000;
    this.mesh.frustumCulled = false;
    this.mesh.userData.environment = true;
    this.mesh.raycast = () => {};
  }

  setNightProgress(progress: number) {
    this.mesh.material.uniforms.uNight.value = Number.isFinite(progress) ? THREE.MathUtils.clamp(progress, 0, 1) : 0;
  }

  resize(width: number, height: number) {
    this.mesh.material.uniforms.uAspect.value = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 1;
  }

  setView(view: 'orbit' | 'top' | 'front') {
    this.mesh.material.uniforms.uTopView.value = view === 'top' ? 1 : 0;
  }

  /** Continuous terrain supports both the neighborhood and the distant towers. */
  configureGround(mesh: THREE.Mesh) {
    if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return;
    if (this.ground?.mesh !== mesh) {
      this.restoreGround();
      mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox;
      if (!bounds || bounds.max.x <= bounds.min.x || bounds.max.y <= bounds.min.y) return;
      const material = mesh.material;
      this.ground = { mesh: mesh as GroundMesh, transparent: material.transparent,
        depthWrite: material.depthWrite, opacity: material.opacity,
        position: mesh.position.clone(), scale: mesh.scale.clone(),
        size: new THREE.Vector2(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y) };
      // Alpha fading exposed stars beneath buildings outside the small city
      // plate. Let the existing distance fog soften terrain, never its opacity.
      material.transparent = false;
      material.depthWrite = true;
      material.opacity = 1;
      material.needsUpdate = true;
    }
  }

  /** Cover every visible ground point, including after zooming out or panning. */
  updateGround(camera: THREE.Camera) {
    if (!this.ground) return;
    const { mesh, position, scale, size } = this.ground;
    this.groundBounds.min.set(position.x - size.x * scale.x / 2, position.z - size.y * scale.y / 2);
    this.groundBounds.max.set(position.x + size.x * scale.x / 2, position.z + size.y * scale.y / 2);
    camera.updateMatrixWorld();
    // The projection of the entire frustum contains every possible intersection
    // with the horizontal terrain, at any active storey's elevation.
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      this.corner.set(x, y, z).unproject(camera);
      this.groundBounds.expandByPoint(this.groundPoint.set(this.corner.x, this.corner.z));
    }
    this.groundBounds.expandByScalar(2);
    const { min, max } = this.groundBounds;
    mesh.position.x = (min.x + max.x) / 2;
    mesh.position.z = (min.y + max.y) / 2;
    mesh.scale.x = (max.x - min.x) / size.x;
    mesh.scale.y = (max.y - min.y) / size.y;
  }

  private restoreGround() {
    if (!this.ground) return;
    const { mesh, transparent, depthWrite, opacity, position, scale } = this.ground;
    mesh.material.transparent = transparent;
    mesh.material.depthWrite = depthWrite;
    mesh.material.opacity = opacity;
    mesh.position.x = position.x;
    mesh.position.z = position.z;
    mesh.scale.copy(scale);
    mesh.material.needsUpdate = true;
    this.ground = undefined;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.restoreGround();
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
