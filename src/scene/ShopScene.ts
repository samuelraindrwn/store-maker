import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { canPlace, getExterior, getEntrance, getEntranceAnchor, getEntranceRotation, getFloorBounds, getFloorCells, getItemFootprint, getItemPlacementBounds, getWallHeight, hasFloorCell, isStandingSign, MAX_FLOOR_COORD, MIN_FLOOR_COORD, paintFloor, resizeShop, setEntrance, setWallHeight, updateItem, type ShopDocument, type ShopItem } from '../model';
import { canPlaceWallItem, getWallItems, getWallItemSize, getWallMountRuns, getWallRuns, updateWallItem, wallItemPosition, type WallItem } from '../model';
import { applyItemSize, applyWallItemSize, buildCity, buildItem, buildRoom, buildWallItem, disposeGroup, standingSignGroundY, standingSignSupports } from './objects';
import { makeBuildHandles, minimumSize, positionBuildHandles, type BuildHandleId, type Dimensions } from './interactionHandles';
import { FloorPainter, floorOutline, strokeCells, workCells } from './interactionFloor';
import { intersectWall, intersectWallPlane, snapWallDragCandidate, wallFrame, type WallHit } from './interactionWalls';
import { ObjectResizeTools, resizeFloorEdge, resizeFloorToTile, resizeWallEdge, resizeWallToTile, type ResizeEdge } from './interactionObjectResize';
import { getItemSupport } from './itemSupport';
import { getWallItemMount } from '../model';
import { NightLighting } from './lighting';
import { setWallClockTime } from './wallClock';
import { getCityPedestrianState, setCityTimeOfDay, updateCityPedestrians } from './city';
import { applyExteriorWallMaterial } from './exteriorMaterials';
import { CozyBackdrop } from './CozyBackdrop';
import { buildBuilding, buildInteriorContext, buildRooftopStructure, buildStairLandings, getBuildingBounds, getLevelBaseY, getStairRise, LEVEL_SLAB, ROOFTOP_DOOR_OPEN_ANGLE } from './buildingObjects';
import { getStairOpenings } from './stairGeometry';
import { canPlaceLevelItem, canPlaceRooftop, getLevelCount, getLevelDocument, getRoof, getRooftopDocument, getRooftopDoorOpen } from '../model';
import { canPlacePartition, getEntranceWall, getInteriorDoors, getPartitions, getPartitionPosition, placePartition, wallIsHorizontal, type PartitionWall, type WallSide } from '../model';

export type Cell = { x: number; z: number };
export type CameraView = 'orbit' | 'top' | 'front';
export type SceneState = {
  shop: ShopDocument;
  building?: ShopDocument;
  activeLevel?: number;
  exteriorOnly?: boolean;
  rooftopOnly?: boolean;
  selectedId: string | null;
  placement: ShopItem | null;
  selectedWallId: string | null;
  selectedPartitionId?: string | null;
  selectedDoor: boolean;
  wallPlacement: WallItem | null;
  wallPlacementMount?: Pick<WallItem, 'wall' | 'line' | 'partitionId'> | null;
  showGrid: boolean;
  showWalls: boolean;
  showAllWalls?: boolean;
  preview: boolean;
  editMode?: 'arrange' | 'build';
  buildTool?: 'add' | 'erase' | 'walls' | 'partition';
  showCity?: boolean;
  resizeMode?: boolean;
  nightMode?: boolean;
};
export type SceneCallbacks = {
  onSelect: (id: string | null) => void;
  onCell: (x: number, z: number) => void;
  onHover: (cell: Cell | null) => void;
  onSelectWall: (id: string | null) => void;
  onSelectPartition?: (id: string | null) => void;
  onSelectDoor: () => void;
  onToggleRooftopDoor?: (stairId: string) => void;
  onWallPlace: (candidate: WallItem) => void;
  onWallHover: (candidate: WallItem | null) => void;
  onMove?: (id: string, x: number, z: number) => void;
  onChange: (doc: ShopDocument, label?: string) => void;
  onInteraction?: (text: string | null) => void;
  onNotice?: (message: string) => void;
  onError: (message: string) => void;
  onFrame?: () => void;
};

type Gesture = {
  kind: 'resize' | 'height' | 'item' | 'door' | 'rooftop-door' | 'paint' | 'wall-item' | 'object-resize' | 'partition';
  rooftopDoorId?: string;
  partitionCandidate?: PartitionWall;
  pointerId: number;
  handle?: BuildHandleId;
  base: ShopDocument;
  startClient: THREE.Vector2;
  startPoint: THREE.Vector3;
  dimensions: Dimensions;
  item?: ShopItem;
  candidate?: ShopItem;
  itemPosition?: THREE.Vector3;
  valid: boolean;
  moved: boolean;
  draft?: ShopDocument;
  lastCell?: Cell;
  paintOperation?: 'add' | 'erase';
  paintVisited?: Set<string>;
  wallItem?: WallItem;
  wallCandidate?: WallItem;
  wallGrab?: { offset: number; height: number };
  heightPreview?: ShopDocument;
  heightPreviewValue?: number;
  resizeEdge?: ResizeEdge;
  resizeWallStart?: { along: number; height: number };
  resizeTapFallback?: boolean;
};

function frame(width: number, depth: number, color: string, filled = false) {
  const group = new THREE.Group();
  const y = 0.08;
  const pts = [
    new THREE.Vector3(-width / 2 + 0.035, y, -depth / 2 + 0.035),
    new THREE.Vector3(width / 2 - 0.035, y, -depth / 2 + 0.035),
    new THREE.Vector3(width / 2 - 0.035, y, depth / 2 - 0.035),
    new THREE.Vector3(-width / 2 + 0.035, y, depth / 2 - 0.035),
  ];
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
  line.renderOrder = 9;
  group.add(line);
  if (filled) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.065, depth - 0.065), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.076;
    plane.renderOrder = 2;
    group.add(plane);
  }
  for (const point of pts) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.037, 8, 6), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    dot.position.copy(point);
    dot.renderOrder = 10;
    group.add(dot);
  }
  return group;
}

