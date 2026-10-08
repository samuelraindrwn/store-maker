import * as THREE from 'three';
import { getFloorBounds, type ShopDocument } from '../model';

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
  compile: THREE.MeshStandardMaterial['onBeforeCompile'];
  cacheKey: THREE.MeshStandardMaterial['customProgramCacheKey'];
  transparent: boolean;
  depthWrite: boolean;
  renderOrder: number;
};

/** One screen-filling sky, independent of the active storey's height or camera orbit. */
export class CozyBackdrop {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private ground?: GroundState;
  private disposed = false;
  private readonly groundCenter = { value: new THREE.Vector2() };
  private readonly groundHalfSize = { value: new THREE.Vector2(23, 20) };
  private readonly groundFeather = { value: 9 };

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

  /** Fade the large shadow-catching ground beyond the finite neighborhood. */
  configureGround(mesh: THREE.Mesh, shop: ShopDocument) {
    if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return;
    if (this.ground?.mesh !== mesh) {
      this.restoreGround();
      const material = mesh.material;
      const originalCompile = material.onBeforeCompile;
      this.ground = { mesh: mesh as GroundMesh, compile: originalCompile, cacheKey: material.customProgramCacheKey,
        transparent: material.transparent, depthWrite: material.depthWrite, renderOrder: mesh.renderOrder };
      material.transparent = true;
      material.depthWrite = false;
      mesh.renderOrder = -1000;
      material.onBeforeCompile = (shader, renderer) => {
        originalCompile.call(material, shader, renderer);
        shader.uniforms.uBackdropGroundCenter = this.groundCenter;
        shader.uniforms.uBackdropGroundHalfSize = this.groundHalfSize;
        shader.uniforms.uBackdropGroundFeather = this.groundFeather;
        shader.vertexShader = `varying vec2 vBackdropGroundPosition;\n${shader.vertexShader}`
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBackdropGroundPosition = (modelMatrix * vec4(transformed, 1.0)).xz;');
        shader.fragmentShader = `varying vec2 vBackdropGroundPosition;\nuniform vec2 uBackdropGroundCenter;\nuniform vec2 uBackdropGroundHalfSize;\nuniform float uBackdropGroundFeather;\n${shader.fragmentShader}`
          .replace('#include <alphatest_fragment>', `vec2 backdropEdge = abs(vBackdropGroundPosition - uBackdropGroundCenter) - uBackdropGroundHalfSize;
            diffuseColor.a *= 1.0 - smoothstep(0.0, uBackdropGroundFeather, max(backdropEdge.x, backdropEdge.y));
            #include <alphatest_fragment>`);
      };
      material.customProgramCacheKey = () => 'cozy-ground-fade-v1';
      material.needsUpdate = true;
    }
    const bounds = getFloorBounds(shop);
    this.groundCenter.value.set((bounds.minX + bounds.maxX + 1) / 2 - shop.width / 2, (bounds.minZ + bounds.maxZ + 1) / 2 - shop.depth / 2 - 3);
    // The city base covers this transition. By its outer edge the ground is
    // fully transparent, avoiding a black or white strip below the diorama.
    this.groundHalfSize.value.set(Math.max(42, bounds.width + 24) / 2 + 2 - this.groundFeather.value, Math.max(38, bounds.depth + 30) / 2 - this.groundFeather.value);
  }

  private restoreGround() {
    if (!this.ground) return;
    const { mesh, compile, cacheKey, transparent, depthWrite, renderOrder } = this.ground;
    mesh.material.onBeforeCompile = compile;
    mesh.material.customProgramCacheKey = cacheKey;
    mesh.material.transparent = transparent;
    mesh.material.depthWrite = depthWrite;
    mesh.renderOrder = renderOrder;
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