export class ShopScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
  readonly controls: OrbitControls;
  private readonly items = new THREE.Group();
  private readonly wallItems = new THREE.Group();
  private readonly itemPlatforms = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#d3c4ba', roughness: 0.95 }), 200);
  private readonly itemSupportCache = new Map<string, ReturnType<typeof getItemSupport>>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.045);
  private readonly resizeObserver: ResizeObserver;
  private readonly ground: THREE.Mesh;
  private readonly lighting: NightLighting;
  private readonly backdrop = new CozyBackdrop();
  private gameMinutes = 360;
  private clocks: THREE.Object3D[] = [];
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private state: SceneState | null = null;
  private room: THREE.Group | null = null;
  private builtRoom: ReturnType<typeof buildRoom> | null = null;
  private city: THREE.Group | null = null;
  private cityKey = '';
  private building: THREE.Group | null = null;
  private buildingKey = '';
  private readonly exteriorPreviewPositions = new Map<THREE.Object3D, number>();
  private rooftop: THREE.Group | null = null;
  private rooftopKey = '';
  private landings: THREE.Group | null = null;
  private landingKey = '';
  private lowerFloors: THREE.Group | null = null;
  private lowerFloorKey = '';
  private readonly handles = makeBuildHandles();
  private readonly painter = new FloorPainter();
  private readonly objectResize = new ObjectResizeTools();
  private resizeHover: { item?: ShopItem; wallItem?: WallItem; valid: boolean } | null = null;
  private gesture: Gesture | null = null;
  private transient: Dimensions | null = null;
  private transientWallItems: WallItem[] | null = null;
  private itemDragFrame: THREE.Group | null = null;
  private itemDragFrameValid: boolean | null = null;
  private doorTarget = 0;
  private readonly rooftopDoorTargets = new Map<THREE.Object3D, number>();
  private lastFrameTime = 0;
  private lastShadowRefresh = 0;
  private interactionMessage: string | null = null;
  private grid: THREE.LineSegments | null = null;
  private selection: THREE.Group | null = null;
  private partitionPreview: THREE.Group | null = null;
  private partitionSelection: THREE.Box3Helper | null = null;
  private ghost: THREE.Group | null = null;
  private footprint: THREE.Group | null = null;
  private wallSelection: THREE.Group | null = null;
  private wallGhost: THREE.Group | null = null;
  private wallMountGuide: THREE.Group | null = null;
  private wallMountGuideKey = '';
  private wallFootprint: THREE.Group | null = null;
  private wallDragFrame: THREE.Group | null = null;
  private wallDragValid: boolean | null = null;
  private wallItemKey = '';
  private wallGhostKey = '';
  private wallFrameKey = '';
  private wallSelectionKey = '';
  private wallHoverKey = '';
  private windowPreviewKey = '';
  private windowPreviewLast = 0;
  private windowPreviewPending: WallItem[] | null = null;
  private roomKey = '';
  private itemKey = '';
  private ghostKey = '';
  private frameKey = '';
  private selectionKey = '';
  private hover: Cell | null = null;
  private activePointers = new Set<number>();
  private pointerStart: { x: number; y: number; id: number } | null = null;
  private suppressClick = false;
  private animation = 0;
  private disposed = false;
  private projectionDirty = true;
  private renderDirty = true;
  private view: CameraView = 'orbit';
  private height = 0;
  private width = 0;

  constructor(private host: HTMLElement, private callbacks: SceneCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    const canvas = this.renderer.domElement;
    canvas.dataset.renderer = 'webgl';
    canvas.dataset.ready = 'false';
    canvas.dataset.interaction = 'idle';
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    canvas.setAttribute('aria-label', 'Pratinjau toko 3D. Geser untuk memutar, cubit atau gulir untuk memperbesar.');
    canvas.setAttribute('role', 'img');
    this.host.appendChild(canvas);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: '#e8edf0', roughness: 1 });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), groundMaterial);
    this.lighting = new NightLighting(this.scene, this.renderer, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.401;
    this.ground.receiveShadow = true;
    this.itemPlatforms.name = 'standing-sign-foundations';
    this.itemPlatforms.count = 0;
    this.itemPlatforms.receiveShadow = true;
    this.itemPlatforms.frustumCulled = false;
    this.itemPlatforms.raycast = () => undefined;
    this.itemPlatforms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.backdrop.mesh, this.ground, this.items, this.wallItems, this.itemPlatforms, this.handles.group, this.painter.group, this.objectResize.group);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.095;
    this.controls.minZoom = 0.55;
    this.controls.maxZoom = 2.8;
    this.controls.minPolarAngle = 0.045;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.07;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.8;
    this.controls.addEventListener('change', this.cameraChanged);
    // Capture runs before OrbitControls, so a handle can claim the gesture before orbit begins.
    canvas.addEventListener('pointerdown', this.pointerDown, true);
    canvas.addEventListener('pointermove', this.pointerMove, true);
    canvas.addEventListener('pointerup', this.pointerUp, true);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    canvas.addEventListener('pointercancel', this.pointerCancel, true);
    canvas.addEventListener('lostpointercapture', this.lostPointerCapture);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    window.addEventListener('keydown', this.keyDown, true);
    window.addEventListener('blur', this.windowBlur);
    this.reducedMotion.addEventListener('change', this.motionChanged);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.host);
    this.resetCamera();
    this.resize();
    this.animate();
  }

  update(next: SceneState) {
    const firstShop = !this.state;
    const exteriorChanged = !!next.exteriorOnly !== !!this.state?.exteriorOnly;
    const levelChanged = next.activeLevel !== this.state?.activeLevel || !!next.rooftopOnly !== !!this.state?.rooftopOnly;
    const buildingDoc = next.building ?? next.shop;
    const previousBuildingBounds = this.state ? JSON.stringify(this.buildingMetrics()) : '';
    const previousFloorY = this.activeFloorY();
    if (this.gesture && (exteriorChanged || levelChanged || getLevelCount(buildingDoc) !== getLevelCount(this.state!.building ?? this.state!.shop))) this.cancelGesture();
    // Facade editing shares the arrange/build modes; construction from outside
    // edits wall height and the entrance without exposing interior floor tools.
    if (next.exteriorOnly) {
      const groundLevel = (next.activeLevel ?? 0) === 0;
      const selected = next.shop.items.find(item => item.id === next.selectedId);
      next = { ...next, placement: groundLevel && next.placement && isStandingSign(next.placement.kind) ? next.placement : null,
        selectedId: groundLevel && selected && isStandingSign(selected.kind) ? selected.id : null,
        selectedDoor: next.selectedDoor && groundLevel, selectedPartitionId: null, buildTool: 'walls' };
    }
    if (next.rooftopOnly) next = { ...next, editMode: 'arrange', wallPlacement: null, selectedWallId: null, selectedDoor: false, selectedPartitionId: null };
    if (this.gesture && (next.shop !== this.state?.shop || next.editMode !== this.state?.editMode || next.buildTool !== this.state?.buildTool || next.preview !== this.state?.preview || next.placement !== this.state?.placement || next.wallPlacement !== this.state?.wallPlacement || next.showWalls !== this.state?.showWalls || next.showAllWalls !== this.state?.showAllWalls || next.resizeMode !== this.state?.resizeMode || next.selectedId !== this.state?.selectedId || next.selectedWallId !== this.state?.selectedWallId)) this.cancelGesture();
    this.resizeHover = null;
    this.itemSupportCache.clear();
    this.state = next;
    this.renderDirty = true;
    const { shop } = next;
    const activeLevel = next.activeLevel ?? 0;
    // Keep editor gestures in floor-local coordinates. The neighbourhood and
    // lower levels move down by the selected floor's real building elevation.
    const floorY = next.exteriorOnly ? 0 : getLevelBaseY(buildingDoc, activeLevel);
    this.ground.position.y = -0.401 - floorY;
    this.backdrop.configureGround(this.ground);
    const stairOpenings = getStairOpenings(buildingDoc, activeLevel);
    const nextRooftopKey = JSON.stringify([shop.width, shop.depth, shop.floorCells, shop.floorColor, getExterior(buildingDoc), this.roofGeometry(buildingDoc), stairOpenings]);
    if (next.rooftopOnly && nextRooftopKey !== this.rooftopKey) {
      if (this.rooftop) disposeGroup(this.rooftop);
      this.rooftop = buildRooftopStructure(buildingDoc);
      this.scene.add(this.rooftop);
      this.rooftopKey = nextRooftopKey;
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.rooftop) this.rooftop.visible = !!next.rooftopOnly && !next.exteriorOnly;
    let lightingContentChanged = exteriorChanged;
    this.lighting.setMode(next.nightMode ?? false, firstShop || this.reducedMotion.matches);
    const nextRoomKey = JSON.stringify([next.exteriorOnly, getExterior(buildingDoc), shop.width, shop.depth, shop.floorCells, this.windowKey(getWallItems(shop)), getWallHeight(shop), getEntrance(shop).position, getEntranceWall(shop), getEntranceRotation(shop), getExterior(shop).awning, shop.floorColor, shop.wallColor, shop.name, activeLevel, stairOpenings, getPartitions(shop), getInteriorDoors(shop)]);
    if (nextRoomKey !== this.roomKey) {
      const previousDoorAngle = this.builtRoom?.doorPivot.rotation.y;
      if (this.room) disposeGroup(this.room);
      const built = buildRoom(next.exteriorOnly ? { ...shop, wallColor: getExterior(buildingDoc).wallColor, exterior: getExterior(buildingDoc) } : shop, { enclosed: next.exteriorOnly, slabDepth: activeLevel > 0 ? LEVEL_SLAB : undefined, floorOpenings: stairOpenings, hasEntrance: activeLevel === 0 });
      this.builtRoom = built;
      this.room = built.group;
      this.room.position.y = this.wallEditY();
      if (next.exteriorOnly) applyExteriorWallMaterial(built.walls, getExterior(buildingDoc));
      built.doorPivot.rotation.y = previousDoorAngle ?? (getEntrance(shop).open ? -Math.PI / 2 : 0);
      this.scene.add(this.room);
      this.roomKey = nextRoomKey;
      this.windowPreviewKey = this.windowKey(getWallItems(shop));
      this.renderer.domElement.dataset.windowOpenings = this.windowPreviewKey;
      this.windowPreviewPending = null;
      this.renderer.shadowMap.needsUpdate = true;
      this.rebuildGrid();
      this.projectionDirty = true;
    }
    this.doorTarget = getEntrance(shop).open ? -Math.PI / 2 : 0;
    if (this.builtRoom) this.builtRoom.entrance.visible = this.builtRoom.hasFloor && (next.activeLevel ?? 0) === 0;
    if ((next.activeLevel ?? 0) === 0) {
      this.renderer.domElement.dataset.doorAngle = String(this.builtRoom?.doorPivot.rotation.y ?? 0);
      this.renderer.domElement.dataset.doorRotation = String(getEntranceRotation(shop));
    } else {
      delete this.renderer.domElement.dataset.doorAngle;
      delete this.renderer.domElement.dataset.doorRotation;
    }
    const cityShop = buildingDoc;
    const nextCityKey = JSON.stringify([cityShop.width, cityShop.depth, cityShop.floorCells]);
    const cityChanged = this.cityKey !== nextCityKey;
    if (cityChanged) {
      lightingContentChanged = true;
      if (this.city) disposeGroup(this.city);
      this.city = buildCity(cityShop);
      this.scene.add(this.city);
      this.cityKey = nextCityKey;
    }
    if (this.city) {
      this.city.visible = next.showCity ?? true;
      this.city.position.y = -floorY;
      setCityTimeOfDay(this.city, next.nightMode ?? false, cityChanged || this.reducedMotion.matches);
      this.updatePedestrianMetadata();
    }
    const nextItemKey = JSON.stringify([getRoof(buildingDoc).style, getLevelCount(buildingDoc), activeLevel, shop.width, shop.depth, shop.floorCells, getWallHeight(shop), next.showCity, next.showWalls, getEntrance(shop).position, getEntranceWall(shop), getEntranceRotation(shop), shop.items]);
    if (nextItemKey !== this.itemKey) {
      lightingContentChanged = true;
      while (this.items.children.length) disposeGroup(this.items.children[0]);
      shop.items.forEach((item) => {
        const group = buildItem(item, getStairRise(buildingDoc, Math.min(activeLevel, getLevelCount(buildingDoc) - 1)));
        this.positionItem(group, item);
        this.items.add(group);
      });
      this.itemKey = nextItemKey;
      this.renderer.shadowMap.needsUpdate = true;
    }
    const nextWallItemKey = JSON.stringify([next.exteriorOnly, activeLevel, shop.width, shop.depth, getWallItems(shop)]);
    if (nextWallItemKey !== this.wallItemKey) {
      lightingContentChanged = true;
      while (this.wallItems.children.length) disposeGroup(this.wallItems.children[0]);
      getWallItems(shop).filter(item => item.kind === 'window' || getWallItemMount(item) === (next.exteriorOnly ? 'exterior' : 'interior')).forEach((item) => {
        const group = buildWallItem(item, shop);
        this.positionWallItem(group, item);
        this.wallItems.add(group);
      });
      this.wallItemKey = nextWallItemKey;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.wallItems.visible = next.showWalls;
    this.wallItems.children.forEach((object) => { object.visible = object.userData.wallItemId !== next.wallPlacement?.id; });
    const nextBuildingKey = this.exteriorContextKey(buildingDoc, activeLevel, next.showCity);
    if (next.exteriorOnly && this.buildingKey !== nextBuildingKey) {
      if (this.building) disposeGroup(this.building);
      this.building = buildBuilding(buildingDoc, { showCity: next.showCity ?? true });
      this.scene.add(this.building);
      this.buildingKey = nextBuildingKey;
      lightingContentChanged = true;
      this.renderer.shadowMap.needsUpdate = true;
    }
    const nextLandingKey = JSON.stringify([activeLevel, next.rooftopOnly, shop.width, shop.depth, shop.floorCells, shop.floorColor, stairOpenings, shop.items.filter(item => item.kind === 'stairs')]);
    if (this.landingKey !== nextLandingKey) {
      if (this.landings) disposeGroup(this.landings);
      this.landings = next.rooftopOnly ? new THREE.Group() : buildStairLandings(buildingDoc, next.activeLevel ?? 0);
      this.scene.add(this.landings);
      this.landingKey = nextLandingKey;
    }
    const lowerDocuments = Array.from({ length: activeLevel }, (_, index) => {
      const { upperFloors: _upper, roof: _roof, rooftop: _rooftop, exterior: _exterior, ...floor } = getLevelDocument(buildingDoc, index);
      return floor;
    });
    const nextLowerFloorKey = JSON.stringify([activeLevel, lowerDocuments, next.showCity]);
    if (!next.exteriorOnly && this.lowerFloorKey !== nextLowerFloorKey) {
      if (this.lowerFloors) disposeGroup(this.lowerFloors);
      this.lowerFloors = buildInteriorContext(buildingDoc, activeLevel, { showCity: next.showCity ?? true });
      this.lowerFloors.position.y = -floorY;
      this.scene.add(this.lowerFloors);
      this.lowerFloorKey = nextLowerFloorKey;
    }
    if (this.lowerFloors) this.lowerFloors.visible = !next.exteriorOnly && activeLevel > 0;
    if (this.building) this.building.visible = !!next.exteriorOnly;
    if (this.landings) this.landings.visible = !next.exteriorOnly;
    if (this.room) { this.room.visible = !next.rooftopOnly; this.room.position.y = this.wallEditY(); }
    this.items.visible = !next.exteriorOnly || activeLevel === 0;
    this.items.children.forEach(object => {
      const item = shop.items.find(candidate => candidate.id === object.userData.itemId);
      object.visible = !next.exteriorOnly || (!!item && isStandingSign(item.kind));
    });
    this.itemPlatforms.visible = !next.exteriorOnly || activeLevel === 0;
    this.wallItems.visible = next.showWalls && !next.rooftopOnly;
    this.syncExteriorEditor();
    if (firstShop || exteriorChanged || (levelChanged && !next.exteriorOnly) || previousFloorY !== floorY || (next.exteriorOnly && previousBuildingBounds !== JSON.stringify(this.buildingMetrics()))) {
      this.resize();
      this.setView(this.view);
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.updateBoundaryVisibility();
    if (this.grid) this.grid.visible = next.showGrid && !next.preview && !next.exteriorOnly;
    if (next.preview && this.hover) this.setHover(null);
    this.updateSelection();
    this.updatePlacement();
    this.updateWallSelection();
    this.updateWallPlacement();
    this.updateHandles();
    this.updatePainter();
    this.updatePartitionSelection();
    this.updateObjectResize();
    this.updatePreviewMetadata();
    this.clocks = [];
    this.rooftopDoorTargets.clear();
    this.scene.traverse(object => {
      if (object.userData.gameClock) this.clocks.push(object);
      if (typeof object.userData.rooftopDoorId === 'string') {
        const target = getRooftopDoorOpen(buildingDoc, object.userData.rooftopDoorId) ? ROOFTOP_DOOR_OPEN_ANGLE : 0;
        this.rooftopDoorTargets.set(object, target);
        if (this.reducedMotion.matches && object.rotation.y !== target) {
          object.rotation.y = target;
          this.renderer.shadowMap.needsUpdate = true;
        }
      }
    });
    this.setGameTime(this.gameMinutes);
    if (lightingContentChanged) this.lighting.refreshSources([this.items, this.wallItems, this.city, this.building]);
    this.lighting.update(0, true);
    this.updateLightingMetadata();
    this.projectionDirty = true;
    this.renderer.domElement.style.cursor = next.preview ? 'grab' : next.placement || next.wallPlacement ? 'crosshair' : 'grab';
  }

  setGameTime(minutes: number) {
    this.gameMinutes = minutes;
    this.clocks.forEach(clock => setWallClockTime(clock, minutes));
    this.renderer.domElement.dataset.gameMinutes = String(minutes);
    this.renderer.domElement.dataset.clockHands = JSON.stringify(this.clocks.map(clock => ({
      id: clock.userData.wallItemId,
      hour: clock.getObjectByName('game-clock-hour')?.rotation.z,
      minute: clock.getObjectByName('game-clock-minute')?.rotation.z,
    })));
    if (this.clocks.length) this.renderDirty = true;
  }

  private wallEditY() {
    return this.state?.exteriorOnly ? getLevelBaseY(this.state.building ?? this.state.shop, this.state.activeLevel ?? 0) : 0;
  }

  private wallEditRay() {
    const ray = this.raycaster.ray.clone();
    ray.origin.y -= this.wallEditY();
    return ray;
  }

  private syncExteriorEditor() {
    if (!this.state?.exteriorOnly || !this.building) return;
    this.building.children.forEach(floor => {
      if (typeof floor.userData.level !== 'number') return;
      const editing = floor.userData.level === (this.state!.activeLevel ?? 0);
      const signs = floor.userData.level === 0 ? getLevelDocument(this.state!.building ?? this.state!.shop, 0).items.filter(item => isStandingSign(item.kind)) : [];
      floor.children.forEach(child => {
        if (child.name === 'exterior-room' || child.userData.wallItemId) child.visible = !editing;
        if (signs.some(item => item.id === child.userData.itemId) || child.name === 'standing-sign-foundation') child.visible = !editing;
      });
    });
  }

  private exteriorContextKey(building: ShopDocument, activeLevel: number, showCity?: boolean) {
    // The active facade/entrance and ground-floor signs have editable copies.
    // Their hidden building copies can stay cached while ordinary edits commit.
    // Including the active level guarantees a fresh context before those copies
    // become visible again when the user selects a different storey.
    const levels = Array.from({ length: getLevelCount(building) }, (_, level) => {
      const floor = getLevelDocument(building, level), editing = level === activeLevel;
      return [floor.name, floor.width, floor.depth, floor.floorColor, floor.wallColor,
        getWallHeight(floor), getFloorCells(floor), getPartitions(floor), getInteriorDoors(floor),
        editing ? null : getWallItems(floor), editing ? null : getEntrance(floor),
        editing && level === 0 ? floor.items.filter(item => !isStandingSign(item.kind)) : floor.items];
    });
    return JSON.stringify([activeLevel, levels, getExterior(building), this.roofGeometry(building), building.rooftop, showCity]);
  }

  private roofGeometry(building: ShopDocument) {
    const { stairDoors: _doors, ...roof } = getRoof(building);
    return roof;
  }

  private previewExteriorHeight(height: number) {
    if (!this.state?.exteriorOnly || !this.building) return;
    const level = this.state.activeLevel ?? 0;
    const delta = height - getWallHeight(this.state.shop);
    for (const child of this.building.children) {
      if (!(typeof child.userData.level === 'number' ? child.userData.level > level : child.userData.roofStyle)) continue;
      if (!this.exteriorPreviewPositions.has(child)) this.exteriorPreviewPositions.set(child, child.position.y);
      child.position.y = this.exteriorPreviewPositions.get(child)! + delta;
    }
  }

  private isObjectVisible(object: THREE.Object3D) {
    let current: THREE.Object3D | null = object;
    while (current) { if (!current.visible) return false; current = current.parent; }
    return true;
  }

  private updateBoundaryVisibility() {
    if (!this.state || !this.builtRoom) return;
    const { walls, backWall, leftWall, frontWall, rightWall } = this.builtRoom;
    const painting = this.gesture?.kind === 'paint';
    const visible = [
      [walls, this.state.showWalls],
      [backWall, !painting], [leftWall, !painting],
      [frontWall, !painting && (!!this.state.showAllWalls || !!this.state.exteriorOnly)],
      [rightWall, !painting && (!!this.state.showAllWalls || !!this.state.exteriorOnly)],
    ] as const;
    for (const [object, show] of visible) {
      if (object.visible === show) continue;
      object.visible = show;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  private positionItem(group: THREE.Group, item: ShopItem) {
    if (!this.state) return;
    const footprint = getItemFootprint(item);
    applyItemSize(group, item);
    group.position.set(item.x - this.state.shop.width / 2 + footprint.width / 2, this.itemBaseY(item), item.z - this.state.shop.depth / 2 + footprint.depth / 2);
    group.rotation.y = -THREE.MathUtils.degToRad(item.rotation);
  }

  private itemBaseY(item: ShopItem, shop = this.state!.shop) {
    return this.itemSupport(item, shop).baseY;
  }

  private itemSupport(item: ShopItem, shop = this.state!.shop) {
    if ((this.state?.activeLevel ?? 0) > 0) return { baseY: 0.038 };
    if (!this.builtRoom) return { baseY: 0.038 };
    const key = JSON.stringify([item.kind, item.x, item.z, item.rotation, item.width, item.depth, shop.width, shop.depth, this.state?.showCity, this.state?.showWalls, this.transient?.entrancePosition]);
    const cached = this.itemSupportCache.get(key);
    if (cached) return cached;
    const support = getItemSupport(shop, item, this.builtRoom.floor, this.state?.showWalls && (this.state.activeLevel ?? 0) === 0 ? this.builtRoom.entrance : undefined, this.state?.showCity ?? true);
    if (this.itemSupportCache.size > 256) this.itemSupportCache.clear();
    this.itemSupportCache.set(key, support);
    return support;
  }

  private updateItemPlatforms() {
    if (!this.state) return;
    const dimensions = this.transient;
    const shop = dimensions ? { ...this.state.shop, width: dimensions.width, depth: dimensions.depth } : this.state.shop;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    let count = 0;
    for (const source of shop.items) {
      const item = this.gesture?.candidate?.id === source.id ? this.gesture.candidate : source;
      if (!isStandingSign(item.kind) || this.state.placement?.id === item.id) continue;
      const support = this.itemSupport(item, shop).foundation;
      if (!support) continue;
      matrix.compose(new THREE.Vector3(support.x, (support.top + support.bottom) / 2, support.z), rotation, new THREE.Vector3(support.width, support.top - support.bottom, support.depth));
      this.itemPlatforms.setMatrixAt(count++, matrix);
    }
    this.itemPlatforms.count = count;
    this.itemPlatforms.instanceMatrix.needsUpdate = true;
  }

  private signGroundY(x: number, z: number, shop = this.state!.shop) {
    if ((this.state?.activeLevel ?? 0) > 0) return 0.036;
    const showCity = this.state?.showCity ?? true;
    if (!this.builtRoom) return showCity ? -0.08 : -0.401;
    return standingSignGroundY(this.builtRoom.floor, this.state?.showWalls && (this.state.activeLevel ?? 0) === 0 ? this.builtRoom.entrance : undefined, x - shop.width / 2 + 0.5, z - shop.depth / 2 + 0.5, showCity);
  }

  private itemFrameY(item: ShopItem) { return this.itemBaseY(item) - 0.038; }

  private positionWallItem(group: THREE.Object3D, item: WallItem, shop = this.state!.shop) {
    applyWallItemSize(group, item);
    const point = wallItemPosition(shop, item);
    group.position.set(point.x, point.y + this.wallEditY(), point.z);
    group.rotation.y = point.rotation;
  }

  private wallSize(item: WallItem) {
    return getWallItemSize(item);
  }

  private validWallCandidate(shop: ShopDocument, candidate: WallItem, ignoreId?: string) {
    const snapped = { ...candidate, offset: Math.round(candidate.offset * 10) / 10, height: Math.round(candidate.height * 10) / 10 };
    return canPlaceWallItem(shop, candidate, ignoreId) && canPlaceWallItem(shop, snapped, ignoreId);
  }

  private updateWallSelection() {
    if (!this.state) return;
    const item = !this.state.preview && this.state.showWalls && !this.state.placement && !this.state.wallPlacement && !this.gesture ? getWallItems(this.state.shop).find((entry) => entry.id === this.state?.selectedWallId) : undefined;
    const key = item ? JSON.stringify([item, this.state.shop.width, this.state.shop.depth, this.wallEditY(), this.state.exteriorOnly]) : '';
    if (key === this.wallSelectionKey) return;
    this.wallSelectionKey = key;
    if (this.wallSelection) disposeGroup(this.wallSelection);
    this.wallSelection = null;
    if (item) {
      const size = this.wallSize(item);
      this.wallSelection = wallFrame(size.width, size.height, '#7850b8');
      this.positionWallItem(this.wallSelection, item);
      this.scene.add(this.wallSelection);
    }
  }

  private updateWallPlacement() {
    if (!this.state) return;
    const candidate = !this.state.preview && this.state.showWalls && getFloorCells(this.state.shop).length > 0 ? this.state.wallPlacement : null;
    this.updateWallMountGuide(candidate ? this.state.wallPlacementMount : null);
    this.renderer.domElement.dataset.wallPlacement = JSON.stringify(candidate);
    this.renderer.domElement.dataset.wallPlacementMount = JSON.stringify(candidate ? this.state.wallPlacementMount ?? null : null);
    if (!candidate) {
      if (this.wallGhost) disposeGroup(this.wallGhost);
      if (this.wallFootprint) disposeGroup(this.wallFootprint);
      this.wallGhost = this.wallFootprint = null;
      this.wallGhostKey = this.wallFrameKey = '';
      delete this.renderer.domElement.dataset.wallPlacementValid;
      if (this.gesture?.kind !== 'wall-item' && this.gesture?.kind !== 'object-resize') this.previewWindow(null);
      return;
    }
    const ignore = getWallItems(this.state.shop).some((item) => item.id === candidate.id) ? candidate.id : undefined;
    const valid = this.validWallCandidate(this.state.shop, candidate, ignore);
    const key = JSON.stringify([candidate.kind, candidate.color, candidate.text, candidate.lit, candidate.width, candidate.sizeHeight, candidate.windowStyle, candidate.mount, candidate.wallLampStyle, candidate.wallSignStyle]);
    if (key !== this.wallGhostKey || !this.wallGhost) {
      if (this.wallGhost) disposeGroup(this.wallGhost);
      this.wallGhost = buildWallItem(candidate, this.state.shop);
      this.wallGhost.traverse((object) => {
        object.raycast = () => undefined;
        if (object instanceof THREE.Mesh) {
          object.castShadow = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => { material.transparent = true; material.opacity = 0.52; material.depthWrite = false; if (this.state?.exteriorOnly) material.depthTest = false; });
        }
        if (object instanceof THREE.Light) object.visible = false;
      });
      this.scene.add(this.wallGhost);
      this.wallGhostKey = key;
    }
    this.positionWallItem(this.wallGhost, candidate);
    const size = this.wallSize(candidate);
    const frameKey = `${size.width}/${size.height}/${valid}`;
    if (frameKey !== this.wallFrameKey || !this.wallFootprint) {
      if (this.wallFootprint) disposeGroup(this.wallFootprint);
      this.wallFootprint = wallFrame(size.width, size.height, valid ? '#668c68' : '#c76269', true);
      this.scene.add(this.wallFootprint);
      this.wallFrameKey = frameKey;
    }
    this.positionWallItem(this.wallFootprint, candidate);
    this.renderer.domElement.dataset.wallPlacementValid = String(valid);
    this.previewWindow(valid && candidate.kind === 'window' ? candidate : null);
    this.renderDirty = true;
  }

  private windowKey(items: WallItem[]) {
    return JSON.stringify(items.filter((item) => item.kind === 'window').map(({ id, wall, line, offset, height, width, sizeHeight, windowStyle }) => ({ id, wall, line, offset, height, width, sizeHeight, windowStyle: windowStyle ?? 'classic' })));
  }

  private previewWindow(candidate: WallItem | null, immediate = false) {
    if (!this.state || !this.builtRoom) return;
    let items = getWallItems(this.state.shop);
    if (candidate?.kind === 'window') {
      const snapped = { ...candidate, offset: Math.round(candidate.offset * 10) / 10, height: Math.round(candidate.height * 10) / 10 };
      const ignore = items.some((item) => item.id === snapped.id) ? snapped.id : undefined;
      if (this.validWallCandidate(this.state.shop, candidate, ignore)) items = [...items.filter((item) => item.id !== snapped.id), snapped];
    }
    this.queueWindowItems(items, immediate);
  }

  private queueWindowItems(items: WallItem[], immediate = false) {
    if (this.windowKey(items) === this.windowPreviewKey) { this.windowPreviewPending = null; return; }
    this.windowPreviewPending = items;
    this.flushWindowPreview(immediate);
  }

  private flushWindowPreview(immediate = false) {
    if (!this.windowPreviewPending || !this.builtRoom || (!immediate && performance.now() - this.windowPreviewLast < 60)) return;
    const items = this.windowPreviewPending;
    this.windowPreviewPending = null;
    this.builtRoom.previewWallItems(items);
    if (this.state?.exteriorOnly) applyExteriorWallMaterial(this.builtRoom.walls, getExterior(this.state.building ?? this.state.shop));
    this.updateBoundaryVisibility();
    this.windowPreviewKey = this.windowKey(items);
    this.windowPreviewLast = performance.now();
    this.renderer.domElement.dataset.windowOpenings = this.windowPreviewKey;
    this.renderer.shadowMap.needsUpdate = true;
    this.projectionDirty = true;
    this.renderDirty = true;
  }

  private wallCandidateAt(event: PointerEvent, source: WallItem, fallback = false) {
    if (!this.state?.showWalls) return null;
    this.prepareRay(event);
    if (!fallback && this.state.wallPlacement && this.state.wallPlacementMount) {
      const hit = intersectWallPlane(this.wallEditRay(), this.state.shop, this.state.wallPlacementMount);
      return this.wallCandidateFromHit(source, hit);
    }
    const hit = intersectWall(this.wallEditRay(), this.state.shop, fallback ? source : undefined, this.state.exteriorOnly, source);
    return this.wallCandidateFromHit(source, hit);
  }

  private wallCandidateFromHit(source: WallItem, hit: WallHit | null) {
    if (!hit) return null;
    const candidate = { ...source, wall: hit.wall, line: hit.line, offset: hit.offset, height: hit.height };
    if (hit.partitionId) candidate.partitionId = hit.partitionId;
    else delete candidate.partitionId;
    return candidate;
  }

  private setWallHover(candidate: WallItem | null) {
    const key = candidate ? JSON.stringify(candidate) : '';
    if (key === this.wallHoverKey) return;
    this.wallHoverKey = key;
    this.callbacks.onWallHover(candidate);
  }

  private rebuildGrid() {
    if (this.grid) disposeGroup(this.grid);
    this.grid = null;
    if (!this.state) return;
    const { width, depth } = this.state.shop;
    const points: THREE.Vector3[] = [];
    const edges = new Set<string>();
    getFloorCells(this.state.shop).forEach(({ x, z }) => {
      for (const [a, b, c, d] of [[x, z, x + 1, z], [x, z, x, z + 1], [x + 1, z, x + 1, z + 1], [x, z + 1, x + 1, z + 1]]) {
        const key = `${a},${b},${c},${d}`;
        if (edges.has(key)) continue;
        edges.add(key);
        points.push(new THREE.Vector3(a - width / 2, 0.031, b - depth / 2), new THREE.Vector3(c - width / 2, 0.031, d - depth / 2));
      }
    });
    if (!points.length) return;
    this.grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#9b8daa', transparent: true, opacity: 0.35, depthWrite: false }));
    this.scene.add(this.grid);
  }

  private updateSelection() {
    if (!this.state) return;
    const item = !this.state.preview && !this.state.placement && !this.state.wallPlacement && this.state.editMode !== 'build' && !this.gesture ? this.state.shop.items.find((entry) => entry.id === this.state?.selectedId) : undefined;
    const key = item ? JSON.stringify([item.id, item.x, item.z, item.rotation, item.kind, item.width, item.depth, this.state.shop.width, this.state.shop.depth, this.itemBaseY(item)]) : '';
    if (key === this.selectionKey) return;
    this.selectionKey = key;
    if (this.selection) disposeGroup(this.selection);
    this.selection = null;
    if (item) {
      const size = getItemFootprint(item);
      this.selection = frame(size.width, size.depth, '#7850b8');
      this.selection.position.set(item.x - this.state.shop.width / 2 + size.width / 2, this.itemFrameY(item), item.z - this.state.shop.depth / 2 + size.depth / 2);
      this.scene.add(this.selection);
    }
  }

  private updatePlacement() {
    if (!this.state) return;
    this.renderDirty = true;
    const placement = this.state.preview || getFloorCells(this.state.shop).length === 0 ? null : this.state.placement;
    if (!placement) {
      if (this.ghost) disposeGroup(this.ghost);
      if (this.footprint) disposeGroup(this.footprint);
      this.ghost = null;
      this.footprint = null;
      this.ghostKey = '';
      this.frameKey = '';
      delete this.renderer.domElement.dataset.placementValid;
      return;
    }
    // App owns the candidate, including explicit coordinates chosen in the inspector.
    const candidate = placement;
    const existingId = this.state.shop.items.some((item) => item.id === candidate.id) ? candidate.id : undefined;
    const valid = this.canPlaceItem(this.state.shop, candidate, existingId);
    const key = JSON.stringify([candidate.kind, candidate.color, candidate.stock, candidate.width, candidate.depth, getWallHeight(this.state.shop), getRoof(this.state.building ?? this.state.shop).style]);
    if (key !== this.ghostKey || !this.ghost) {
      if (this.ghost) disposeGroup(this.ghost);
      this.ghost = buildItem(candidate, getStairRise(this.state.building ?? this.state.shop, Math.min(this.state.activeLevel ?? 0, getLevelCount(this.state.building ?? this.state.shop) - 1)));
      this.ghost.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((m) => { m.transparent = true; m.opacity = 0.48; m.depthWrite = false; });
        }
        if (object instanceof THREE.Light) object.visible = false;
      });
      this.scene.add(this.ghost);
      this.ghostKey = key;
    }
    this.positionItem(this.ghost, candidate);
    const size = getItemFootprint(candidate);
    const nextFrameKey = `${size.width}/${size.depth}/${valid}`;
    if (nextFrameKey !== this.frameKey || !this.footprint) {
      if (this.footprint) disposeGroup(this.footprint);
      this.footprint = frame(size.width, size.depth, valid ? '#668c68' : '#c76269', true);
      this.scene.add(this.footprint);
      this.frameKey = nextFrameKey;
    }
    this.footprint.position.set(candidate.x - this.state.shop.width / 2 + size.width / 2, this.itemFrameY(candidate), candidate.z - this.state.shop.depth / 2 + size.depth / 2);
    this.renderer.domElement.dataset.placementValid = String(valid);
  }

  private dimensions(shop = this.state!.shop): Dimensions {
    return { width: shop.width, depth: shop.depth, wallHeight: getWallHeight(shop), entrancePosition: getEntrance(shop).position };
  }

  private updateHandles() {
    if (!this.state) return;
    const dimensions = this.transient ?? this.dimensions();
    const shop = this.state.shop;
    const anchor = shop.floorCells
      ? getEntranceAnchor({ ...shop, entrance: { ...getEntrance(shop), position: dimensions.entrancePosition } })
      : { x: -dimensions.width / 2 + 1.1 + dimensions.entrancePosition * (dimensions.width - 2.2), z: dimensions.depth / 2 + 0.09 };
    const scale = (this.camera.top - this.camera.bottom) / Math.max(1, this.height) / this.camera.zoom * 72;
    positionBuildHandles(this.handles.entries, dimensions, this.camera, scale, anchor.x);
    const wallMode = this.state.editMode === 'build' && this.state.buildTool === 'walls';
    const doorMode = (this.state.selectedDoor && this.state.editMode !== 'build') || this.gesture?.kind === 'door';
    this.handles.group.visible = getFloorCells(this.gesture?.draft ?? shop).length > 0 && (wallMode || doorMode) && !this.state.preview && !this.state.placement && !this.state.wallPlacement;
    for (const entry of this.handles.entries) {
      entry.object.visible = (wallMode || entry.id === 'door') && (!shop.floorCells || ['walltop', 'door'].includes(entry.id)) && (!['left', 'back', 'walltop', 'door'].includes(entry.id) || this.state.showWalls);
      if (this.state.exteriorOnly && !['walltop', 'door'].includes(entry.id)) entry.object.visible = false;
      if (entry.id === 'door' && (this.state.activeLevel ?? 0) > 0) entry.object.visible = false;
      if (entry.id === 'door' && this.builtRoom) {
        entry.axis = wallIsHorizontal(getEntranceWall(shop)) ? 'x' : 'z';
        const entrance = this.builtRoom.entrance;
        entrance.updateWorldMatrix(true, false);
        entry.object.position.copy(entrance.localToWorld(new THREE.Vector3(0, 1.1, 0.13)));
      }
      if (entry.id === 'walltop' && shop.floorCells) {
        const back = floorOutline(getFloorCells(shop)).filter((edge) => edge.side === 'back').sort((a, b) => a.z1 - b.z1 || a.x1 - b.x1)[0];
        if (back) entry.object.position.set((back.x1 + back.x2) / 2 - shop.width / 2, dimensions.wallHeight + 0.14, back.z1 - shop.depth / 2);
      }
      // Door handles above already use the entrance's world position.
      if (entry.id !== 'door') entry.object.position.y += this.wallEditY();
    }
    this.renderDirty = true;
  }

  private resizeSelection() {
    const state = this.state;
    if (!state?.resizeMode || state.preview || state.editMode === 'build' || state.placement || state.wallPlacement || getFloorCells(state.shop).length === 0) return null;
    const item = state.shop.items.find(item => item.id === state.selectedId);
    const wallItem = state.showWalls ? getWallItems(state.shop).find(item => item.id === state.selectedWallId) : undefined;
    return item || wallItem ? { item, wallItem } : null;
  }

  private updateObjectResize() {
    const selected = this.resizeSelection();
    this.objectResize.group.visible = !!selected;
    this.objectResize.group.position.y = this.wallEditY();
    if (!selected || !this.state) return;
    const drag = this.gesture?.kind === 'object-resize' ? this.gesture : null;
    const item = drag?.candidate ?? this.resizeHover?.item ?? selected.item;
    const wallItem = drag?.wallCandidate ?? this.resizeHover?.wallItem ?? selected.wallItem;
    const scale = (this.camera.top - this.camera.bottom) / Math.max(1, this.height) / this.camera.zoom * 78;
    const valid = drag?.valid ?? this.resizeHover?.valid ?? true;
    if (item) this.objectResize.floor(this.state.shop, item, this.camera, scale, valid, this.itemBaseY(item) + 0.07, drag?.candidate ?? selected.item, {
      key: JSON.stringify([this.state.showCity, this.state.showWalls, getEntrance(this.state.shop)]),
      height: (x, z) => hasFloorCell(this.state!.shop, x, z) ? 0.052 : this.signGroundY(x, z) + 0.008,
    });
    else if (wallItem) this.objectResize.wall(this.state.shop, wallItem, this.camera, scale, valid, drag?.wallCandidate ?? selected.wallItem);
  }

  private pickResizeEdge(event: PointerEvent): ResizeEdge | null {
    if (!this.objectResize.group.visible) return null;
    let edge: ResizeEdge | null = null;
    let distance = event.pointerType === 'touch' ? 25 : 19;
    for (const entry of this.objectResize.handles) {
      if (!entry.object.visible) continue;
      const point = this.project(entry.object.getWorldPosition(new THREE.Vector3()));
      const nextDistance = Math.hypot(event.clientX - point.clientX, event.clientY - point.clientY);
      if (nextDistance < distance) { edge = entry.edge; distance = nextDistance; }
    }
    return edge;
  }

  private resizeWallPoint(event: PointerEvent, item: WallItem) {
    if (!this.state) return null;
    this.prepareRay(event);
    const point = intersectWallPlane(this.wallEditRay(), this.state.shop, item);
    return point ? { along: point.offset, height: point.height } : null;
  }

  private resizeAt(event: PointerEvent) {
    const selected = this.resizeSelection();
    if (!selected || !this.state) return null;
    if (selected.item) {
      const cell = this.cellAt(event);
      if (!cell) return null;
      const item = resizeFloorToTile(selected.item, cell);
      return { item, valid: this.canPlaceItem(this.state.shop, item, item.id) };
    }
    if (selected.wallItem) {
      const point = this.resizeWallPoint(event, selected.wallItem);
      const run = getWallMountRuns(this.state.shop, selected.wallItem).find(run => run.wall === selected.wallItem!.wall && run.line === selected.wallItem!.line && run.partitionId === selected.wallItem!.partitionId && selected.wallItem!.offset >= run.start && selected.wallItem!.offset <= run.end);
      if (!point || !run || point.along < run.start || point.along >= run.end || point.height < 0 || point.height > getWallHeight(this.state.shop)) return null;
      const wallItem = resizeWallToTile(selected.wallItem, point.along, point.height);
      return { wallItem, valid: this.validWallCandidate(this.state.shop, wallItem, wallItem.id) };
    }
    return null;
  }

  private commitObjectResize(base: ShopDocument, candidate: { item?: ShopItem; wallItem?: WallItem; valid: boolean }) {
    if (!candidate.valid) { this.callbacks.onChange(base, 'Ukuran belum muat: ada barang lain atau melewati batas.'); return; }
    let next = base;
    if (candidate.item) {
      next = updateItem(base, candidate.item.id, candidate.item);
    } else if (candidate.wallItem) {
      next = updateWallItem(base, candidate.wallItem.id, candidate.wallItem);
    }
    if (next !== base) this.callbacks.onChange(next, 'Ukuran disimpan');
  }

  private beginObjectResize(event: PointerEvent, edge: ResizeEdge) {
    const selected = this.resizeSelection();
    if (!selected) return;
    this.resizeHover = null;
    this.beginGesture(event, 'object-resize', undefined, selected.item, selected.wallItem);
    if (!this.gesture) return;
    this.gesture.resizeEdge = edge;
    const grip = this.objectResize.handles.find(entry => entry.edge === edge);
    if (grip) {
      const point = this.project(grip.object.position);
      // Touch has a generous invisible drag target. A tap in its outer margin
      // still belongs to the visible tile underneath, not the grip itself.
      this.gesture.resizeTapFallback = Math.hypot(event.clientX - point.clientX, event.clientY - point.clientY) > 14;
    }
    if (selected.wallItem) this.gesture.resizeWallStart = this.resizeWallPoint(event, selected.wallItem) ?? undefined;
    this.setInteraction('Tarik ujungnya. Lepas untuk menyimpan ukuran.');
  }

  private dragObjectResize(event: PointerEvent, drag: Gesture) {
    if (!drag.resizeEdge) return;
    if (drag.item) {
      const point = this.floorPoint(event);
      if (!point) return;
      const size = getItemFootprint(drag.item);
      const horizontal = drag.resizeEdge.endsWith('x');
      const startEdge = horizontal ? drag.item.x + (drag.resizeEdge === 'max-x' ? size.width : 0) : drag.item.z + (drag.resizeEdge === 'max-z' ? size.depth : 0);
      const delta = horizontal ? point.x - drag.startPoint.x : point.z - drag.startPoint.z;
      drag.candidate = resizeFloorEdge(drag.item, drag.resizeEdge, startEdge + delta);
      drag.valid = this.canPlaceItem(drag.base, drag.candidate, drag.item.id);
      const object = this.items.children.find(object => object.userData.itemId === drag.item!.id);
      if (object) this.positionItem(object as THREE.Group, drag.candidate);
      this.renderer.domElement.dataset.previewItem = JSON.stringify({ ...drag.candidate, valid: drag.valid });
    } else if (drag.wallItem && drag.resizeWallStart) {
      const point = this.resizeWallPoint(event, drag.wallItem);
      if (!point) return;
      const size = getWallItemSize(drag.wallItem);
      const horizontal = drag.resizeEdge.endsWith('x');
      const startEdge = horizontal ? drag.wallItem.offset + (drag.resizeEdge === 'max-x' ? 1 : -1) * size.width / 2 : drag.wallItem.height + (drag.resizeEdge === 'max-y' ? 1 : -1) * size.height / 2;
      const delta = horizontal ? point.along - drag.resizeWallStart.along : point.height - drag.resizeWallStart.height;
      drag.wallCandidate = resizeWallEdge(drag.wallItem, drag.resizeEdge, startEdge + delta);
      drag.valid = this.validWallCandidate(drag.base, drag.wallCandidate, drag.wallItem.id);
      const object = this.wallItems.children.find(object => object.userData.wallItemId === drag.wallItem!.id);
      if (object) this.positionWallItem(object, drag.wallCandidate);
      if (drag.wallItem.kind === 'window') this.previewWindow(drag.valid ? drag.wallCandidate : null);
      this.renderer.domElement.dataset.previewWallItem = JSON.stringify({ ...drag.wallCandidate, valid: drag.valid });
    }
    const size = drag.candidate ? getItemFootprint(drag.candidate) : drag.wallCandidate ? getWallItemSize(drag.wallCandidate) : null;
    this.setInteraction(drag.valid && size ? `${size.width} × ${'depth' in size && drag.candidate ? size.depth : 'height' in size ? size.height : ''} ${drag.candidate ? 'petak' : 'm'}. Lepas untuk menyimpan.` : 'Belum muat. Lepas untuk mengembalikan ukuran sebelumnya.');
    this.updateObjectResize();
    this.projectionDirty = true;
    this.renderDirty = true;
    this.refreshDragShadows();
  }

  private updatePainter() {
    if (!this.state) return;
    const active = this.state.editMode === 'build' && ['add', 'erase'].includes(this.state.buildTool ?? 'add') && !this.state.preview && !this.state.placement && !this.state.wallPlacement;
    const draft = this.gesture?.draft ?? this.state.shop;
    this.painter.group.visible = active;
    this.painter.preview.visible = this.gesture?.kind === 'paint';
    if (active) {
      this.painter.updateWork(draft, this.state.buildTool === 'erase');
      if (this.painter.preview.visible) this.painter.updatePreview(draft, this.state.showWalls, this.state.showAllWalls);
      this.painter.hoverCell(draft, this.hover, this.state.buildTool === 'erase');
    }
    this.renderer.domElement.dataset.buildTool = this.state.buildTool ?? 'add';
    this.renderDirty = true;
  }

  private paintAt(cell: Cell) {
    const drag = this.gesture;
    if (!drag || drag.kind !== 'paint' || !drag.draft || !drag.paintOperation) return;
    const traversed = strokeCells(drag.lastCell ?? cell, cell).filter((point) => {
      const key = `${point.x},${point.z}`;
      if (drag.paintVisited?.has(key)) return false;
      drag.paintVisited?.add(key);
      return true;
    });
    drag.lastCell = cell;
    if (!traversed.length) return;
    const previous = drag.draft;
    drag.draft = paintFloor(previous, traversed, drag.paintOperation);
    drag.moved = drag.draft !== drag.base;
    this.hover = cell;
    this.updatePainter();
    if (this.builtRoom) {
      this.builtRoom.floor.visible = false;
      this.updateBoundaryVisibility();
      this.builtRoom.entrance.visible = this.builtRoom.hasFloor && getFloorCells(drag.draft).length > 0 && (this.state!.activeLevel ?? 0) === 0;
    }
    if (this.grid) this.grid.visible = false;
    const existed = hasFloorCell(previous, cell.x, cell.z);
    const requestedChange = drag.paintOperation === 'add' ? !existed : existed;
    const protectedTile = requestedChange && hasFloorCell(drag.draft, cell.x, cell.z) === existed;
    this.setInteraction(protectedTile ? 'Petak ini menjaga barang atau aksesori dinding. Bentuknya tetap aman.' : `${getFloorCells(drag.draft).length} ubin. ${drag.paintOperation === 'add' ? 'Sapu untuk menambah lantai.' : 'Sapu untuk menghapus lantai.'} Lepas untuk menyimpan.`);
    this.projectionDirty = true;
    this.renderDirty = true;
    this.refreshDragShadows();
  }

  private project(point: THREE.Vector3) {
    const projected = point.clone().project(this.camera);
    const canvasX = (projected.x + 1) * this.width / 2;
    const canvasY = (1 - projected.y) * this.height / 2;
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { canvasX, canvasY, clientX: rect.left + canvasX, clientY: rect.top + canvasY };
  }

  private pickHandle(event: PointerEvent): BuildHandleId | null {
    if (!this.handles.group.visible) return null;
    let nearest: BuildHandleId | null = null;
    let distance = event.pointerType === 'touch' ? 29 : 24;
    for (const entry of this.handles.entries) {
      if (!entry.object.visible) continue;
      const point = this.project(entry.object.getWorldPosition(new THREE.Vector3()));
      const candidateDistance = Math.hypot(event.clientX - point.clientX, event.clientY - point.clientY);
      if (candidateDistance < distance) { nearest = entry.id; distance = candidateDistance; }
    }
    return nearest;
  }

  private roomTarget(event: PointerEvent): WallSide | 'door' | null {
    if (!this.room || !this.state || getFloorCells(this.gesture?.draft ?? this.state.shop).length === 0) return null;
    if (this.state.exteriorOnly && (this.state.activeLevel ?? 0) !== 0) return null;
    this.prepareRay(event);
    const hits = this.raycaster.intersectObjects([...this.room.children, ...this.items.children, ...(this.state.exteriorOnly ? [this.wallItems, ...(this.building ? [this.building] : [])] : [])], true);
    for (const hit of hits) {
      let ancestor: THREE.Object3D | null = hit.object;
      let visible = true;
      while (ancestor) { if (!ancestor.visible) { visible = false; break; } ancestor = ancestor.parent; }
      if (!visible) continue;
      if (hit.object.userData.door && this.state?.showWalls) return 'door';
      if (hit.object.userData.wall && this.state?.showWalls && !this.state.exteriorOnly) return hit.object.userData.wall as WallSide;
      // Furniture and the floor occlude targets behind them, like the visible scene.
      if (hit.object instanceof THREE.Mesh) return null;
    }
    return null;
  }

  private floorPoint(event: PointerEvent) {
    this.prepareRay(event);
    return this.wallEditRay().intersectPlane(this.floorPlane, new THREE.Vector3());
  }

  private setInteraction(text: string | null) {
    if (text === this.interactionMessage) return;
    this.interactionMessage = text;
    this.callbacks.onInteraction?.(text);
  }

  private lockOrbit(locked: boolean) {
    if (locked) {
      const damping = this.controls.enableDamping;
      this.controls.enableDamping = false;
      this.controls.update();
      this.controls.enableDamping = damping;
    }
    // Keep Controls enabled so it still tracks the first touch; a second finger can take over.
    this.controls.enableRotate = !locked;
    this.controls.enablePan = !locked;
    this.controls.enableZoom = !locked;
  }

  private beginGesture(event: PointerEvent, kind: Gesture['kind'], handle?: BuildHandleId, item?: ShopItem, wallItem?: WallItem) {
    if (!this.state) return;
    const point = this.floorPoint(event);
    if (!point) return;
    const base = this.state.shop;
    const wallPoint = wallItem ? this.wallCandidateAt(event, wallItem, true) : null;
    this.gesture = {
      kind, pointerId: event.pointerId, handle, base, startClient: new THREE.Vector2(event.clientX, event.clientY),
      startPoint: point, dimensions: this.dimensions(base), item, candidate: item, valid: true, moved: false,
      itemPosition: item ? this.items.children.find((object) => object.userData.itemId === item.id)?.position.clone() : undefined,
      draft: kind === 'paint' ? base : undefined,
      paintOperation: kind === 'paint' ? (this.state.buildTool === 'erase' ? 'erase' : 'add') : undefined,
      paintVisited: kind === 'paint' ? new Set<string>() : undefined,
      wallItem, wallCandidate: wallItem,
      partitionCandidate: kind === 'partition' ? { id: `partition-${crypto.randomUUID()}`, axis: 'x', line: Math.round(point.z + base.depth / 2), start: Math.round(point.x + base.width / 2), end: Math.round(point.x + base.width / 2), color: base.wallColor } : undefined,
      wallGrab: wallItem && wallPoint ? { offset: wallItem.offset - wallPoint.offset, height: wallItem.height - wallPoint.height } : { offset: 0, height: 0 },
    };
    this.lockOrbit(true);
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.renderer.domElement.dataset.interaction = kind;
    this.renderer.domElement.style.cursor = 'grabbing';
    this.updateSelection();
    this.updateWallSelection();
    this.updatePartitionSelection();
    this.updateHandles();
    this.projectionDirty = true;
    if (kind === 'paint') {
      const cell = this.cellAt(event, true);
      if (cell) this.paintAt(cell);
    } else this.setInteraction(kind === 'rooftop-door' ? 'Klik pintu untuk membuka atau menutup akses rooftop.' : kind === 'partition' ? 'Tarik mengikuti garis petak untuk menggambar tembok dalam.' : kind === 'wall-item' ? 'Geser di dinding, atau pindahkan ke sisi lain. Lepas untuk menyimpan.' : kind === 'item' ? 'Geser barang ke petak yang kosong. Lepas untuk menaruhnya.' : kind === 'height' ? 'Tarik naik atau turun untuk mengubah tinggi dinding.' : kind === 'door' ? 'Geser pintu sepanjang sisi yang dipilih.' : 'Tarik batas ruangan. Barang di dalam tetap aman.');
  }

  private applyRoomPreview(dimensions: Dimensions) {
    if (!this.state || !this.builtRoom) return;
    let wallDocument = this.state.shop;
    if (this.gesture?.kind === 'height') {
      const rounded = Math.round(dimensions.wallHeight * 10) / 10;
      if (this.gesture.heightPreviewValue !== rounded) {
        this.gesture.heightPreview = setWallHeight(this.gesture.base, dimensions.wallHeight);
        this.gesture.heightPreviewValue = rounded;
      }
      wallDocument = this.gesture.heightPreview ?? this.state.shop;
      // If all accessories cannot fit, keep the wall at its accepted height too.
      if (getWallHeight(wallDocument) !== rounded) dimensions = { ...dimensions, wallHeight: getWallHeight(wallDocument) };
      this.transientWallItems = getWallItems(wallDocument);
    }
    this.transient = dimensions;
    this.builtRoom.previewDimensions(dimensions.width, dimensions.depth, dimensions.wallHeight, dimensions.entrancePosition);
    if (this.state.exteriorOnly) applyExteriorWallMaterial(this.builtRoom.walls, getExterior(this.state.building ?? this.state.shop));
    if (this.gesture?.kind === 'height') this.previewExteriorHeight(dimensions.wallHeight);
    this.state.shop.items.forEach((item) => {
      const object = this.items.children.find((candidate) => candidate.userData.itemId === item.id);
      if (!object) return;
      const footprint = getItemFootprint(item);
      object.position.set(item.x - dimensions.width / 2 + footprint.width / 2, this.itemBaseY(item, { ...this.state!.shop, width: dimensions.width, depth: dimensions.depth }), item.z - dimensions.depth / 2 + footprint.depth / 2);
    });
    const wallItems = this.transientWallItems ?? getWallItems(wallDocument);
    this.wallItems.children.forEach((object) => {
      const item = wallItems.find((candidate) => candidate.id === object.userData.wallItemId);
      if (item) this.positionWallItem(object, item, { ...wallDocument, width: dimensions.width, depth: dimensions.depth });
    });
    if (this.gesture?.kind === 'height') this.queueWindowItems(wallItems);
    if (this.grid) this.grid.scale.set(dimensions.width / this.state.shop.width, 1, dimensions.depth / this.state.shop.depth);
    this.updateHandles();
    this.updatePreviewMetadata();
    this.projectionDirty = true;
    this.renderDirty = true;
    this.refreshDragShadows();
  }

  private refreshDragShadows() {
    const time = performance.now();
    if (time - this.lastShadowRefresh > 110) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowRefresh = time;
    }
  }

  private dragGesture(event: PointerEvent) {
    const drag = this.gesture;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === 'paint') {
      const cell = this.cellAt(event, true);
      if (cell) this.paintAt(cell);
      this.suppressClick = true;
      return;
    }
    const pixelDistance = Math.hypot(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y);
    if (drag.kind === 'rooftop-door') {
      if (pixelDistance > 6) { drag.moved = true; this.suppressClick = true; }
      return;
    }
    if (!drag.moved && pixelDistance < 4) return;
    drag.moved = true;
    this.suppressClick = true;
    if (drag.kind === 'object-resize') { this.dragObjectResize(event, drag); return; }
    if (drag.kind === 'wall-item' && drag.wallItem) {
      const hit = this.wallCandidateAt(event, drag.wallItem, true);
      drag.wallCandidate = hit ? snapWallDragCandidate(drag.base, { ...hit, offset: hit.offset + (drag.wallGrab?.offset ?? 0), height: hit.height + (drag.wallGrab?.height ?? 0) }, drag.wallItem.id) : drag.wallCandidate;
      drag.valid = !!hit && !!drag.wallCandidate && this.validWallCandidate(drag.base, drag.wallCandidate, drag.wallItem.id);
      const object = this.wallItems.children.find((entry) => entry.userData.wallItemId === drag.wallItem!.id);
      if (object && drag.wallCandidate) this.positionWallItem(object, drag.wallCandidate);
      const size = this.wallSize(drag.wallItem);
      if (!this.wallDragFrame || this.wallDragValid !== drag.valid) {
        if (this.wallDragFrame) disposeGroup(this.wallDragFrame);
        this.wallDragFrame = wallFrame(size.width, size.height, drag.valid ? '#668c68' : '#c76269', true);
        this.wallDragValid = drag.valid;
        this.scene.add(this.wallDragFrame);
      }
      if (drag.wallCandidate) this.positionWallItem(this.wallDragFrame, drag.wallCandidate);
      if (drag.wallItem.kind === 'window') this.previewWindow(drag.valid ? drag.wallCandidate ?? null : null);
      this.setInteraction(drag.valid ? 'Pas di dinding. Lepas untuk menyimpan.' : 'Di luar dinding atau bertabrakan. Lepas untuk mengembalikan hiasan.');
      this.renderer.domElement.dataset.previewWallItem = JSON.stringify({ ...drag.wallCandidate, valid: drag.valid });
      this.renderDirty = true;
      this.projectionDirty = true;
      this.refreshDragShadows();
      return;
    }
    const point = this.floorPoint(event);
    if (!point) return;
    const dx = point.x - drag.startPoint.x;
    const dz = point.z - drag.startPoint.z;
    if (drag.kind === 'partition' && drag.partitionCandidate) {
      const start = { x: Math.round(drag.startPoint.x + drag.base.width / 2), z: Math.round(drag.startPoint.z + drag.base.depth / 2) };
      const end = { x: Math.round(point.x + drag.base.width / 2), z: Math.round(point.z + drag.base.depth / 2) };
      const axis = Math.abs(end.x - start.x) >= Math.abs(end.z - start.z) ? 'x' : 'z';
      drag.partitionCandidate = { ...drag.partitionCandidate, axis, line: axis === 'x' ? start.z : start.x, start: Math.min(start[axis], end[axis]), end: Math.max(start[axis], end[axis]) };
      drag.valid = canPlacePartition(drag.base, drag.partitionCandidate);
      this.drawPartitionPreview(drag.partitionCandidate, drag.valid);
      this.setInteraction(drag.valid ? 'Lepas untuk membangun tembok. Pintu bisa ditambahkan sesudahnya.' : 'Tembok perlu lantai di kedua sisi dan tidak boleh memotong perabot.');
      return;
    }
    if (drag.kind === 'item' && drag.item && drag.itemPosition) {
      const object = this.items.children.find((entry) => entry.userData.itemId === drag.item!.id);
      if (!object) return;
      drag.candidate = { ...drag.item, x: Math.round(drag.item.x + dx), z: Math.round(drag.item.z + dz) };
      object.position.set(drag.itemPosition.x + dx, this.itemBaseY(drag.candidate) + 0.047, drag.itemPosition.z + dz);
      drag.valid = this.canPlaceItem(drag.base, drag.candidate, drag.item.id);
      const size = getItemFootprint(drag.item);
      if (!this.itemDragFrame || this.itemDragFrameValid !== drag.valid) {
        if (this.itemDragFrame) disposeGroup(this.itemDragFrame);
        this.itemDragFrame = frame(size.width, size.depth, drag.valid ? '#668c68' : '#c76269', true);
        this.itemDragFrameValid = drag.valid;
        this.scene.add(this.itemDragFrame);
      }
      this.itemDragFrame.position.set(drag.candidate.x - drag.base.width / 2 + size.width / 2, this.itemFrameY(drag.candidate), drag.candidate.z - drag.base.depth / 2 + size.depth / 2);
      this.setInteraction(drag.valid ? 'Tempatnya pas. Lepas untuk menaruh barang.' : 'Tempat ini terisi atau di luar lantai. Lepas untuk mengembalikan barang.');
      this.renderer.domElement.dataset.previewItem = JSON.stringify({ id: drag.item.id, x: drag.item.x + dx, z: drag.item.z + dz, valid: drag.valid });
      this.renderDirty = true;
      this.projectionDirty = true;
      this.refreshDragShadows();
      return;
    }
    const dimensions = { ...drag.dimensions };
    if (drag.kind === 'height') {
      const origin = new THREE.Vector3(0, this.wallEditY() + drag.dimensions.wallHeight, -drag.base.depth / 2);
      const a = this.project(origin);
      const b = this.project(origin.clone().add(new THREE.Vector3(0, 1, 0)));
      const axis = new THREE.Vector2(b.clientX - a.clientX, b.clientY - a.clientY);
      const movement = new THREE.Vector2(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y);
      const delta = axis.lengthSq() > 4 ? movement.dot(axis) / axis.lengthSq() : -movement.y * (this.camera.top - this.camera.bottom) / this.height / this.camera.zoom;
      dimensions.wallHeight = THREE.MathUtils.clamp(drag.dimensions.wallHeight + delta, 2.3, 4.5);
      this.setInteraction(`Tinggi dinding ${dimensions.wallHeight.toFixed(1)} m. Lepas untuk menyimpan.`);
    } else if (drag.kind === 'door') {
      const horizontal = wallIsHorizontal(getEntranceWall(drag.base));
      const bounds = getFloorBounds(drag.base);
      dimensions.entrancePosition = THREE.MathUtils.clamp(drag.dimensions.entrancePosition + (horizontal ? dx : dz) / Math.max(1, (horizontal ? bounds.width : bounds.depth) - 2.2), 0, 1);
      this.setInteraction('Geser pintu ke tempat yang kamu suka. Lepas untuk menyimpan.');
    } else {
      const minimum = minimumSize({ ...drag.base, items: drag.base.items.filter((item) => !isStandingSign(item.kind) || hasFloorCell(drag.base, item.x, item.z)) });
      const horizontal = drag.handle === 'right' || drag.handle === 'left' || drag.handle === 'corner';
      const vertical = drag.handle === 'front' || drag.handle === 'back' || drag.handle === 'corner';
      const requestedWidth = drag.base.width + (horizontal ? dx * (drag.handle === 'left' ? -2 : 2) : 0);
      const requestedDepth = drag.base.depth + (vertical ? dz * (drag.handle === 'back' ? -2 : 2) : 0);
      dimensions.width = THREE.MathUtils.clamp(requestedWidth, minimum.width, 10);
      dimensions.depth = THREE.MathUtils.clamp(requestedDepth, minimum.depth, 10);
      const occupied = requestedWidth < minimum.width - 0.04 || requestedDepth < minimum.depth - 0.04;
      this.setInteraction(occupied ? 'Ada barang di batas ruangan. Pindahkan barangnya sebelum mengecilkan lantai.' : `Lantai ${dimensions.width.toFixed(1)} × ${dimensions.depth.toFixed(1)} petak. Lepas untuk menyimpan.`);
    }
    this.applyRoomPreview(dimensions);
  }

  private restorePreview() {
    if (!this.state) return;
    this.exteriorPreviewPositions.forEach((y, object) => { object.position.y = y; });
    this.exteriorPreviewPositions.clear();
    this.resizeHover = null;
    const base = this.dimensions();
    this.builtRoom?.previewDimensions(base.width, base.depth, base.wallHeight, base.entrancePosition);
    if (this.builtRoom) {
      if (this.state.exteriorOnly) applyExteriorWallMaterial(this.builtRoom.walls, getExterior(this.state.building ?? this.state.shop));
      this.builtRoom.floor.visible = true;
      this.updateBoundaryVisibility();
      this.builtRoom.entrance.visible = this.builtRoom.hasFloor && (this.state.activeLevel ?? 0) === 0;
    }
    this.items.children.forEach((object) => {
      const item = this.state!.shop.items.find((entry) => entry.id === object.userData.itemId);
      if (item) this.positionItem(object as THREE.Group, item);
    });
    this.wallItems.children.forEach((object) => {
      const item = getWallItems(this.state!.shop).find((entry) => entry.id === object.userData.wallItemId);
      if (item) this.positionWallItem(object, item);
    });
    if (this.grid) { this.grid.scale.set(1, 1, 1); this.grid.visible = this.state.showGrid && !this.state.preview && !this.state.exteriorOnly; }
    if (this.itemDragFrame) disposeGroup(this.itemDragFrame);
    this.itemDragFrame = null;
    this.itemDragFrameValid = null;
    if (this.wallDragFrame) disposeGroup(this.wallDragFrame);
    this.wallDragFrame = null;
    this.wallDragValid = null;
    if (this.partitionPreview) disposeGroup(this.partitionPreview);
    this.partitionPreview = null;
    delete this.renderer.domElement.dataset.previewPartition;
    this.transient = null;
    this.transientWallItems = null;
    delete this.renderer.domElement.dataset.previewItem;
    delete this.renderer.domElement.dataset.previewWallItem;
    this.previewWindow(null, true);
    this.renderer.shadowMap.needsUpdate = true;
    this.updateHandles();
    this.updatePainter();
    this.updateSelection();
    this.updateWallSelection();
    this.updatePartitionSelection();
    this.updateObjectResize();
    this.updatePreviewMetadata();
    this.projectionDirty = true;
    this.renderDirty = true;
  }

  private endGesture(cancelled: boolean) {
    const drag = this.gesture;
    if (!drag) return;
    const dimensions = this.transient;
    this.gesture = null;
    this.lockOrbit(false);
    this.renderer.domElement.dataset.interaction = 'idle';
    this.renderer.domElement.style.cursor = this.state?.placement ? 'crosshair' : 'grab';
    if (this.renderer.domElement.hasPointerCapture(drag.pointerId)) this.renderer.domElement.releasePointerCapture(drag.pointerId);
    if (drag.kind === 'rooftop-door') {
      // A door tap only claims the pointer; it creates no room/window draft.
      this.setInteraction(null);
      this.updateSelection(); this.updateWallSelection(); this.updatePartitionSelection();
      this.updateHandles(); this.updateObjectResize();
      this.projectionDirty = true; this.renderDirty = true;
      if (!cancelled && !drag.moved && drag.rooftopDoorId) {
        this.renderer.domElement.style.cursor = 'pointer';
        this.callbacks.onToggleRooftopDoor?.(drag.rooftopDoorId);
      }
      return;
    }
    this.restorePreview();
    this.setInteraction(null);
    if (cancelled) return;
    if (drag.kind === 'object-resize') {
      if (drag.moved) this.commitObjectResize(drag.base, { item: drag.candidate, wallItem: drag.wallCandidate, valid: drag.valid });
      return;
    }
    let next = drag.base;
    let label = '';
    if (drag.kind === 'partition') {
      if (drag.moved && drag.valid && drag.partitionCandidate) {
        next = placePartition(drag.base, drag.partitionCandidate);
        label = 'Tembok dalam ditambahkan';
        if (next !== drag.base) this.callbacks.onSelectPartition?.(drag.partitionCandidate.id);
      }
    } else if (drag.kind === 'paint' && drag.draft) {
      next = drag.draft;
      label = drag.paintOperation === 'add' ? 'Lantai ditambahkan' : 'Lantai dihapus';
    } else if (drag.kind === 'wall-item' && drag.wallItem) {
      this.callbacks.onSelectWall(drag.wallItem.id);
      if (drag.moved && drag.valid && drag.wallCandidate) {
        const { wall, line, offset, height, partitionId } = drag.wallCandidate;
        next = updateWallItem(drag.base, drag.wallItem.id, { wall, line, offset, height, partitionId });
        label = 'Hiasan dinding dipindahkan';
      } else if (drag.moved) {
        this.callbacks.onNotice?.('Belum muat di sini. Geser ke bagian tembok yang kosong atau kecilkan ukurannya.');
      }
    } else if (drag.kind === 'item' && drag.item) {
      this.callbacks.onSelect(drag.item.id);
      if (drag.moved && drag.valid && drag.candidate) { next = updateItem(drag.base, drag.item.id, { x: drag.candidate.x, z: drag.candidate.z }); label = 'Barang dipindahkan'; }
    } else if (drag.kind === 'door') {
      this.callbacks.onSelectDoor();
      if (drag.moved && dimensions) {
        next = setEntrance(drag.base, { position: dimensions.entrancePosition });
        label = 'Posisi pintu disimpan';
      }
    } else if (drag.moved && dimensions) {
      if (drag.kind === 'height') { next = setWallHeight(drag.base, dimensions.wallHeight); label = 'Tinggi dinding disimpan'; }
      else { next = resizeShop(drag.base, Math.round(dimensions.width), Math.round(dimensions.depth)) ?? drag.base; label = 'Ukuran ruangan disimpan'; }
    }
    if (next !== drag.base) this.callbacks.onChange(next, label);
  }

  private cancelGesture() { this.endGesture(true); }

  private updatePreviewMetadata() {
    if (!this.state) return;
    const dimensions = this.transient ?? this.dimensions();
    const data = this.renderer.domElement.dataset;
    data.previewWidth = String(dimensions.width);
    data.previewDepth = String(dimensions.depth);
    data.previewWallHeight = String(dimensions.wallHeight);
    if ((this.state.activeLevel ?? 0) === 0) data.previewEntrancePosition = String(dimensions.entrancePosition);
    else delete data.previewEntrancePosition;
  }

  private prepareRay(event: Pick<PointerEvent, 'clientX' | 'clientY'>) {
    this.scene.updateMatrixWorld(true);
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private pickRooftopDoorAt(event: Pick<PointerEvent, 'clientX' | 'clientY'>): string | null {
    if (!this.state || (!this.state.rooftopOnly && !this.state.exteriorOnly) || getRoof(this.state.building ?? this.state.shop).stairAccess !== 'enclosed') return null;
    const doors = [...this.rooftopDoorTargets.keys()].filter(object => this.isObjectVisible(object));
    if (!doors.length) return null;
    this.prepareRay(event);
    const candidate = this.raycaster.intersectObjects(doors, true)[0];
    if (!candidate) return null;
    const far = this.raycaster.far;
    this.raycaster.far = Math.min(far, candidate.distance + 0.0001);
    try {
      for (const hit of this.raycaster.intersectObjects(this.scene.children, true)) {
        if (!this.isObjectVisible(hit.object)) continue;
        let object: THREE.Object3D | null = hit.object;
        while (object) {
          if (typeof object.userData.rooftopDoorId === 'string') return object.userData.rooftopDoorId;
          object = object.parent;
        }
        // Walls, the stair-house roof, and nearby furniture occlude the door.
        if (hit.object instanceof THREE.Mesh) return null;
      }
    } finally { this.raycaster.far = far; }
    return null;
  }

  private cellAt(event: PointerEvent, allowEmpty = false): Cell | null {
    if (!this.state) return null;
    this.prepareRay(event);
    const point = this.raycaster.ray.intersectPlane(this.floorPlane, new THREE.Vector3());
    if (!point) return null;
    const x = Math.floor(point.x + this.state.shop.width / 2);
    const z = Math.floor(point.z + this.state.shop.depth / 2);
    if (allowEmpty) return x >= MIN_FLOOR_COORD && x <= MAX_FLOOR_COORD && z >= MIN_FLOOR_COORD && z <= MAX_FLOOR_COORD ? { x, z } : null;
    if (hasFloorCell(this.state.shop, x, z)) return { x, z };
    const kind = this.state.placement?.kind ?? this.state.shop.items.find((item) => item.id === this.state?.selectedId)?.kind;
    if (!kind || !isStandingSign(kind)) return null;
    const groundY = (this.state.showCity ?? true) ? -0.08 : -0.401;
    let ground = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY), new THREE.Vector3());
    if (!ground) return null;
    if (this.builtRoom) {
      const supports = standingSignSupports(this.builtRoom.floor, this.state.showWalls && (this.state.activeLevel ?? 0) === 0 ? this.builtRoom.entrance : undefined);
      const hit = this.raycaster.intersectObjects(supports, true)[0];
      if (hit && hit.point.y > groundY && hit.distance < this.raycaster.ray.origin.distanceTo(ground)) ground = hit.point;
    }
    const gx = Math.floor(ground.x + this.state.shop.width / 2);
    const gz = Math.floor(ground.z + this.state.shop.depth / 2);
    const bounds = getItemPlacementBounds(this.state.shop, kind);
    const floor = getFloorBounds(this.state.shop);
    return gx >= bounds.minX && gx <= bounds.maxX && gz > floor.maxZ && gz <= bounds.maxZ ? { x: gx, z: gz } : null;
  }

  private pickAt(event: PointerEvent): string | null {
    if (this.state?.exteriorOnly && (this.state.activeLevel ?? 0) !== 0) return null;
    this.prepareRay(event);
    const intersections = this.raycaster.intersectObjects(this.state?.exteriorOnly
      ? [...this.items.children, this.wallItems, ...(this.room ? [this.room] : []), ...(this.building ? [this.building] : [])]
      : this.items.children, true);
    for (const intersection of intersections) {
      if (!this.isObjectVisible(intersection.object)) continue;
      let object: THREE.Object3D | null = intersection.object;
      while (object && object !== this.items) {
        if (typeof object.userData.itemId === 'string' && (!this.state?.exteriorOnly || object.parent === this.items)) return object.userData.itemId;
        object = object.parent;
      }
      // The facade and other storeys must block signs behind them.
      if (this.state?.exteriorOnly && intersection.object instanceof THREE.Mesh) return null;
    }
    // Narrow sign legs/edges remain usable on a phone without enlarging their visible mesh.
    if (this.state) {
      let nearest: { id: string; distance: number } | null = null;
      const minimum = event.pointerType === 'touch' ? 44 : 28;
      for (const object of this.items.children) {
        if (!this.isObjectVisible(object)) continue;
        const item = this.state.shop.items.find((entry) => entry.id === object.userData.itemId);
        if (!item || !isStandingSign(item.kind)) continue;
        const box = new THREE.Box3().setFromObject(object);
        const corners = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(this.project(new THREE.Vector3(x, y, z)));
        const minX = Math.min(...corners.map((point) => point.clientX)), maxX = Math.max(...corners.map((point) => point.clientX));
        const minY = Math.min(...corners.map((point) => point.clientY)), maxY = Math.max(...corners.map((point) => point.clientY));
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        if (Math.abs(event.clientX - cx) > Math.max(minimum, maxX - minX) / 2 || Math.abs(event.clientY - cy) > Math.max(minimum, maxY - minY) / 2) continue;
        const distance = Math.hypot(event.clientX - cx, event.clientY - cy);
        if (!nearest || distance < nearest.distance) nearest = { id: item.id, distance };
      }
      if (nearest) return nearest.id;
    }
    return null;
  }

  private pickWallAt(event: PointerEvent): string | null {
    if (!this.state?.showWalls) return null;
    this.prepareRay(event);
    const intersections = this.raycaster.intersectObjects([...this.wallItems.children, ...this.items.children, ...(this.room?.children ?? []), ...(this.state.exteriorOnly && this.building ? [this.building] : [])], true);
    for (const intersection of intersections) {
      let object: THREE.Object3D | null = intersection.object;
      let visible = true;
      while (object) { if (!object.visible) { visible = false; break; } object = object.parent; }
      if (!visible) continue;
      object = intersection.object;
      while (object && object !== this.scene) {
        if (typeof object.userData.wallItemId === 'string') return object.userData.wallItemId;
        object = object.parent;
      }
      if (intersection.object instanceof THREE.Mesh) return null;
    }
    return null;
  }

  private canPlaceItem(shop: ShopDocument, item: ShopItem, ignoreId?: string) {
    return this.state?.rooftopOnly
      ? canPlaceRooftop(this.state.building ?? this.state.shop, item, ignoreId)
      : canPlace(shop, item, ignoreId) && (!this.state?.building || canPlaceLevelItem(this.state.building, this.state.activeLevel ?? 0, item, ignoreId));
  }

  private updateWallMountGuide(mount?: Pick<WallItem, 'wall' | 'line' | 'partitionId'> | null) {
    if (!this.state) return;
    const shop = this.state.shop, height = getWallHeight(shop);
    const runs = mount ? getWallMountRuns(shop, this.state.wallPlacement ?? undefined).filter(run => run.wall === mount.wall && run.line === mount.line && run.partitionId === mount.partitionId) : [];
    const key = JSON.stringify([runs, shop.width, shop.depth, height, this.wallEditY(), this.state.exteriorOnly]);
    if (key === this.wallMountGuideKey) return;
    this.wallMountGuideKey = key;
    if (this.wallMountGuide) disposeGroup(this.wallMountGuide);
    this.wallMountGuide = null;
    this.renderer.domElement.dataset.wallMountGuide = JSON.stringify(mount ?? null);
    if (!runs.length) return;
    const group = new THREE.Group(); group.name = 'wall-mount-guide'; group.position.y = this.wallEditY();
    for (const run of runs) {
      const guideItem = { ...this.state.wallPlacement!, wall: run.wall, line: run.line, offset: (run.start + run.end) / 2, height: height / 2 };
      if (run.partitionId) guideItem.partitionId = run.partitionId;
      else delete guideItem.partitionId;
      const position = wallItemPosition(shop, guideItem);
      const panel = new THREE.Group(); panel.position.set(position.x, position.y, position.z); panel.rotation.y = position.rotation;
      const geometry = new THREE.PlaneGeometry(run.end - run.start, height);
      const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#ad8fd0', transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide }));
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineDashedMaterial({ color: '#9565c6', transparent: true, opacity: 0.6, dashSize: 0.16, gapSize: 0.09, depthWrite: false }));
      outline.computeLineDistances(); panel.add(surface, outline); group.add(panel);
    }
    group.traverse(object => { object.raycast = () => undefined; });
    this.wallMountGuide = group; this.scene.add(group); this.renderDirty = true;
  }

  private pickPartitionAt(event: PointerEvent): string | null {
    if (this.state?.exteriorOnly) return null;
    if (!this.state?.showWalls || !this.builtRoom) return null;
    this.prepareRay(event);
    const hits = this.raycaster.intersectObjects([this.builtRoom.partitions, this.items, this.wallItems, this.room!], true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      let visible = true;
      while (object) { if (!object.visible) { visible = false; break; } object = object.parent; }
      if (!visible) continue;
      if (typeof hit.object.userData.partitionId === 'string') return hit.object.userData.partitionId;
      if (hit.object instanceof THREE.Mesh) return null;
    }
    return null;
  }

  private updatePartitionSelection() {
    if (this.partitionSelection) disposeGroup(this.partitionSelection);
    this.partitionSelection = null;
    if (!this.state?.selectedPartitionId || !this.state.showWalls || this.state.preview || this.state.exteriorOnly || this.gesture) return;
    const object = this.builtRoom?.partitions.getObjectByName(`partition:${this.state.selectedPartitionId}`);
    if (!object) return;
    this.partitionSelection = new THREE.Box3Helper(new THREE.Box3().setFromObject(object), new THREE.Color('#8456c5'));
    const materials = Array.isArray(this.partitionSelection.material) ? this.partitionSelection.material : [this.partitionSelection.material];
    materials.forEach(material => { material.depthTest = false; });
    this.partitionSelection.renderOrder = 20;
    this.partitionSelection.raycast = () => undefined;
    this.scene.add(this.partitionSelection);
  }

  private drawPartitionPreview(wall: PartitionWall, valid: boolean) {
    if (this.partitionPreview) disposeGroup(this.partitionPreview);
    this.partitionPreview = new THREE.Group();
    const position = getPartitionPosition(this.state!.shop, wall), height = getWallHeight(this.state!.shop);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.02, position.length), height, 0.13), new THREE.MeshBasicMaterial({ color: valid ? '#6a9674' : '#ca6871', transparent: true, opacity: 0.42, depthWrite: false }));
    mesh.position.y = height / 2;
    mesh.raycast = () => undefined;
    this.partitionPreview.add(mesh);
    this.partitionPreview.position.set(position.x, 0, position.z);
    this.partitionPreview.rotation.y = position.rotation;
    this.scene.add(this.partitionPreview);
    this.renderer.domElement.dataset.previewPartition = JSON.stringify({ ...wall, valid });
    this.renderDirty = true;
  }

  private setHover(cell: Cell | null) {
    if (cell?.x === this.hover?.x && cell?.z === this.hover?.z) return;
    this.hover = cell;
    this.updatePlacement();
    this.updatePainter();
    this.callbacks.onHover(cell);
  }

  private pointerDown = (event: PointerEvent) => {
    this.activePointers.add(event.pointerId);
    if (this.activePointers.size > 1) {
      this.suppressClick = true;
      this.pointerStart = null;
      this.cancelGesture();
      return;
    }
    if (event.button !== 0 || !this.state) return;
    this.suppressClick = false;
    this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    if (this.state.placement || this.state.wallPlacement) return;
    const rooftopDoorId = this.pickRooftopDoorAt(event);
    if (rooftopDoorId) {
      this.beginGesture(event, 'rooftop-door');
      if (this.gesture) this.gesture.rooftopDoorId = rooftopDoorId;
      return;
    }
    if (this.state.preview) return;
    const wallId = this.pickWallAt(event);
    if (this.state.editMode === 'build' && this.state.buildTool === 'partition') {
      if (wallId) return;
      if (!this.pickPartitionAt(event)) this.beginGesture(event, 'partition');
      return;
    }
    if (this.resizeSelection()) {
      // Hover outlines must not move the real grips away from their selected object.
      this.resizeHover = null;
      this.updateObjectResize();
      const edge = this.pickResizeEdge(event);
      if (edge) this.beginObjectResize(event, edge);
      return;
    }
    // Explicit resize grips own their pointer above; ordinary clicks on a bare
    // partition must not start dragging furniture behind that wall.
    if (this.state.editMode !== 'build' && !wallId && this.pickPartitionAt(event)) return;
    const doorEditable = (this.state.activeLevel ?? 0) === 0 && (this.state.editMode !== 'build' || this.state.buildTool === 'walls');
    if (doorEditable && (this.pickHandle(event) === 'door' || this.roomTarget(event) === 'door')) {
      this.beginGesture(event, 'door', 'door');
      return;
    }
    const wallItem = wallId ? getWallItems(this.state.shop).find((item) => item.id === wallId) : undefined;
    if (wallItem && (!this.state.exteriorOnly || this.state.editMode !== 'build') && !this.pickHandle(event)) {
      this.beginGesture(event, 'wall-item', undefined, undefined, wallItem);
      return;
    }
    if (this.state.editMode === 'build') {
      if (['add', 'erase'].includes(this.state.buildTool ?? 'add')) {
        const cell = this.cellAt(event, true);
        const targets = new Set(workCells(this.state.shop).map((point) => `${point.x},${point.z}`));
        if (cell && targets.has(`${cell.x},${cell.z}`)) this.beginGesture(event, 'paint');
        return;
      }
      const handle = this.pickHandle(event);
      if (handle) {
        this.beginGesture(event, handle === 'walltop' ? 'height' : handle === 'door' ? 'door' : 'resize', handle);
        return;
      }
      const target = this.roomTarget(event);
      if (target === 'door' || (target && !this.state.shop.floorCells)) this.beginGesture(event, target === 'door' ? 'door' : 'resize', target);
    } else if (this.roomTarget(event) !== 'door') {
      const id = this.pickAt(event);
      const item = this.state.shop.items.find((entry) => entry.id === id);
      if (item) this.beginGesture(event, 'item', undefined, item);
    }
  };

  private pointerMove = (event: PointerEvent) => {
    if (!this.state) return;
    if (this.gesture) { this.dragGesture(event); return; }
    if (this.pointerStart && Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 6) this.suppressClick = true;
    if (this.activePointers.size > 1) return;
    if (!this.state.placement && !this.state.wallPlacement && this.pickRooftopDoorAt(event)) {
      this.setHover(null); this.renderer.domElement.style.cursor = 'pointer'; return;
    }
    if (this.state.preview) { this.renderer.domElement.style.cursor = 'grab'; return; }
    if (this.resizeSelection()) {
      this.resizeHover = null;
      this.updateObjectResize();
      const edge = this.pickResizeEdge(event);
      this.resizeHover = edge || this.pointerStart ? null : this.resizeAt(event);
      this.updateObjectResize();
      this.renderer.domElement.style.cursor = edge ? 'ew-resize' : 'crosshair';
      this.projectionDirty = true;
      this.renderDirty = true;
      return;
    }
    if (this.state.wallPlacement) {
      this.setWallHover(this.wallCandidateAt(event, this.state.wallPlacement));
      this.renderer.domElement.style.cursor = 'crosshair';
      return;
    }
    if (this.state.exteriorOnly) {
      this.setHover(this.state.placement ? this.cellAt(event) : null);
      this.renderer.domElement.style.cursor = this.state.placement ? 'crosshair' : this.pickHandle(event) || this.roomTarget(event) === 'door' || (this.state.editMode !== 'build' && (this.pickWallAt(event) || this.pickAt(event))) ? 'move' : 'grab';
      return;
    }
    const painting = this.state.editMode === 'build' && ['add', 'erase', 'partition'].includes(this.state.buildTool ?? 'add') && !this.state.placement;
    const cell = this.cellAt(event, painting);
    this.setHover(cell);
    const target = this.roomTarget(event);
    this.renderer.domElement.style.cursor = this.state.placement || painting ? 'crosshair' : this.pickHandle(event) || this.pickWallAt(event) || target === 'door' || (this.state.editMode === 'build' && target) ? 'move' : 'grab';
  };

  private pointerUp = (event: PointerEvent) => {
    this.activePointers.delete(event.pointerId);
    if (this.gesture?.pointerId === event.pointerId) {
      this.dragGesture(event);
      const tap = this.gesture?.kind === 'object-resize' && !this.gesture.moved && this.gesture.resizeTapFallback ? this.resizeAt(event) : null;
      this.endGesture(false);
      if (tap && this.state) this.commitObjectResize(this.state.shop, tap);
      this.pointerStart = null;
      this.suppressClick = true;
      return;
    }
    const start = this.pointerStart;
    if (!start || start.id !== event.pointerId) return;
    this.pointerStart = null;
    if (!this.state || this.suppressClick || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    if (this.resizeSelection()) {
      const candidate = this.resizeAt(event);
      this.resizeHover = null;
      if (candidate) this.commitObjectResize(this.state.shop, candidate);
      this.updateObjectResize();
      this.projectionDirty = true;
      this.renderDirty = true;
      return;
    }
    if (this.state.wallPlacement && !this.state.preview) {
      const candidate = this.wallCandidateAt(event, this.state.wallPlacement);
      if (candidate) this.callbacks.onWallPlace(candidate);
    } else if (this.state.placement) {
      const cell = this.cellAt(event);
      if (cell) this.callbacks.onCell(cell.x, cell.z);
    } else if (this.roomTarget(event) === 'door') {
      if (!this.state.preview) this.callbacks.onSelectDoor();
    } else if (!this.state.preview) {
      if (this.state.exteriorOnly && this.state.editMode === 'build') return;
      const wallId = this.pickWallAt(event);
      if (wallId) { this.callbacks.onSelectWall(wallId); return; }
      const partitionId = this.pickPartitionAt(event);
      if (partitionId) { this.callbacks.onSelectPartition?.(partitionId); return; }
      this.callbacks.onSelectWall(null); this.callbacks.onSelect(this.pickAt(event));
    }
  };

  private pointerLeave = () => { if (!this.gesture) { this.setHover(null); this.setWallHover(null); this.resizeHover = null; this.updateObjectResize(); this.projectionDirty = true; this.renderDirty = true; } };
  private pointerCancel = (event: PointerEvent) => {
    this.activePointers.delete(event.pointerId);
    if (this.gesture?.pointerId === event.pointerId) this.cancelGesture();
    this.pointerStart = null;
    this.suppressClick = true;
    this.setHover(null);
    this.setWallHover(null);
  };
  private lostPointerCapture = (event: PointerEvent) => {
    if (this.gesture?.pointerId === event.pointerId) this.pointerCancel(event);
  };
  private keyDown = (event: KeyboardEvent) => {
    if (!this.gesture) return;
    if (event.key === 'Escape') {
      this.cancelGesture();
      this.pointerStart = null;
      this.suppressClick = true;
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      this.cancelGesture();
      this.pointerStart = null;
      this.suppressClick = true;
    } else if (['Delete', 'Backspace', 'r', 'R'].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  private windowBlur = () => {
    this.cancelGesture();
    this.activePointers.clear();
    this.pointerStart = null;
    this.suppressClick = true;
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.cancelGesture();
    cancelAnimationFrame(this.animation);
    this.renderer.domElement.dataset.ready = 'false';
    this.callbacks.onError('Tampilan 3D terhenti. Muat ulang halaman untuk melanjutkan; rancangan yang tersimpan tetap ada.');
  };
  private cameraChanged = () => { this.projectionDirty = true; this.renderDirty = true; };
  private motionChanged = () => {
    this.lighting.setMode(this.state?.nightMode ?? false, this.reducedMotion.matches);
    if (this.city) setCityTimeOfDay(this.city, this.state?.nightMode ?? false, this.reducedMotion.matches);
    this.updatePedestrianMetadata();
    this.renderDirty = true;
  };

  private updatePedestrianMetadata() {
    const crowd = this.city && getCityPedestrianState(this.city);
    if (!crowd) return;
    this.renderer.domElement.dataset.pedestrianPhase = crowd.phase;
    this.renderer.domElement.dataset.visiblePedestrians = String(this.city?.visible ? crowd.visible : 0);
  }

  private updateLightingMetadata() {
    const data = this.renderer.domElement.dataset;
    const set = (key: string, value: string) => { if (data[key] !== value) data[key] = value; };
    set('lightingMode', this.lighting.mode);
    set('nightProgress', String(this.lighting.nightProgress));
    set('activeShopLights', String(this.lighting.activeShopLights));
    set('activeCityLights', String(this.lighting.activeCityLights));
    set('activeFloorLights', String(this.lighting.activeFloorLights));
    set('activeWallLights', String(this.lighting.activeWallLights));
  }

  private resize = () => {
    if (this.disposed) return;
    const rect = this.host.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.renderer.setSize(this.width, this.height, false);
    this.backdrop.resize(this.width, this.height);
    const aspect = this.width / this.height;
    const exterior = this.state?.exteriorOnly;
    const doc = exterior ? this.state!.building ?? this.state!.shop : this.state?.shop;
    const bounds = doc ? getFloorBounds(doc) : { width: 7, depth: 6 };
    const neighbourhoodSpace = this.view === 'orbit' && (this.state?.showCity ?? true) ? (aspect < 1 ? 1.18 : 1.5) : 1;
    const metrics = this.buildingMetrics();
    const floorY = this.activeFloorY();
    const interiorSpan = (Math.max(bounds.width, bounds.depth, 4) + 2.3) * (aspect < 1 ? 1.15 : 1) * neighbourhoodSpace;
    const span = exterior
      ? Math.max(metrics.width + 4, metrics.depth + 4, metrics.height + 3.5) * (this.view === 'orbit' ? 1.24 : 1.05)
      : this.view === 'top' || floorY === 0 ? interiorSpan : Math.max(interiorSpan, floorY * 0.9 + (doc ? getWallHeight(doc) : 3) + 6);
    const halfHeight = (aspect < 1 ? span / aspect : span) / 2;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.projectionDirty = true;
    this.renderDirty = true;
  };

  resetCamera() { this.setView('orbit'); }

  private activeFloorY() {
    return !this.state || this.state.exteriorOnly ? 0 : getLevelBaseY(this.state.building ?? this.state.shop, this.state.activeLevel ?? 0);
  }

  private buildingMetrics() {
    const doc = this.state?.building ?? this.state?.shop;
    return doc ? getBuildingBounds(doc) : { height: 3, width: 7, depth: 6, centerX: 0, centerZ: 0 };
  }

  setView(view: CameraView) {
    this.backdrop.setView(view);
    this.cancelGesture();
    this.view = view;
    this.resize();
    // Drain any pending orbit damping before an explicit camera command.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.minPolarAngle = view === 'top' ? 0.001 : 0.045;
    const exterior = this.state?.exteriorOnly;
    const doc = exterior ? this.state!.building ?? this.state!.shop : this.state?.shop;
    const bounds = doc ? getFloorBounds(doc) : null;
    const metrics = this.buildingMetrics();
    const cx = exterior ? metrics.centerX : bounds && doc ? bounds.minX + bounds.width / 2 - doc.width / 2 : 0;
    const cz = exterior ? metrics.centerZ : bounds && doc ? bounds.minZ + bounds.depth / 2 - doc.depth / 2 : 0;
    const floorY = this.activeFloorY();
    const targetY = exterior ? metrics.height * 0.46 : floorY > 0 && view !== 'top' ? 0.8 - floorY * 0.25 : view === 'orbit' ? (this.width < this.height ? 1.6 : 3.5) : 0.6;
    this.controls.target.set(cx, targetY, cz + 0.15);
    this.camera.zoom = 1;
    if (view === 'top') this.camera.position.set(cx, exterior ? metrics.height + 25 : 18, cz + 0.151);
    else if (view === 'front') this.camera.position.set(cx + 0.4, exterior ? targetY + 3.5 : floorY > 0 ? targetY + 5 : 7.4, cz + 20);
    else this.camera.position.set(cx + (exterior ? 15 : 10.5), exterior ? targetY + 10 : floorY > 0 ? targetY + 8.8 : 8.8, cz + (exterior ? 18 : 13.5));
    this.camera.far = Math.max(100, metrics.height * 5);
    const shadowSpan = exterior ? Math.max(metrics.height, metrics.width, metrics.depth) + 6 : Math.max(12, floorY + 8);
    this.lighting.sun.position.set(exterior ? cx - 4 : -4, exterior ? metrics.height + 12 : 11, exterior ? cz + 7 : 7);
    this.lighting.sun.target.position.set(exterior ? cx : 0, 0, exterior ? cz : 0);
    this.lighting.sun.target.updateMatrixWorld();
    this.lighting.sun.shadow.camera.left = this.lighting.sun.shadow.camera.bottom = -shadowSpan;
    this.lighting.sun.shadow.camera.right = this.lighting.sun.shadow.camera.top = shadowSpan;
    this.lighting.sun.shadow.camera.far = Math.max(35, shadowSpan * 3);
    this.lighting.sun.shadow.camera.updateProjectionMatrix();
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.controls.enableDamping = damping;
    this.projectionDirty = true;
    this.renderer.domElement.dataset.view = this.view;
  }

  capture() {
    if (this.disposed || this.renderer.domElement.dataset.ready !== 'true') return null;
    const helpers = [this.grid, this.selection, this.ghost, this.footprint, this.handles.group, this.itemDragFrame, this.painter.group, this.wallSelection, this.wallGhost, this.wallFootprint, this.wallDragFrame, this.objectResize.group];
    const visibility = helpers.map((object) => object?.visible);
    const wallVisibility = this.wallItems.children.map((object) => object.visible);
    const candidate = this.state?.wallPlacement;
    try {
      // A photo represents the saved design, even while a proposed window is being positioned.
      if (candidate) {
        this.wallItems.children.forEach((object) => { object.visible = true; });
        this.previewWindow(null, true);
      }
      helpers.forEach((object) => { if (object) object.visible = false; });
      return this.lighting.capture(() => {
        this.backdrop.updateGround(this.camera);
        this.backdrop.setNightProgress(this.lighting.nightProgress);
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL('image/png');
      });
    } catch {
      return null;
    } finally {
      helpers.forEach((object, index) => { if (object) object.visible = visibility[index] ?? true; });
      this.wallItems.children.forEach((object, index) => { object.visible = wallVisibility[index]; });
      if (candidate) this.previewWindow(candidate.kind === 'window' ? candidate : null, true);
      this.lighting.update(0, true);
      this.backdrop.setNightProgress(this.lighting.nightProgress);
      this.updateLightingMetadata();
      this.renderDirty = true;
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updateCellMetadata() {
    if (!this.state) return;
    this.scene.updateMatrixWorld(true);
    const dimensions = this.transient ?? this.dimensions();
    const doc = this.gesture?.draft ?? this.state.shop;
    const floorCells = getFloorCells(doc);
    const cells = floorCells.map(({ x, z }) => ({ x, z, ...this.project(new THREE.Vector3(x - dimensions.width / 2 + 0.5, 0.045, z - dimensions.depth / 2 + 0.5)) }));
    const data = this.renderer.domElement.dataset;
    data.activeLevel = String(this.state.activeLevel ?? 0);
    data.levelCount = String(getLevelCount(this.state.building ?? this.state.shop));
    data.exteriorOnly = String(!!this.state.exteriorOnly);
    data.exteriorContextId = this.state.exteriorOnly ? this.building?.uuid ?? '' : '';
    data.editMode = this.state.editMode ?? 'arrange';
    data.exteriorStoreys = JSON.stringify(this.state.exteriorOnly ? this.building?.children.map(object => ({ name: object.name, level: object.userData.level, y: object.position.y })) : []);
    data.rooftopOnly = String(!!this.state.rooftopOnly);
    data.rooftopContextId = this.state.rooftopOnly ? this.rooftop?.uuid ?? '' : '';
    data.rooftopDoors = JSON.stringify([...this.rooftopDoorTargets.keys()].filter(object => this.isObjectVisible(object)).map(object => {
      const center = new THREE.Box3().setFromObject(object.getObjectByName('stair-access-door-leaf') ?? object).getCenter(new THREE.Vector3());
      const point = this.project(center), id = object.userData.rooftopDoorId as string;
      return { id, open: getRooftopDoorOpen(this.state!.building ?? this.state!.shop, id), angle: object.rotation.y,
        ...point, clickable: this.pickRooftopDoorAt(point) === id };
    }));
    data.rooftopStairAccess = getRoof(this.state.building ?? this.state.shop).stairAccess ?? 'open';
    let enclosures = 0, guardrails = 0;
    (this.state.exteriorOnly ? this.building : this.rooftop)?.traverse(object => { if (object.name.startsWith('stair-access-enclosure:') && this.isObjectVisible(object)) enclosures++; });
    const landingRails: object[] = [], stairBridges: object[] = [];
    const landingRoot = this.state.exteriorOnly
      ? this.building?.getObjectByName(`exterior-level:${(this.state.activeLevel ?? 0) + 1}`)?.getObjectByName('stair-landings')
      : this.landings;
    landingRoot?.traverse(object => {
      const rail = ['stairwell-guardrail', 'stairwell-entry-guardrail'].includes(object.name);
      if ((!rail && object.name !== 'stairwell-entry-bridge') || !this.isObjectVisible(object)) return;
      const bounds = new THREE.Box3().setFromObject(object);
      let parent: THREE.Object3D | null = object;
      while (parent && !parent.userData.stairOpening) parent = parent.parent;
      const entry = { stairId: parent?.userData.stairOpening.stairId, upperStairId: object.userData.upperStairId,
        minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z };
      if (rail) { guardrails++; landingRails.push(entry); }
      else stairBridges.push(entry);
    });
    data.rooftopEnclosures = String(enclosures);
    data.landingGuardrails = String(guardrails);
    data.landingRails = JSON.stringify(landingRails);
    data.stairBridges = JSON.stringify(stairBridges);
    data.showAllWalls = String(!!this.state.showAllWalls);
    const boundaryVisible = (wall?: THREE.Group) => {
      if (!wall?.children.length) return false;
      let object: THREE.Object3D | null = wall;
      while (object) { if (!object.visible) return false; object = object.parent; }
      return true;
    };
    data.wallVisibility = JSON.stringify({
      back: boundaryVisible(this.builtRoom?.backWall),
      left: boundaryVisible(this.builtRoom?.leftWall),
      front: boundaryVisible(this.builtRoom?.frontWall),
      right: boundaryVisible(this.builtRoom?.rightWall),
    });
    const building = this.state.building ?? this.state.shop;
    const roof = getRooftopDocument(building);
    const roofObjects = this.state.exteriorOnly ? this.building?.getObjectByName('rooftop-terrace')?.children
      : this.state.rooftopOnly ? this.items.children : [];
    data.rooftopItems = JSON.stringify((roofObjects ?? []).flatMap(object => {
      const item = roof.items.find(candidate => candidate.id === object.userData.itemId);
      if (!item) return [];
      const footprint = getItemFootprint(item);
      return [{ id: item.id, kind: item.kind,
        x: Number((object.position.x + roof.width / 2 - footprint.width / 2).toFixed(5)),
        z: Number((object.position.z + roof.depth / 2 - footprint.depth / 2).toFixed(5)),
        rotation: (Math.round(-THREE.MathUtils.radToDeg(object.rotation.y)) + 360) % 360,
      }];
    }));
    data.roofStyle = getRoof(this.state.building ?? this.state.shop).style;
    data.buildingHeight = String(this.buildingMetrics().height);
    data.activeFloorY = String(this.activeFloorY());
    data.groundY = String(this.ground.position.y);
    data.cameraTarget = JSON.stringify(this.controls.target.toArray());
    data.contextLevels = JSON.stringify(this.lowerFloors?.visible ? this.lowerFloors.children.map(level => ({
      level: level.userData.level, floorY: level.userData.floorY, opacity: level.userData.contextOpacity,
      sceneY: level.getWorldPosition(new THREE.Vector3()).y,
    })) : []);
    data.stairOpenings = JSON.stringify(getStairOpenings(this.state.building ?? this.state.shop, this.state.activeLevel ?? 0));
    data.partitions = JSON.stringify(getPartitions(doc));
    data.interiorDoors = JSON.stringify(getInteriorDoors(doc));
    data.entranceWall = getEntranceWall(doc);
    const vertices = new Map<string, Cell>();
    floorCells.forEach(cell => { for (const dx of [0, 1]) for (const dz of [0, 1]) vertices.set(`${cell.x + dx},${cell.z + dz}`, { x: cell.x + dx, z: cell.z + dz }); });
    data.partitionPoints = JSON.stringify([...vertices.values()].map(point => ({ ...point, ...this.project(new THREE.Vector3(point.x - dimensions.width / 2, 0.045, point.z - dimensions.depth / 2)) })));
    // Inspect the rendered objects in either view, so mode-switch checks can detect stale geometry.
    const pose = (object: THREE.Object3D) => ({
      position: object.getWorldPosition(new THREE.Vector3()).toArray(),
      quaternion: object.getWorldQuaternion(new THREE.Quaternion()).toArray(),
      scale: object.getWorldScale(new THREE.Vector3()).toArray(),
    });
    const entrance = this.state.exteriorOnly && (this.state.activeLevel ?? 0) > 0 ? this.building?.getObjectByName('shop-entrance') : this.builtRoom?.entrance;
    data.renderedEntrance = JSON.stringify(entrance?.visible && (this.state.exteriorOnly || (this.state.activeLevel ?? 0) === 0)
      ? { ...pose(entrance), canopy: !!entrance.getObjectByName('entrance-canopy'), door: pose(entrance.getObjectByName('entrance-door-glass')!) } : null);
    const windows: object[] = [];
    [...(this.state.exteriorOnly && this.building ? [this.building] : []), this.wallItems].forEach(root => root.traverse(object => {
      if (object.name.startsWith('window-style:') && this.isObjectVisible(object)) {
        windows.push({ id: object.userData.wallItemId, style: object.name.slice('window-style:'.length), ...pose(object) });
      }
    }));
    data.renderedWindows = JSON.stringify(windows);
    if (this.state.exteriorOnly && this.state.preview) {
      for (const key of ['resizeHandles', 'resizeTiles', 'cellCenters', 'floorCells', 'floorOutline', 'paintCells', 'groundTargets', 'placementTargets', 'handles', 'itemCenters', 'wallItemCenters', 'wallTargets']) data[key] = '[]';
      data.doorSelected = 'false'; data.resizeMode = 'false'; delete data.doorCenter;
      this.projectionDirty = false;
      return;
    }
    data.doorSelected = String(floorCells.length > 0 && this.state.selectedDoor && (this.state.activeLevel ?? 0) === 0);
    data.resizeMode = String(!!this.resizeSelection());
    data.resizeHandles = JSON.stringify(this.objectResize.group.visible ? this.objectResize.handles.filter(entry => entry.object.visible).map(({ edge, object }) => {
      const point = object.getWorldPosition(new THREE.Vector3());
      return { edge, ...this.project(point), worldX: point.x, worldY: point.y, worldZ: point.z };
    }) : []);
    data.resizeTiles = JSON.stringify(this.objectResize.group.visible ? this.objectResize.targets.map(({ point, ...target }) => ({ ...target, ...this.project(this.objectResize.group.localToWorld(point.clone())) })) : []);
    data.cellCenters = JSON.stringify(cells);
    data.floorCells = JSON.stringify(floorCells);
    data.floorOutline = JSON.stringify(floorOutline(floorCells));
    data.paintCells = JSON.stringify(this.painter.group.visible ? workCells(doc).map(({ x, z }) => ({ x, z, exists: hasFloorCell(doc, x, z), ...this.project(new THREE.Vector3(x - doc.width / 2 + 0.5, 0.045, z - doc.depth / 2 + 0.5)) })) : []);
    const signBounds = getItemPlacementBounds(doc, 'chalkboard');
    const floorBounds = getFloorBounds(doc);
    const groundTargets = floorCells.map(({ x, z }) => ({ x, z, exterior: false, ...this.project(new THREE.Vector3(x - doc.width / 2 + 0.5, 0.045, z - doc.depth / 2 + 0.5)) }));
    for (let z = floorBounds.maxZ + 1; floorCells.length > 0 && z <= signBounds.maxZ; z++) for (let x = signBounds.minX; x <= signBounds.maxX; x++) {
      const groundY = this.signGroundY(x, z, doc);
      groundTargets.push({ x, z, exterior: true, ...this.project(new THREE.Vector3(x - doc.width / 2 + 0.5, groundY, z - doc.depth / 2 + 0.5)) });
    }
    data.groundTargets = JSON.stringify(groundTargets);
    const placementKind = this.state.placement?.kind ?? this.state.shop.items.find((item) => item.id === this.state?.selectedId)?.kind;
    data.placementTargets = JSON.stringify(placementKind && isStandingSign(placementKind) ? groundTargets : groundTargets.filter((cell) => !cell.exterior));
    data.handles = JSON.stringify(this.handles.group.visible ? this.handles.entries.filter((entry) => entry.object.visible).map(({ id, axis, object }) => ({ id, axis, ...this.project(object.position), worldX: object.position.x, worldY: object.position.y, worldZ: object.position.z })) : []);
    data.itemCenters = JSON.stringify(this.items.children.filter(object => this.isObjectVisible(object)).map((object) => {
      const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
      return { id: object.userData.itemId as string, worldX: object.position.x, worldY: object.position.y, worldZ: object.position.z, ...this.project(center) };
    }));
    data.wallItemCenters = JSON.stringify(this.state.showWalls ? this.wallItems.children.map((object) => {
      const item = (this.transientWallItems ?? getWallItems(this.state!.shop)).find((candidate) => candidate.id === object.userData.wallItemId);
      const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
      return { id: object.userData.wallItemId as string, wall: item?.wall, line: item?.line, partitionId: item?.partitionId, offset: item?.offset, height: item?.height, worldX: object.position.x, worldY: object.position.y, worldZ: object.position.z, ...this.project(center) };
    }) : []);
    const wallTargets: object[] = [];
    const wallTargetItem = this.state.wallPlacement ?? getWallItems(this.state.shop).find(item => item.id === this.state!.selectedWallId);
    const wallRuns = this.state.exteriorOnly ? getWallRuns(this.state.shop) : getWallMountRuns(this.state.shop, wallTargetItem);
    if (this.state.showWalls) wallRuns.forEach((run) => {
      for (let offset = run.start + 0.5; offset < run.end; offset += 0.5) {
        for (let height = 0.5; height < getWallHeight(this.state!.shop); height += 0.5) {
          const point = wallIsHorizontal(run.wall) ? new THREE.Vector3(offset - this.state!.shop.width / 2, height + this.wallEditY(), run.line - this.state!.shop.depth / 2) : new THREE.Vector3(run.line - this.state!.shop.width / 2, height + this.wallEditY(), offset - this.state!.shop.depth / 2);
          if (run.partitionId) {
            const mounted = wallItemPosition(this.state!.shop, { id: 'mount-target', kind: 'painting', color: '#ffffff', text: '', lit: false, ...run, offset, height });
            point.set(mounted.x, mounted.y + this.wallEditY(), mounted.z);
          }
          wallTargets.push({ ...run, offset, height, ...this.project(point) });
        }
      }
    });
    data.wallTargets = JSON.stringify(wallTargets);
    if (this.builtRoom?.hasFloor && floorCells.length > 0 && this.state.showWalls && (this.state.activeLevel ?? 0) === 0) {
      const center = new THREE.Box3().setFromObject(this.builtRoom.doorHit).getCenter(new THREE.Vector3());
      data.doorCenter = JSON.stringify(this.project(center));
    } else delete data.doorCenter;
    this.projectionDirty = false;
  }

  private animate = () => {
    if (this.disposed) return;
    const time = performance.now();
    const elapsed = Math.max(0, (time - (this.lastFrameTime || time)) / 1000);
    const delta = Math.min(elapsed, 0.1);
    this.lastFrameTime = time;
    this.controls.update();
    this.flushWindowPreview();
    if (this.city && updateCityPedestrians(this.city, elapsed)) {
      this.renderDirty = true;
      this.updatePedestrianMetadata();
    }
    const pivot = this.builtRoom?.doorPivot;
    if (pivot && pivot.rotation.y !== this.doorTarget) {
      pivot.rotation.y = Math.abs(pivot.rotation.y - this.doorTarget) < 0.002 ? this.doorTarget : THREE.MathUtils.damp(pivot.rotation.y, this.doorTarget, 12, delta);
      if ((this.state?.activeLevel ?? 0) === 0) this.renderer.domElement.dataset.doorAngle = String(pivot.rotation.y);
      this.renderDirty = true;
      this.projectionDirty = true;
      this.refreshDragShadows();
    }
    for (const [door, target] of this.rooftopDoorTargets) {
      if (door.rotation.y === target) continue;
      door.rotation.y = this.reducedMotion.matches || Math.abs(door.rotation.y - target) < 0.002 ? target : THREE.MathUtils.damp(door.rotation.y, target, 12, delta);
      this.renderDirty = true; this.projectionDirty = true;
      this.refreshDragShadows();
    }
    if (this.projectionDirty) { this.backdrop.updateGround(this.camera); this.updateHandles(); this.updateObjectResize(); this.updateItemPlatforms(); this.updateCellMetadata(); }
    // Time-of-day transitions follow elapsed time even on low-frame-rate devices.
    // Only interactive damping above needs a capped delta.
    if (this.lighting.update(elapsed, this.renderDirty)) this.renderDirty = true;
    this.backdrop.setNightProgress(this.lighting.nightProgress);
    this.updateLightingMetadata();
    if (this.renderDirty) {
      this.renderer.render(this.scene, this.camera);
      if (this.state && this.renderer.domElement.dataset.transitioning !== 'true') {
        this.renderer.domElement.dataset.ready = 'true'; this.callbacks.onFrame?.();
      }
      this.renderDirty = false;
    }
    this.animation = requestAnimationFrame(this.animate);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    this.resizeObserver.disconnect();
    this.controls.removeEventListener('change', this.cameraChanged);
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown, true);
    canvas.removeEventListener('pointermove', this.pointerMove, true);
    canvas.removeEventListener('pointerup', this.pointerUp, true);
    canvas.removeEventListener('pointerleave', this.pointerLeave);
    canvas.removeEventListener('pointercancel', this.pointerCancel, true);
    canvas.removeEventListener('lostpointercapture', this.lostPointerCapture);
    canvas.removeEventListener('webglcontextlost', this.contextLost);
    window.removeEventListener('keydown', this.keyDown, true);
    window.removeEventListener('blur', this.windowBlur);
    this.reducedMotion.removeEventListener('change', this.motionChanged);
    this.lighting.dispose();
    this.backdrop.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight || object instanceof THREE.PointLight || object instanceof THREE.SpotLight) object.dispose();
    });
    disposeGroup(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
