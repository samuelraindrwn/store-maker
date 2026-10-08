export type ItemKind = 'shelf' | 'table' | 'counter' | 'rack' | 'plant' | 'rug' | 'lamp' | 'stool' | 'chalkboard' | 'poster-stand' | 'direction-sign'
  | 'glass-cabinet' | 'display-plinth' | 'pegboard' | 'food-display' | 'drinks-fridge' | 'coffee-station' | 'prep-counter' | 'stove' | 'sink' | 'dining-table' | 'service-cart'
  | 'stairs' | 'warehouse-rack' | 'bathroom' | 'toilet' | 'washbasin' | 'shower' | 'canopy' | 'patio-umbrella'
export type ProductKind = 'books' | 'ceramics' | 'plants' | 'fashion' | 'vinyl' | 'shoes' | 'bags' | 'skincare' | 'toys'
  | 'bread' | 'pastries' | 'drinks' | 'fruit' | 'meals' | 'snacks' | 'none'
export type Rotation = 0 | 90 | 180 | 270
export type WallItemKind = 'window' | 'wall-lamp' | 'wall-shelf' | 'painting' | 'wall-sign' | 'wall-clock'
export type WindowStyle = 'classic' | 'picture' | 'grid' | 'sliding' | 'arched'
export type WallLampStyle = 'sconce' | 'lantern' | 'bulkhead'
export type WallSignStyle = 'plaque' | 'fascia' | 'projecting'
export type WallItemMount = 'interior' | 'exterior'
export type WallSide = 'back' | 'left' | 'front' | 'right'
export interface WallItem {
  id: string
  kind: WallItemKind
  wall: WallSide
  line: number
  offset: number
  height: number
  color: string
  text: string
  lit: boolean
  width?: number
  sizeHeight?: number
  windowStyle?: WindowStyle
  mount?: WallItemMount
  wallLampStyle?: WallLampStyle
  wallSignStyle?: WallSignStyle
}
export interface WallRun { wall: WallSide; line: number; start: number; end: number }
export interface WallCatalogEntry {
  kind: WallItemKind
  name: string
  description: string
  width: number
  height: number
  depth: number
  color: string
}

export interface Entrance { position: number; open: boolean; rotation?: Rotation; wall?: WallSide }
/** Coordinates follow the floor grid: x runs along X at fixed Z; z runs along Z at fixed X. */
export interface PartitionWall { id: string; axis: 'x' | 'z'; line: number; start: number; end: number; color: string }
export interface InteriorDoor { id: string; wallId: string; offset: number; width: number; color: string; open: boolean }
export interface FloorCell { x: number; z: number }
export const MIN_FLOOR_COORD = -8
export const MAX_FLOOR_COORD = 15

export interface ShopItem {
  id: string
  kind: ItemKind
  x: number
  z: number
  rotation: Rotation
  color: string
  stock: ProductKind
  width?: number
  depth?: number
  /** Automatically created roof access; ordinary floor-to-floor stairs stay independent. */
  roofAccess?: boolean
}

export interface ShopDocument {
  version: 1 | 2
  name: string
  width: number
  depth: number
  wallColor: string
  floorColor: string
  items: ShopItem[]
  wallHeight?: number
  entrance?: Entrance
  floorCells?: FloorCell[]
  wallItems?: WallItem[]
  partitions?: PartitionWall[]
  interiorDoors?: InteriorDoor[]
  /** Floors above the ground floor, ordered from level two through four. */
  upperFloors?: ShopDocument[]
  roof?: RoofDesign
  /** Furniture on the outdoor deck above the top interior floor. */
  rooftop?: RooftopDesign
  exterior?: ExteriorDesign
}

export interface RoofDesign { style: 'tiles' | 'rooftop'; color: string; garden: boolean; stairAccess?: 'open' | 'enclosed'; stairDoors?: Record<string, boolean> }
export interface RooftopDesign { items: ShopItem[]; floorColor: string }
export interface ExteriorDesign { wallColor: string; trimColor: string; awning: boolean; wallMaterial?: 'plaster' | 'brick' }
export const MAX_LEVELS = 4

export interface CatalogEntry {
  kind: ItemKind
  name: string
  description: string
  width: number
  depth: number
  color: string
  stockable: boolean
}

export const CATALOG: CatalogEntry[] = [
  { kind: 'shelf', name: 'Rak pajang', description: 'Rak kayu untuk buku, piring, dan temuan kecil.', width: 2, depth: 1, color: '#BC8F69', stockable: true },
  { kind: 'table', name: 'Meja pajang', description: 'Tempat utama koleksi pilihanmu.', width: 2, depth: 2, color: '#D3AE87', stockable: true },
  { kind: 'counter', name: 'Meja kasir', description: 'Sudut sambutan untuk pengunjung toko.', width: 2, depth: 1, color: '#9E83BC', stockable: false },
  { kind: 'rack', name: 'Gantungan baju', description: 'Pajang pakaian dan aksesori favorit.', width: 2, depth: 1, color: '#7E6995', stockable: true },
  { kind: 'plant', name: 'Tanaman', description: 'Sedikit hijau membuat ruangan terasa hidup.', width: 1, depth: 1, color: '#BD9679', stockable: false },
  { kind: 'rug', name: 'Karpet', description: 'Lapisan lembut yang bisa berada di bawah furnitur.', width: 2, depth: 2, color: '#C7B4DF', stockable: false },
  { kind: 'lamp', name: 'Lampu lantai', description: 'Cahaya hangat untuk sudut yang nyaman.', width: 1, depth: 1, color: '#EADBC2', stockable: false },
  { kind: 'stool', name: 'Bangku', description: 'Tempat singgah kecil di sela koleksi.', width: 1, depth: 1, color: '#B58C65', stockable: false },
  { kind: 'chalkboard', name: 'Papan kapur', description: 'Papan sambutan yang bisa dipindah ke trotoar depan.', width: 1, depth: 1, color: '#BC8F69', stockable: false },
  { kind: 'poster-stand', name: 'Poster berdiri', description: 'Bingkai poster untuk menampilkan cerita tokomu.', width: 1, depth: 1, color: '#9E83BC', stockable: false },
  { kind: 'direction-sign', name: 'Papan petunjuk', description: 'Penanda arah kecil untuk menyambut pengunjung.', width: 1, depth: 1, color: '#C69972', stockable: false },
  { kind: 'glass-cabinet', name: 'Vitrin kaca', description: 'Lemari kaca untuk koleksi istimewa dan produk pilihan.', width: 2, depth: 1, color: '#B79FC9', stockable: true },
  { kind: 'display-plinth', name: 'Podium pajang', description: 'Panggung kecil untuk satu kelompok produk unggulan.', width: 1, depth: 1, color: '#CAB48E', stockable: true },
  { kind: 'pegboard', name: 'Rak aksesori', description: 'Pajang tas, pernak-pernik, dan koleksi kecil dengan rapi.', width: 2, depth: 1, color: '#C9AB83', stockable: true },
  { kind: 'food-display', name: 'Etalase makanan', description: 'Etalase untuk roti, kue, dan sajian pilihan.', width: 2, depth: 1, color: '#BFA18A', stockable: true },
  { kind: 'drinks-fridge', name: 'Kulkas minuman', description: 'Pajangan dingin untuk minuman dan makanan siap saji.', width: 1, depth: 1, color: '#A8BDB9', stockable: true },
  { kind: 'coffee-station', name: 'Bar kopi', description: 'Sudut meracik kopi untuk kedai yang hangat.', width: 2, depth: 1, color: '#B4937B', stockable: false },
  { kind: 'prep-counter', name: 'Meja persiapan', description: 'Meja kerja untuk menata bahan dan menyiapkan pesanan.', width: 2, depth: 1, color: '#C0C5BE', stockable: false },
  { kind: 'stove', name: 'Kompor & oven', description: 'Perlengkapan memasak untuk dapur kecilmu.', width: 2, depth: 1, color: '#747785', stockable: false },
  { kind: 'sink', name: 'Bak cuci', description: 'Tempat mencuci dan merapikan perlengkapan dapur.', width: 2, depth: 1, color: '#B5C8C4', stockable: false },
  { kind: 'dining-table', name: 'Meja makan', description: 'Tempat menikmati hidangan di dalam kedai.', width: 2, depth: 2, color: '#C5A37C', stockable: false },
  { kind: 'service-cart', name: 'Troli saji', description: 'Troli ringkas untuk makanan dan minuman siap diantar.', width: 1, depth: 1, color: '#BFA6C9', stockable: true },
  { kind: 'stairs', name: 'Tangga', description: 'Tangga dengan pegangan untuk menghubungkan lantai toko.', width: 2, depth: 3, color: '#BB9775', stockable: false },
  { kind: 'canopy', name: 'Tenda kanopi', description: 'Naungan kain untuk meja dan kursi. Panjang dan lebarnya bisa diatur.', width: 3, depth: 3, color: '#B7A1CE', stockable: false },
  { kind: 'patio-umbrella', name: 'Payung taman', description: 'Payung outdoor dengan tiang di samping, bisa diperlebar.', width: 3, depth: 3, color: '#D9B58A', stockable: false },
  { kind: 'warehouse-rack', name: 'Rak gudang', description: 'Rak penyimpanan tinggi dengan kardus stok yang tertata rapi.', width: 2, depth: 1, color: '#7E9E9C', stockable: false },
  { kind: 'bathroom', name: 'WC / kamar mandi', description: 'Kamar mandi kecil dengan toilet, wastafel, dan dinding privasi.', width: 2, depth: 2, color: '#B4CDC8', stockable: false },
  { kind: 'toilet', name: 'Toilet', description: 'Toilet terpisah untuk kamar mandi yang kamu tata sendiri.', width: 1, depth: 1, color: '#F4F0E5', stockable: false },
  { kind: 'washbasin', name: 'Wastafel', description: 'Wastafel ringkas untuk mencuci tangan.', width: 1, depth: 1, color: '#A9BEAD', stockable: false },
  { kind: 'shower', name: 'Shower', description: 'Area shower yang bisa ditempatkan dan diputar sendiri.', width: 1, depth: 1, color: '#A8C7C3', stockable: false },
]

export const FOOD_ITEM_KINDS: readonly ItemKind[] = Object.freeze([
  'food-display', 'drinks-fridge', 'coffee-station', 'prep-counter', 'stove', 'sink', 'dining-table', 'service-cart', 'counter', 'stool',
])

export const FOOD_PRODUCTS: readonly ProductKind[] = Object.freeze(['bread', 'pastries', 'drinks', 'fruit', 'meals', 'snacks'])

export const WALL_CATALOG: WallCatalogEntry[] = [
  { kind: 'window', name: 'Jendela', description: 'Bukaan berbingkai untuk cahaya alami.', width: 2.2, height: 1.4, depth: 0.16, color: '#F5EAD6' },
  { kind: 'wall-lamp', name: 'Lampu dinding', description: 'Cahaya hangat untuk sudut pilihanmu.', width: 0.45, height: 0.7, depth: 0.3, color: '#BC9870' },
  { kind: 'wall-shelf', name: 'Rak buku tempel', description: 'Rak kecil yang menempel pada dinding.', width: 1.5, height: 0.85, depth: 0.35, color: '#BC8F69' },
  { kind: 'painting', name: 'Lukisan', description: 'Sentuhan warna untuk menceritakan tokomu.', width: 0.9, height: 1.1, depth: 0.08, color: '#B498C4' },
  { kind: 'wall-sign', name: 'Papan nama', description: 'Tulisan pilihanmu untuk ruangan atau fasad toko.', width: 1.6, height: 0.55, depth: 0.1, color: '#C69972' },
  { kind: 'wall-clock', name: 'Jam dinding', description: 'Jarumnya mengikuti waktu di tokomu.', width: 0.7, height: 0.7, depth: 0.12, color: '#B98D64' },
]

export const WINDOW_STYLES: { id: WindowStyle; label: string }[] = [
  { id: 'classic', label: 'Klasik' },
  { id: 'picture', label: 'Panoramik' },
  { id: 'grid', label: 'Kisi-kisi' },
  { id: 'sliding', label: 'Geser' },
  { id: 'arched', label: 'Lengkung' },
]

export const WALL_LAMP_STYLES: { id: WallLampStyle; label: string }[] = [
  { id: 'sconce', label: 'Kap klasik' },
  { id: 'lantern', label: 'Lentera' },
  { id: 'bulkhead', label: 'Lampu oval' },
]

export const WALL_SIGN_STYLES: { id: WallSignStyle; label: string }[] = [
  { id: 'plaque', label: 'Papan kayu' },
  { id: 'fascia', label: 'Papan toko besar' },
  { id: 'projecting', label: 'Papan menjorok' },
]

// Internal copies keep validation independent from presentation code using CATALOG.
const catalogByKind = Object.freeze(Object.fromEntries(CATALOG.map(entry => [entry.kind, Object.freeze({ ...entry })]))) as Readonly<Record<ItemKind, CatalogEntry>>
const wallCatalogByKind = Object.freeze(Object.fromEntries(WALL_CATALOG.map(entry => [entry.kind, Object.freeze({ ...entry })]))) as Readonly<Record<WallItemKind, WallCatalogEntry>>
const windowStyles: ReadonlySet<string> = new Set(WINDOW_STYLES.map(style => style.id))
const wallLampStyles: ReadonlySet<string> = new Set(WALL_LAMP_STYLES.map(style => style.id))
const wallSignStyles: ReadonlySet<string> = new Set(WALL_SIGN_STYLES.map(style => style.id))
const rotations: readonly number[] = [0, 90, 180, 270]
const stocks: readonly ProductKind[] = Object.freeze(['books', 'ceramics', 'plants', 'fashion', 'vinyl', 'shoes', 'bags', 'skincare', 'toys', ...FOOD_PRODUCTS, 'none'])
const foodStocks: readonly ProductKind[] = Object.freeze([...FOOD_PRODUCTS, 'none'])
const fridgeStocks: readonly ProductKind[] = Object.freeze(['drinks', 'fruit', 'meals', 'snacks', 'none'])
const noStocks: readonly ProductKind[] = Object.freeze(['none'])
const initialStocks: Readonly<Partial<Record<ItemKind, ProductKind>>> = Object.freeze({
  shelf: 'books', table: 'ceramics', rack: 'fashion', 'glass-cabinet': 'books', 'display-plinth': 'ceramics',
  pegboard: 'bags', 'food-display': 'pastries', 'drinks-fridge': 'drinks', 'service-cart': 'meals',
})
const itemKeys = ['id', 'kind', 'x', 'z', 'rotation', 'color', 'stock'] as const
const optionalItemKeys = ['width', 'depth', 'roofAccess'] as const
const allowedItemKeys = [...itemKeys, ...optionalItemKeys] as const
const documentKeys = ['version', 'name', 'width', 'depth', 'wallColor', 'floorColor', 'items'] as const
const optionalDocumentKeys = ['wallHeight', 'entrance', 'floorCells', 'wallItems', 'partitions', 'interiorDoors'] as const
const buildingDocumentKeys = ['upperFloors', 'roof', 'rooftop', 'exterior'] as const
const wallItemKeys = ['id', 'kind', 'wall', 'line', 'offset', 'height', 'color', 'text', 'lit'] as const
const optionalWallItemKeys = ['width', 'sizeHeight', 'windowStyle', 'mount', 'wallLampStyle', 'wallSignStyle'] as const
const allowedWallItemKeys = [...wallItemKeys, ...optionalWallItemKeys] as const
const MAX_WALL_ITEMS = 60
const MAX_ITEMS = 200
const MAX_PARTITIONS = 80
const MAX_INTERIOR_DOORS = 80
const partitionKeys = ['id', 'axis', 'line', 'start', 'end', 'color'] as const
const interiorDoorKeys = ['id', 'wallId', 'offset', 'width', 'color', 'open'] as const
const wallSides: readonly WallSide[] = ['back', 'left', 'front', 'right']
const MAX_JSON_LENGTH = 128_000 * (MAX_LEVELS + 1)
const own = (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key)

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value)
  return actual.length === keys.length && actual.every(key => typeof key === 'string' && keys.includes(key))
}

function keysWithOptional(value: Record<string, unknown>, required: readonly string[], optional: readonly string[]): boolean {
  return required.every(key => own(value, key))
    && Reflect.ownKeys(value).every(key => typeof key === 'string' && (required.includes(key) || optional.includes(key)))
}

function isItemDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 24
}

function isWallDimension(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.3 && value <= max
}

function isDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 4 && value <= 10
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function isStairDoorState(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Reflect.ownKeys(value).length <= MAX_ITEMS
    && Reflect.ownKeys(value).every(key => typeof key === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(key) && typeof value[key] === 'boolean')
}

function isRoofDesign(value: unknown): value is RoofDesign {
  return isRecord(value) && keysWithOptional(value, ['style', 'color', 'garden'], ['stairAccess', 'stairDoors'])
    && (value.style === 'tiles' || value.style === 'rooftop') && isColor(value.color) && typeof value.garden === 'boolean'
    && (!own(value, 'stairAccess') || value.stairAccess === 'open' || value.stairAccess === 'enclosed')
    && (!own(value, 'stairDoors') || isStairDoorState(value.stairDoors))
}

function isExteriorDesign(value: unknown): value is ExteriorDesign {
  return isRecord(value) && keysWithOptional(value, ['wallColor', 'trimColor', 'awning'], ['wallMaterial'])
    && isColor(value.wallColor) && isColor(value.trimColor) && typeof value.awning === 'boolean'
    && (!own(value, 'wallMaterial') || value.wallMaterial === 'plaster' || value.wallMaterial === 'brick')
}

function isWallHeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 2.3 && value <= 4.5
}

function isEntrance(value: unknown): value is Entrance {
  return isRecord(value) && keysWithOptional(value, ['position', 'open'], ['rotation', 'wall'])
    && typeof value.position === 'number' && Number.isFinite(value.position)
    && value.position >= 0 && value.position <= 1 && typeof value.open === 'boolean'
    && (!own(value, 'rotation') || (typeof value.rotation === 'number' && rotations.includes(value.rotation)))
    && (!own(value, 'wall') || wallSides.includes(value.wall as WallSide))
}

function isFloorCell(value: unknown): value is FloorCell {
  return isRecord(value) && exactKeys(value, ['x', 'z'])
    && typeof value.x === 'number' && Number.isInteger(value.x) && value.x >= MIN_FLOOR_COORD && value.x <= MAX_FLOOR_COORD
    && typeof value.z === 'number' && Number.isInteger(value.z) && value.z >= MIN_FLOOR_COORD && value.z <= MAX_FLOOR_COORD
}

export function getFloorCells(doc: ShopDocument): FloorCell[] {
  return doc.floorCells ? doc.floorCells.map(cell => ({ ...cell }))
    : Array.from({ length: doc.width * doc.depth }, (_, index) => ({ x: index % doc.width, z: Math.floor(index / doc.width) }))
}

export function hasFloorCell(doc: ShopDocument, x: number, z: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(z)) return false
  return doc.floorCells ? doc.floorCells.some(cell => cell.x === x && cell.z === z)
    : x >= 0 && z >= 0 && x < doc.width && z < doc.depth
}

export function getFloorBounds(doc: ShopDocument) {
  const cells = getFloorCells(doc)
  // An unbuilt plot retains a finite work area for the camera and first-tile grid.
  if (!cells.length) return { minX: 0, minZ: 0, maxX: doc.width - 1, maxZ: doc.depth - 1, width: doc.width, depth: doc.depth }
  const minX = Math.min(...cells.map(cell => cell.x))
  const minZ = Math.min(...cells.map(cell => cell.z))
  const maxX = Math.max(...cells.map(cell => cell.x))
  const maxZ = Math.max(...cells.map(cell => cell.z))
  return { minX, minZ, maxX, maxZ, width: maxX - minX + 1, depth: maxZ - minZ + 1 }
}

export function isStandingSign(kind: ItemKind): boolean {
  return kind === 'chalkboard' || kind === 'poster-stand' || kind === 'direction-sign'
}

/** Inclusive grid search bounds; canPlace still checks actual floor cells and holes. */
export function getItemPlacementBounds(doc: ShopDocument, kind: ItemKind): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const { minX, maxX, minZ, maxZ } = getFloorBounds(doc)
  return { minX, maxX, minZ, maxZ: isStandingSign(kind) && doc.floorCells?.length !== 0 ? Math.min(MAX_FLOOR_COORD, maxZ + 2) : maxZ }
}

export function wallIsHorizontal(wall: WallSide): boolean { return wall === 'back' || wall === 'front' }
export function getWallSideLabel(wall: WallSide): string {
  return { back: 'Belakang', left: 'Kiri', front: 'Depan', right: 'Kanan' }[wall]
}

export function getWallRuns(doc: ShopDocument): WallRun[] {
  const cells = getFloorCells(doc)
  const occupied = new Set(cells.map(cell => `${cell.x},${cell.z}`))
  const result: WallRun[] = []
  for (const wall of wallSides) {
    const lines = new Map<number, number[]>()
    const horizontal = wallIsHorizontal(wall)
    const dx = wall === 'left' ? -1 : wall === 'right' ? 1 : 0
    const dz = wall === 'back' ? -1 : wall === 'front' ? 1 : 0
    for (const cell of cells) {
      if (occupied.has(`${cell.x + dx},${cell.z + dz}`)) continue
      const line = horizontal ? cell.z + (dz > 0 ? 1 : 0) : cell.x + (dx > 0 ? 1 : 0)
      const values = lines.get(line) ?? []
      values.push(horizontal ? cell.x : cell.z)
      lines.set(line, values)
    }
    for (const [line, values] of [...lines].sort(([a], [b]) => a - b)) {
      values.sort((a, b) => a - b)
      let start = values[0]
      let end = start + 1
      for (const value of values.slice(1)) {
        if (value !== end) { result.push({ wall, line, start, end }); start = value }
        end = value + 1
      }
      result.push({ wall, line, start, end })
    }
  }
  return result
}

function isWallItem(value: unknown): value is WallItem {
  if (!isRecord(value) || !keysWithOptional(value, wallItemKeys, optionalWallItemKeys)) return false
  if (own(value, 'width') && !isWallDimension(value.width, 24)) return false
  if (own(value, 'sizeHeight') && !isWallDimension(value.sizeHeight, 4.5)) return false
  if (own(value, 'windowStyle') && (value.kind !== 'window' || typeof value.windowStyle !== 'string' || !windowStyles.has(value.windowStyle))) return false
  if (own(value, 'mount') && value.mount !== 'interior' && value.mount !== 'exterior') return false
  if (own(value, 'wallLampStyle') && (value.kind !== 'wall-lamp' || typeof value.wallLampStyle !== 'string' || !wallLampStyles.has(value.wallLampStyle))) return false
  if (own(value, 'wallSignStyle') && (value.kind !== 'wall-sign' || typeof value.wallSignStyle !== 'string' || !wallSignStyles.has(value.wallSignStyle))) return false
  return typeof value.id === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value.id)
    && typeof value.kind === 'string' && own(wallCatalogByKind, value.kind)
    && wallSides.includes(value.wall as WallSide)
    && typeof value.line === 'number' && Number.isInteger(value.line) && value.line >= MIN_FLOOR_COORD && value.line <= MAX_FLOOR_COORD + 1
    && typeof value.offset === 'number' && Number.isFinite(value.offset) && value.offset >= MIN_FLOOR_COORD && value.offset <= MAX_FLOOR_COORD + 1
    && typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0 && value.height <= 4.5
    && isColor(value.color) && typeof value.text === 'string' && value.text.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value.text)
    && typeof value.lit === 'boolean'
}

/** Accessory dimensions; mounting height remains item.height and depth is catalog-defined. */
export function getWallItemSize(item: WallItem): { width: number; height: number; depth: number } {
  const entry = wallCatalogByKind[item.kind]
  const width = item.width ?? entry.width
  const depth = item.kind === 'wall-sign' && getWallSignStyle(item) === 'projecting' ? Math.max(0.3, width * 0.45)
    : item.kind === 'wall-sign' && getWallSignStyle(item) === 'fascia' ? 0.16 : entry.depth
  return { width, height: item.sizeHeight ?? entry.height, depth }
}

/** Old windows retain their original appearance without materializing a new field. */
export function getWindowStyle(item: WallItem): WindowStyle {
  return item.windowStyle ?? 'classic'
}

/** Windows remain one shared opening, regardless of the view used to edit them. */
export function getWallItemMount(item: WallItem): WallItemMount { return item.kind === 'window' ? 'interior' : item.mount ?? 'interior' }
export function getWallLampStyle(item: WallItem): WallLampStyle { return item.wallLampStyle ?? 'sconce' }
export function getWallSignStyle(item: WallItem): WallSignStyle { return item.wallSignStyle ?? 'plaque' }

const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)
const gridCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= MIN_FLOOR_COORD && value <= MAX_FLOOR_COORD + 1
const layoutId = (prefix: string) => globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now().toString(36)}-${(++fallbackId).toString(36)}`

export function getPartitions(doc: ShopDocument): PartitionWall[] { return doc.partitions?.map(wall => ({ ...wall })) ?? [] }
export function getInteriorDoors(doc: ShopDocument): InteriorDoor[] { return doc.interiorDoors?.map(door => ({ ...door })) ?? [] }

function isPartition(value: unknown): value is PartitionWall {
  return isRecord(value) && exactKeys(value, partitionKeys) && validId(value.id) && (value.axis === 'x' || value.axis === 'z')
    && gridCoordinate(value.line) && gridCoordinate(value.start) && gridCoordinate(value.end) && value.end > value.start && isColor(value.color)
}

function isInteriorDoor(value: unknown): value is InteriorDoor {
  return isRecord(value) && exactKeys(value, interiorDoorKeys) && validId(value.id) && validId(value.wallId)
    && typeof value.offset === 'number' && Number.isFinite(value.offset) && value.offset >= MIN_FLOOR_COORD && value.offset <= MAX_FLOOR_COORD + 1
    && typeof value.width === 'number' && Number.isFinite(value.width) && value.width >= 0.6 && value.width <= 2.4
    && isColor(value.color) && typeof value.open === 'boolean'
}

function partitionCrossesItem(wall: PartitionWall, item: ShopItem): boolean {
  if (item.kind === 'rug') return false
  const size = getItemFootprint(item)
  return wall.axis === 'x'
    ? wall.line > item.z && wall.line < item.z + size.depth && wall.start < item.x + size.width && wall.end > item.x
    : wall.line > item.x && wall.line < item.x + size.width && wall.start < item.z + size.depth && wall.end > item.z
}

export function getPartitionPosition(doc: ShopDocument, wall: PartitionWall): { x: number; z: number; rotation: number; length: number } {
  return { x: (wall.axis === 'x' ? (wall.start + wall.end) / 2 : wall.line) - doc.width / 2,
    z: (wall.axis === 'z' ? (wall.start + wall.end) / 2 : wall.line) - doc.depth / 2,
    rotation: wall.axis === 'x' ? 0 : Math.PI / 2, length: wall.end - wall.start }
}

export function getInteriorDoorSize(doc: ShopDocument, door: InteriorDoor): { width: number; height: number; depth: number } {
  return { width: door.width, height: Math.min(2.1, getWallHeight(doc) - 0.1), depth: 0.14 }
}

export function getInteriorDoorPosition(doc: ShopDocument, door: InteriorDoor): { x: number; z: number; rotation: number } | null {
  const wall = doc.partitions?.find(wall => wall.id === door.wallId)
  if (!wall) return null
  return { x: (wall.axis === 'x' ? door.offset : wall.line) - doc.width / 2,
    z: (wall.axis === 'z' ? door.offset : wall.line) - doc.depth / 2, rotation: wall.axis === 'x' ? 0 : Math.PI / 2 }
}

export function canPlaceInteriorDoor(doc: ShopDocument, door: InteriorDoor, ignoreId?: string): boolean {
  if (!isInteriorDoor(door) || doc.items.some(item => item.id === door.id) || getWallItems(doc).some(item => item.id === door.id)
    || doc.partitions?.some(wall => wall.id === door.id)) return false
  const wall = doc.partitions?.find(wall => wall.id === door.wallId)
  if (!wall || door.offset - door.width / 2 < wall.start - 0.000001 || door.offset + door.width / 2 > wall.end + 0.000001) return false
  if (doc.interiorDoors?.some(other => other.id !== ignoreId && (other.id === door.id
    || (other.wallId === door.wallId && Math.abs(other.offset - door.offset) < (other.width + door.width) / 2 - 0.000001)))) return false
  return !(doc.partitions ?? []).some(other => other.axis !== wall.axis
    && other.start < wall.line + 0.000001 && other.end > wall.line - 0.000001
    && other.line > door.offset - door.width / 2 - 0.000001 && other.line < door.offset + door.width / 2 + 0.000001)
}

export function canPlacePartition(doc: ShopDocument, wall: PartitionWall, ignoreId?: string): boolean {
  if (!isPartition(wall) || doc.items.some(item => item.id === wall.id) || getWallItems(doc).some(item => item.id === wall.id)
    || doc.interiorDoors?.some(door => door.id === wall.id)) return false
  if (doc.partitions?.some(other => other.id !== ignoreId && (other.id === wall.id
    || (other.axis === wall.axis && other.line === wall.line && other.start < wall.end && other.end > wall.start)))) return false
  for (let along = wall.start; along < wall.end; along++) {
    if (wall.axis === 'x' ? !hasFloorCell(doc, along, wall.line - 1) || !hasFloorCell(doc, along, wall.line)
      : !hasFloorCell(doc, wall.line - 1, along) || !hasFloorCell(doc, wall.line, along)) return false
  }
  if (doc.items.some(item => partitionCrossesItem(wall, item))) return false
  const candidate = { ...doc, partitions: [...(doc.partitions ?? []).filter(other => other.id !== ignoreId), wall] }
  return (doc.interiorDoors ?? []).every(door => canPlaceInteriorDoor(candidate, door, door.id))
}

export function findPartitionPlacement(doc: ShopDocument, preferred: Partial<PartitionWall> = {}): PartitionWall | null {
  if (!isRecord(preferred) || Reflect.ownKeys(preferred).some(key => typeof key !== 'string' || !partitionKeys.includes(key as typeof partitionKeys[number]))) return null
  const wanted: PartitionWall = { id: layoutId('partition'), axis: 'z', line: Math.round(doc.width / 2), start: 1, end: 4, color: doc.wallColor, ...preferred }
  if (!isPartition(wanted)) return null
  if (canPlacePartition(doc, wanted, wanted.id)) return wanted
  const length = wanted.end - wanted.start, bounds = getFloorBounds(doc)
  const candidates: PartitionWall[] = []
  for (const axis of [wanted.axis, wanted.axis === 'x' ? 'z' : 'x'] as const) {
    const minLine = (axis === 'x' ? bounds.minZ : bounds.minX) + 1, maxLine = axis === 'x' ? bounds.maxZ : bounds.maxX
    const minAlong = axis === 'x' ? bounds.minX : bounds.minZ, maxAlong = (axis === 'x' ? bounds.maxX : bounds.maxZ) + 1
    for (let span = length; span >= 1; span--) for (let line = minLine; line <= maxLine; line++) for (let start = minAlong; start + span <= maxAlong; start++) {
      candidates.push({ ...wanted, axis, line, start, end: start + span })
    }
  }
  candidates.sort((a, b) => ((a.axis === wanted.axis ? 0 : 1000) + Math.abs(a.end - a.start - length) * 100 + Math.abs(a.line - wanted.line) + Math.abs(a.start - wanted.start))
    - ((b.axis === wanted.axis ? 0 : 1000) + Math.abs(b.end - b.start - length) * 100 + Math.abs(b.line - wanted.line) + Math.abs(b.start - wanted.start)))
  return candidates.find(wall => canPlacePartition(doc, wall, wall.id)) ?? null
}

export function createPartition(doc: ShopDocument): PartitionWall | null { return findPartitionPlacement(doc) }

export function placePartition(doc: ShopDocument, wall: PartitionWall): ShopDocument {
  if ((doc.partitions?.length ?? 0) >= MAX_PARTITIONS || !canPlacePartition(doc, wall)) return doc
  return { ...doc, partitions: [...getPartitions(doc), { ...wall }] }
}

export function updatePartition(doc: ShopDocument, id: string, patch: Partial<PartitionWall>): ShopDocument {
  const current = doc.partitions?.find(wall => wall.id === id)
  if (!current || !isRecord(patch) || Reflect.ownKeys(patch).some(key => typeof key !== 'string' || !partitionKeys.includes(key as typeof partitionKeys[number]))
    || (own(patch, 'id') && patch.id !== id)) return doc
  const candidate = { ...current, ...patch }
  if (!canPlacePartition(doc, candidate, id) || partitionKeys.every(key => candidate[key] === current[key])) return doc
  return { ...doc, partitions: doc.partitions!.map(wall => wall.id === id ? candidate : wall) }
}

export function removePartition(doc: ShopDocument, id: string): ShopDocument {
  if (!doc.partitions?.some(wall => wall.id === id)) return doc
  return { ...doc, partitions: doc.partitions.filter(wall => wall.id !== id),
    ...(doc.interiorDoors ? { interiorDoors: doc.interiorDoors.filter(door => door.wallId !== id) } : {}) }
}

export function createInteriorDoor(doc: ShopDocument, wallId: string): InteriorDoor | null {
  const wall = doc.partitions?.find(wall => wall.id === wallId)
  if (!wall) return null
  const width = Math.min(1, wall.end - wall.start), id = layoutId('door')
  const offsets = Array.from({ length: Math.floor((wall.end - wall.start - width) * 10) + 1 }, (_, index) => wall.start + width / 2 + index / 10)
    .sort((a, b) => Math.abs(a - (wall.start + wall.end) / 2) - Math.abs(b - (wall.start + wall.end) / 2))
  for (const offset of offsets) {
    const door: InteriorDoor = { id, wallId, offset: snapWall(offset), width, color: '#B697B8', open: false }
    if (canPlaceInteriorDoor(doc, door)) return door
  }
  return null
}

export function placeInteriorDoor(doc: ShopDocument, door: InteriorDoor): ShopDocument {
  if ((doc.interiorDoors?.length ?? 0) >= MAX_INTERIOR_DOORS || !canPlaceInteriorDoor(doc, door)) return doc
  return { ...doc, interiorDoors: [...getInteriorDoors(doc), { ...door }] }
}

export function updateInteriorDoor(doc: ShopDocument, id: string, patch: Partial<InteriorDoor>): ShopDocument {
  const current = doc.interiorDoors?.find(door => door.id === id)
  if (!current || !isRecord(patch) || Reflect.ownKeys(patch).some(key => typeof key !== 'string' || !interiorDoorKeys.includes(key as typeof interiorDoorKeys[number]))
    || (own(patch, 'id') && patch.id !== id)) return doc
  const candidate = { ...current, ...patch }
  if (!isInteriorDoor(candidate)) return doc
  candidate.offset = snapWall(candidate.offset); candidate.width = snapWall(candidate.width)
  if (!canPlaceInteriorDoor(doc, candidate, id) || interiorDoorKeys.every(key => candidate[key] === current[key])) return doc
  return { ...doc, interiorDoors: doc.interiorDoors!.map(door => door.id === id ? candidate : door) }
}

export function removeInteriorDoor(doc: ShopDocument, id: string): ShopDocument {
  return doc.interiorDoors?.some(door => door.id === id) ? { ...doc, interiorDoors: doc.interiorDoors.filter(door => door.id !== id) } : doc
}

function validPartitions(doc: ShopDocument): boolean {
  return (doc.partitions ?? []).every(wall => canPlacePartition(doc, wall, wall.id))
    && (doc.interiorDoors ?? []).every(door => canPlaceInteriorDoor(doc, door, door.id))
}

function wallItemsOverlap(a: WallItem, b: WallItem): boolean {
  if (a.wall !== b.wall || a.line !== b.line) return false
  if (a.kind !== 'window' && b.kind !== 'window' && getWallItemMount(a) !== getWallItemMount(b)) return false
  const first = getWallItemSize(a)
  const second = getWallItemSize(b)
  return Math.abs(a.offset - b.offset) < (first.width + second.width) / 2 - 0.000001
    && Math.abs(a.height - b.height) < (first.height + second.height) / 2 - 0.000001
}

function fitsWallItem(doc: ShopDocument, item: WallItem, existing: WallItem[], runs: WallRun[], ignoreId?: string): boolean {
  if (!isWallItem(item) || doc.items.some(furniture => furniture.id === item.id)
    || doc.partitions?.some(wall => wall.id === item.id) || doc.interiorDoors?.some(door => door.id === item.id)) return false
  const size = getWallItemSize(item)
  if (item.height - size.height / 2 < -0.000001 || item.height + size.height / 2 > getWallHeight(doc) + 0.000001) return false
  if (!runs.some(run => run.wall === item.wall && run.line === item.line
    && item.offset - size.width / 2 >= run.start - 0.000001 && item.offset + size.width / 2 <= run.end + 0.000001)) return false
  return existing.every(other => other.id === ignoreId || (other.id !== item.id && !wallItemsOverlap(item, other)))
}

export function wallItemPosition(doc: ShopDocument, item: WallItem): { x: number; y: number; z: number; rotation: number } {
  const horizontal = wallIsHorizontal(item.wall)
  const exterior = getWallItemMount(item) === 'exterior'
  const inward = (item.wall === 'back' || item.wall === 'left' ? 1 : -1) * (exterior ? -0.162 : 0.012)
  return {
    x: horizontal ? item.offset - doc.width / 2 : item.line - doc.width / 2 + inward,
    y: item.height,
    z: horizontal ? item.line - doc.depth / 2 + inward : item.offset - doc.depth / 2,
    rotation: { back: 0, left: Math.PI / 2, front: Math.PI, right: -Math.PI / 2 }[item.wall] + (exterior ? Math.PI : 0),
  }
}

export function createWallItem(kind: WallItemKind, shopName = 'Toko Kecilku'): WallItem {
  if (!own(wallCatalogByKind, kind)) throw new RangeError('Invalid wall accessory kind')
  const id = globalThis.crypto?.randomUUID?.() ?? `wall-${Date.now().toString(36)}-${(++fallbackId).toString(36)}`
  return { id, kind, wall: 'back', line: 0, offset: 1.5, height: 1.5, color: wallCatalogByKind[kind].color, text: kind === 'wall-sign' ? shopName.trim() || 'Toko Kecilku' : '', lit: kind === 'wall-lamp' }
}

/** Keep name signs in the same undo/save snapshot as the shop name. Custom messages stay independent. */
export function renameShop(doc: ShopDocument, name: string): ShopDocument {
  if (name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return doc
  const previousName = doc.name.trim() || 'Toko Kecilku'
  const signName = name.trim() || 'Toko Kecilku'
  let changed = false
  const wallItems = doc.wallItems?.map(item => {
    const originalExample = item.id === 'builtin-wall-sign'
      && ['Sudut Nemu', 'Sudut Cerita', 'Toko Kecilku'].includes(item.text.trim())
    if (item.kind !== 'wall-sign' || (!originalExample && item.text.trim() !== previousName) || item.text === signName) return item
    changed = true
    return { ...item, text: signName }
  })
  // The input can temporarily be empty while typing; saved upper floors still need valid names.
  const upperFloors = name !== doc.name ? doc.upperFloors?.map(level => renameShop(level, signName)) : doc.upperFloors
  if (name === doc.name && !changed) return doc
  return { ...doc, name, ...(changed ? { wallItems } : {}), ...(upperFloors ? { upperFloors } : {}) }
}

/** Old documents get only the decorative defaults that physically fit their contour. */
export function getWallItems(doc: ShopDocument): WallItem[] {
  if (doc.wallItems) return doc.wallItems.map(item => ({ ...item }))
  const result: ShopDocument = { ...doc, wallItems: [] }
  const runs = getWallRuns(doc)
  for (const [kind, wall, id] of [['window', 'left', 'builtin-window'], ['wall-sign', 'back', 'builtin-wall-sign']] as const) {
    const run = [...runs].filter(candidate => candidate.wall === wall).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]
    if (!run) continue
    const item: WallItem = {
      id, kind, wall, line: run.line, offset: (run.start + run.end) / 2,
      height: kind === 'window' ? 1.5 : getWallHeight(doc) - 0.35,
      color: wallCatalogByKind[kind].color, text: kind === 'wall-sign' ? doc.name : '', lit: false,
    }
    const placed = findWallPlacement(result, item, { wall, line: run.line })
    if (placed) result.wallItems!.push(placed)
  }
  return result.wallItems!
}

/** Live previews keep fractional positions; committed helpers below snap to a tenth. */
export function canPlaceWallItem(doc: ShopDocument, item: WallItem, ignoreId?: string): boolean {
  return fitsWallItem(doc, item, getWallItems(doc), getWallRuns(doc), ignoreId)
}

const snapWall = (value: number) => Math.round(value * 10) / 10

function snapWallItem(item: WallItem): WallItem {
  const result = { ...item, offset: snapWall(item.offset), height: snapWall(item.height) }
  if (own(item, 'width')) result.width = snapWall(item.width!)
  if (own(item, 'sizeHeight')) result.sizeHeight = snapWall(item.sizeHeight!)
  return result
}

export function findWallPlacement(doc: ShopDocument, item: WallItem, preferred: Partial<WallItem> = {}): WallItem | null {
  if (!isRecord(preferred) || Reflect.ownKeys(preferred).some(key => typeof key !== 'string' || !allowedWallItemKeys.includes(key as typeof allowedWallItemKeys[number]))) return null
  const proposed = { ...item, ...preferred, id: item.id }
  if (!isWallItem(proposed) || doc.items.some(furniture => furniture.id === proposed.id)
    || doc.partitions?.some(wall => wall.id === proposed.id) || doc.interiorDoors?.some(door => door.id === proposed.id)) return null
  const wanted = snapWallItem(proposed)
  const existing = getWallItems(doc).filter(other => other.id !== wanted.id)
  const size = getWallItemSize(wanted)
  const target = wallItemPosition(doc, wanted)
  const firstHeight = Math.ceil((size.height / 2 - 0.000001) * 10)
  const lastHeight = Math.floor((getWallHeight(doc) - size.height / 2 + 0.000001) * 10)
  if (lastHeight < firstHeight) return null
  const heights = Array.from({ length: lastHeight - firstHeight + 1 }, (_, i) => (firstHeight + i) / 10)
    .sort((a, b) => Math.abs(a - wanted.height) - Math.abs(b - wanted.height))
  let best: WallItem | null = null
  let bestTier = Infinity
  let bestDistance = Infinity
  for (const run of getWallRuns(doc)) {
    const preferredRun = (!own(preferred, 'wall') || run.wall === wanted.wall) && (!own(preferred, 'line') || (run.line === wanted.line && run.wall === wanted.wall))
    const tier = preferredRun ? 0 : 1
    if (tier > bestTier) continue
    const firstOffset = Math.ceil((run.start + size.width / 2 - 0.000001) * 10)
    const lastOffset = Math.floor((run.end - size.width / 2 + 0.000001) * 10)
    if (lastOffset < firstOffset) continue
    const axis = wallIsHorizontal(run.wall) ? target.x + doc.width / 2 : target.z + doc.depth / 2
    const offsets = Array.from({ length: lastOffset - firstOffset + 1 }, (_, i) => (firstOffset + i) / 10)
      .sort((a, b) => Math.abs(a - axis) - Math.abs(b - axis))
    const onWall = existing.filter(other => other.wall === run.wall && other.line === run.line)
    for (const offset of offsets) for (const height of heights) {
      const candidate = { ...wanted, wall: run.wall, line: run.line, offset, height }
      const position = wallItemPosition(doc, candidate)
      const distance = (position.x - target.x) ** 2 + (position.z - target.z) ** 2 + (height - wanted.height) ** 2 + (run.wall === wanted.wall ? 0 : 0.00000001)
      if (tier === bestTier && distance >= bestDistance) break
      if (onWall.some(other => wallItemsOverlap(candidate, other))) continue
      best = candidate; bestTier = tier; bestDistance = distance
    }
  }
  return best
}

export function placeWallItem(doc: ShopDocument, item: WallItem): ShopDocument {
  if (!isWallItem(item)) return doc
  const items = getWallItems(doc)
  const candidate = snapWallItem(item)
  if (items.length >= MAX_WALL_ITEMS || !fitsWallItem(doc, candidate, items, getWallRuns(doc))) return doc
  return { ...doc, wallItems: [...items, candidate] }
}

export function updateWallItem(doc: ShopDocument, id: string, patch: Partial<WallItem>): ShopDocument {
  const items = getWallItems(doc)
  const current = items.find(item => item.id === id)
  if (!current || !isRecord(patch) || Reflect.ownKeys(patch).some(key => typeof key !== 'string' || !allowedWallItemKeys.includes(key as typeof allowedWallItemKeys[number]))) return doc
  if (own(patch, 'id') && patch.id !== id) return doc
  const updated = { ...current, ...patch }
  if (!isWallItem(updated)) return doc
  const candidate = snapWallItem(updated)
  if (!fitsWallItem(doc, candidate, items, getWallRuns(doc), id)) return doc
  const size = getWallItemSize(candidate)
  const currentSize = getWallItemSize(current)
  if (wallItemKeys.every(key => candidate[key] === current[key]) && size.width === currentSize.width && size.height === currentSize.height
    && getWindowStyle(candidate) === getWindowStyle(current) && getWallItemMount(candidate) === getWallItemMount(current)
    && getWallLampStyle(candidate) === getWallLampStyle(current) && getWallSignStyle(candidate) === getWallSignStyle(current)) return doc
  return { ...doc, wallItems: items.map(item => item.id === id ? candidate : item) }
}

export function removeWallItem(doc: ShopDocument, id: string): ShopDocument {
  const items = getWallItems(doc)
  return items.some(item => item.id === id) ? { ...doc, wallItems: items.filter(item => item.id !== id) } : doc
}

/** Keep valid attachments fixed, then rehome affected ones without dropping any IDs. */
function reconcileWallItems(before: ShopDocument, after: ShopDocument): ShopDocument | null {
  const source = getWallItems(before)
  const runs = getWallRuns(after)
  const fixed = source.filter(item => fitsWallItem(after, item, source, runs, item.id))
  const placed = new Map(fixed.map(item => [item.id, item]))
  const pending = source.filter(item => !placed.has(item.id)).sort((a, b) => {
    const first = getWallItemSize(a); const second = getWallItemSize(b)
    return second.width * second.height - first.width * first.height
  })
  let candidate: ShopDocument = { ...after, wallItems: fixed }
  for (const item of pending) {
    const replacement = findWallPlacement(candidate, item)
    if (!replacement) return null
    placed.set(item.id, replacement)
    candidate = { ...candidate, wallItems: [...candidate.wallItems!, replacement] }
  }
  return { ...after, wallItems: source.map(item => ({ ...placed.get(item.id)! })) }
}

/** Bounds may move with the floor. Keep valid items fixed and rehome only affected signs. */
function reconcileStandingSigns(doc: ShopDocument): ShopDocument | null {
  const pending = doc.items.filter(item => !canPlace(doc, item, item.id)).sort((a, b) => {
    const first = getItemSize(a); const second = getItemSize(b)
    return second.width * second.depth - first.width * first.depth
  })
  if (!pending.length) return doc
  if (pending.some(item => !isStandingSign(item.kind))) return null
  const pendingIds = new Set(pending.map(item => item.id))
  let candidate = { ...doc, items: doc.items.filter(item => !pendingIds.has(item.id)) }
  const replacements = new Map<string, ShopItem>()
  for (const item of pending) {
    const bounds = getItemPlacementBounds(doc, item.kind)
    const positions: FloorCell[] = []
    for (let z = bounds.minZ; z <= bounds.maxZ; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) positions.push({ x, z })
    positions.sort((a, b) => (a.x - item.x) ** 2 + (a.z - item.z) ** 2 - (b.x - item.x) ** 2 - (b.z - item.z) ** 2)
    const position = positions.find(position => canPlace(candidate, { ...item, ...position }))
    if (!position) return null
    const replacement = { ...item, ...position }
    replacements.set(item.id, replacement)
    candidate = { ...candidate, items: [...candidate.items, replacement] }
  }
  return { ...doc, items: doc.items.map(item => replacements.get(item.id) ?? item) }
}

/** Coordinates retain their original anchor, so painting never moves existing furniture. */
export function paintFloor(doc: ShopDocument, stroke: FloorCell[], operation: 'add' | 'erase'): ShopDocument {
  if (!Array.isArray(stroke) || !['add', 'erase'].includes(operation)) return doc
  const cells = new Map(getFloorCells(doc).map(cell => [`${cell.x},${cell.z}`, cell]))
  let current = doc
  for (const cell of stroke) {
    if (!isFloorCell(cell)) continue
    const key = `${cell.x},${cell.z}`
    let changed = false
    if (operation === 'add') {
      if (!cells.has(key)) { cells.set(key, { ...cell }); changed = true }
    } else if (cells.has(key)) {
      const occupied = current.items.some(item => {
        const size = getItemFootprint(item)
        return cell.x >= item.x && cell.x < item.x + size.width && cell.z >= item.z && cell.z < item.z + size.depth
      })
      if (!occupied) { cells.delete(key); changed = true }
    }
    if (!changed) continue
    const withSigns = reconcileStandingSigns({ ...current, version: cells.size === 0 ? 2 : current.version, floorCells: [...cells.values()].sort((a,b) => a.z - b.z || a.x - b.x) })
    const candidate = withSigns && validPartitions(withSigns) ? reconcileWallItems(current, withSigns) : null
    if (candidate) current = candidate
    else if (operation === 'add') cells.delete(key)
    else cells.set(key, { ...cell })
  }
  return current
}

/** Find the selected facade on the actual contour, including concave and shifted floors. */
export function getEntranceAnchor(doc: ShopDocument): { x: number; z: number; width: number } {
  const bounds = getFloorBounds(doc)
  const wall = getEntranceWall(doc), horizontal = wallIsHorizontal(wall)
  const span = horizontal ? bounds.width : bounds.depth, min = horizontal ? bounds.minX : bounds.minZ
  const outer = { front: bounds.maxZ + 1, back: bounds.minZ, right: bounds.maxX + 1, left: bounds.minX }[wall]
  const margin = Math.min(1.1, span / 2)
  const desired = min + margin + getEntrance(doc).position * Math.max(0, span - 2 * margin)
  let best = { offset: desired, line: outer, width: 1.84, cost: Infinity }
  for (const run of getWallRuns(doc).filter(run => run.wall === wall)) {
    const length = run.end - run.start, inset = Math.min(1.1, length / 2)
    const offset = Math.max(run.start + inset, Math.min(run.end - inset, desired))
    const cost = Math.abs(offset - desired) + Math.abs(outer - run.line) * 0.001
    if (cost < best.cost) best = { offset, line: run.line, width: length >= 2 ? 1.84 : 0.85, cost }
  }
  const outward = wall === 'front' || wall === 'right' ? 0.09 : -0.09
  return {
    x: horizontal ? best.offset - doc.width / 2 : best.line - doc.width / 2 + outward,
    z: horizontal ? best.line - doc.depth / 2 + outward : best.offset - doc.depth / 2,
    width: best.width,
  }
}

export function getWallHeight(doc: ShopDocument): number { return doc.wallHeight ?? 2.75 }

export function getEntrance(doc: ShopDocument): Entrance {
  return doc.entrance ? { ...doc.entrance } : { position: 0.72, open: false }
}

export function getEntranceWall(doc: ShopDocument): WallSide { return doc.entrance?.wall ?? 'front' }

/** Effective world-facing rotation; saved rotation remains relative to the selected facade. */
export function getEntranceRotation(doc: ShopDocument): Rotation {
  const facing = { front: 0, right: 270, back: 180, left: 90 }[getEntranceWall(doc)]
  return ((facing + (doc.entrance?.rotation ?? 0)) % 360) as Rotation
}

export function setWallHeight(doc: ShopDocument, height: number): ShopDocument {
  if (!isWallHeight(height)) return doc
  const rounded = Math.round(height * 10) / 10
  return rounded === getWallHeight(doc) ? doc : reconcileWallItems(doc, { ...doc, wallHeight: rounded }) ?? doc
}

export function setEntrance(doc: ShopDocument, patch: Partial<Entrance>): ShopDocument {
  if (!isRecord(patch) || Reflect.ownKeys(patch).some(key => key !== 'position' && key !== 'open' && key !== 'rotation' && key !== 'wall')) return doc
  const current = getEntrance(doc)
  const next = { ...current, ...patch,
    ...(patch.wall !== undefined && patch.wall !== getEntranceWall(doc) && patch.rotation === undefined ? { rotation: 0 as Rotation } : {}),
  }
  if (!isEntrance(next)) return doc
  const position = Math.round(next.position * 1000) / 1000
  if (current.position === position && current.open === next.open && (current.rotation ?? 0) === (next.rotation ?? 0)
    && (current.wall ?? 'front') === (next.wall ?? 'front')) return doc
  return { ...doc, entrance: { ...next, position } }
}

function isKind(value: unknown): value is ItemKind {
  return typeof value === 'string' && own(catalogByKind, value)
}

/** Stock choices are shared by presentation and strict import/update validation. */
export function getAllowedStocks(kind: ItemKind): readonly ProductKind[] {
  if (!isKind(kind)) throw new RangeError('Invalid furniture kind')
  if (!catalogByKind[kind].stockable) return noStocks
  if (kind === 'food-display' || kind === 'service-cart') return foodStocks
  if (kind === 'drinks-fridge') return fridgeStocks
  return stocks
}

function isItem(value: unknown): value is ShopItem {
  if (!isRecord(value) || !keysWithOptional(value, itemKeys, optionalItemKeys)) return false
  if (own(value, 'width') && !isItemDimension(value.width)) return false
  if (own(value, 'depth') && !isItemDimension(value.depth)) return false
  if (own(value, 'roofAccess') && (value.kind !== 'stairs' || typeof value.roofAccess !== 'boolean')) return false
  if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value.id)) return false
  if (!isKind(value.kind) || !rotations.includes(value.rotation as number) || !isColor(value.color)) return false
  if (typeof value.x !== 'number' || !Number.isInteger(value.x) || value.x < MIN_FLOOR_COORD || value.x > MAX_FLOOR_COORD) return false
  if (typeof value.z !== 'number' || !Number.isInteger(value.z) || value.z < MIN_FLOOR_COORD || value.z > MAX_FLOOR_COORD) return false
  return typeof value.stock === 'string' && getAllowedStocks(value.kind).some(stock => stock === value.stock)
}

export function rotatedFootprint(kind: ItemKind, rotation: Rotation): { width: number; depth: number } {
  if (!isKind(kind) || !rotations.includes(rotation)) throw new RangeError('Invalid furniture kind or rotation')
  const entry = catalogByKind[kind]
  return rotation === 90 || rotation === 270
    ? { width: entry.depth, depth: entry.width }
    : { width: entry.width, depth: entry.depth }
}

/** Stored local dimensions, before rotation. Missing overrides retain the original catalog size. */
export function getItemSize(item: ShopItem): { width: number; depth: number } {
  const entry = catalogByKind[item.kind]
  return { width: item.width ?? entry.width, depth: item.depth ?? entry.depth }
}

export function getItemFootprint(item: ShopItem): { width: number; depth: number } {
  const size = getItemSize(item)
  return item.rotation === 90 || item.rotation === 270 ? { width: size.depth, depth: size.width } : size
}

export function isOutdoorCover(kind: ItemKind): boolean { return kind === 'canopy' || kind === 'patio-umbrella' }

export function canPlace(doc: ShopDocument, item: ShopItem, ignoreId?: string): boolean {
  if (!isDimension(doc.width) || !isDimension(doc.depth) || !Array.isArray(doc.items) || !isItem(item)) return false
  if (doc.floorCells?.length === 0) return false
  if (doc.wallItems?.some(accessory => accessory.id === item.id)) return false
  if (doc.partitions?.some(wall => wall.id === item.id || partitionCrossesItem(wall, item))
    || doc.interiorDoors?.some(door => door.id === item.id)) return false
  const footprint = getItemFootprint(item)
  const bounds = isStandingSign(item.kind) ? getFloorBounds(doc) : null
  let allFloor = true
  let allSidewalk = Boolean(bounds)
  for (let x = item.x; x < item.x + footprint.width; x++) for (let z = item.z; z < item.z + footprint.depth; z++) {
    if (x < MIN_FLOOR_COORD || x > MAX_FLOOR_COORD || z < MIN_FLOOR_COORD || z > MAX_FLOOR_COORD) return false
    allFloor = allFloor && hasFloorCell(doc, x, z)
    allSidewalk = allSidewalk && Boolean(bounds && x >= bounds.minX && x <= bounds.maxX && z > bounds.maxZ && z <= bounds.maxZ + 2)
    if (!allFloor && !allSidewalk) return false
  }

  return doc.items.every(other => {
    if (other.id === ignoreId) return true
    if (other.id === item.id) return false
    // Rugs are a separate floor layer; two rugs still cannot occupy the same cells.
    if ((item.kind === 'rug') !== (other.kind === 'rug')) return true
    // Shade is above the furniture; two overlapping covers still collide.
    if (isOutdoorCover(item.kind) !== isOutdoorCover(other.kind)) return true
    const otherSize = getItemFootprint(other)
    return item.x + footprint.width <= other.x || other.x + otherSize.width <= item.x
      || item.z + footprint.depth <= other.z || other.z + otherSize.depth <= item.z
  })
}

let fallbackId = 0

export function createItem(kind: ItemKind): ShopItem {
  if (!isKind(kind)) throw new RangeError('Invalid furniture kind')
  const id = globalThis.crypto?.randomUUID?.() ?? `item-${Date.now().toString(36)}-${(++fallbackId).toString(36)}`
  const stock = initialStocks[kind] ?? 'none'
  return { id, kind, x: 0, z: 0, rotation: 0, color: catalogByKind[kind].color, stock }
}

export function createEmptyShop(): ShopDocument {
  return { version: 2, name: 'Toko Kecilku', width: 7, depth: 6, wallColor: '#F4EEDF', floorColor: '#DCC5A9', items: [], wallItems: [] }
}

/** A completely unbuilt plot; the logical dimensions only anchor the work grid. */
export function createBlankShop(): ShopDocument {
  return { ...createEmptyShop(), floorCells: [] }
}

export function getLevelCount(doc: ShopDocument): number { return 1 + (doc.upperFloors?.length ?? 0) }

/** Indices start at zero. Ground-floor edits are merged back with replaceLevelDocument. */
export function getLevelDocument(doc: ShopDocument, index: number): ShopDocument {
  if (!Number.isInteger(index) || index < 0 || index >= getLevelCount(doc)) throw new RangeError('Invalid floor index')
  return index === 0 ? doc : doc.upperFloors![index - 1]
}

/** Defaults remain virtual so opening a legacy design never changes its saved shape. */
export function getRoof(doc: ShopDocument): RoofDesign & { stairAccess: 'open' | 'enclosed' } {
  return { style: 'tiles', color: '#B96B51', garden: false, stairAccess: 'open', ...doc.roof }
}

/** A missing saved state means a closed door, including legacy roof designs. */
export function getRooftopDoorOpen(doc: ShopDocument, stairId: string): boolean {
  return doc.roof?.stairDoors?.[stairId] === true
}

/** Only real openings in the rooftop deck create a stair house and its door. */
export function getRooftopDoorIds(doc: ShopDocument): string[] {
  const roof = getRoof(doc)
  if (roof.style !== 'rooftop' || roof.stairAccess !== 'enclosed') return []
  const top = getLevelDocument(doc, getLevelCount(doc) - 1), cells = getFloorCells(top)
  return top.items.filter(item => {
    if (item.kind !== 'stairs') return false
    const size = getItemSize(item), footprint = getItemFootprint(item)
    const alongZ = item.rotation % 180 === 0
    const across = { min: size.width * 0.02, max: size.width * 0.98 }
    const along = item.rotation === 90 || item.rotation === 180
      ? { min: size.depth * 0.10, max: size.depth * 0.98 }
      : { min: size.depth * 0.02, max: size.depth * 0.90 }
    const minX = item.x + (alongZ ? across.min : along.min), maxX = item.x + (alongZ ? across.max : along.max)
    const minZ = item.z + (alongZ ? along.min : across.min), maxZ = item.z + (alongZ ? along.max : across.max)
    return footprint.width > 0 && footprint.depth > 0
      && cells.some(cell => cell.x < maxX && cell.x + 1 > minX && cell.z < maxZ && cell.z + 1 > minZ)
  }).map(item => item.id)
}

/** Each stair house has its own door; edits never affect the entrance downstairs. */
export function setRooftopDoorOpen(doc: ShopDocument, stairId: string, open: boolean): ShopDocument {
  const roof = getRoof(doc), ids = new Set(getRooftopDoorIds(doc))
  if (typeof stairId !== 'string' || typeof open !== 'boolean' || !ids.has(stairId)
    || getRooftopDoorOpen(doc, stairId) === open) return doc
  const stairDoors = Object.fromEntries(Object.entries(roof.stairDoors ?? {}).filter(([id]) => ids.has(id)))
  if (open) stairDoors[stairId] = true
  else delete stairDoors[stairId]
  // Opening an existing door must never seed furniture or alter the roof layout.
  const nextRoof = { ...doc.roof!, stairDoors }
  return isRoofDesign(nextRoof) ? { ...doc, roof: nextRoof } : doc
}

function rooftopFloor(doc: ShopDocument, rooftop: RooftopDesign): ShopDocument {
  const top = getLevelDocument(doc, getLevelCount(doc) - 1)
  return {
    version: 2, name: doc.name, width: top.width, depth: top.depth,
    floorColor: rooftop.floorColor, wallColor: getExterior(doc).wallColor,
    floorCells: getFloorCells(top), items: rooftop.items.map(item => ({ ...item })),
    wallItems: [], partitions: [], interiorDoors: [],
  }
}

/** The roof follows the top storey's footprint; it never counts as another storey. */
export function getRooftopDocument(doc: ShopDocument): ShopDocument {
  const rooftop = doc.rooftop ?? (getRoof(doc).garden ? starterRooftop(doc) : { items: [], floorColor: '#D9CBB6' })
  return rooftopFloor(doc, rooftop)
}

/** Reserve the entire flight and a clear tile at its upper exit. */
function rooftopStairBounds(stairs: ShopItem) {
  const size = getItemFootprint(stairs)
  return {
    minX: stairs.x - (stairs.rotation === 270 ? 1 : 0),
    maxX: stairs.x + size.width + (stairs.rotation === 90 ? 1 : 0),
    minZ: stairs.z - (stairs.rotation === 0 ? 1 : 0),
    maxZ: stairs.z + size.depth + (stairs.rotation === 180 ? 1 : 0),
  }
}

function supportsRooftopExit(top: ShopDocument, stairs: ShopItem): boolean {
  const reserved = rooftopStairBounds(stairs)
  for (let x = reserved.minX; x < reserved.maxX; x++) for (let z = reserved.minZ; z < reserved.maxZ; z++) {
    if (!hasFloorCell(top, x, z)) return false
  }
  return true
}

/** A stair at the edge without a supported upper landing is not usable access. */
export function hasRooftopAccess(doc: ShopDocument): boolean {
  const top = getLevelDocument(doc, getLevelCount(doc) - 1)
  return top.items.some(item => item.kind === 'stairs' && supportsRooftopExit(top, item))
}

export function canPlaceRooftop(doc: ShopDocument, item: ShopItem, ignoreId?: string): boolean {
  if (!isItem(item) || item.kind === 'stairs') return false
  const roof = getRooftopDocument(doc)
  if (!canPlace(roof, item, ignoreId)) return false
  const size = getItemFootprint(item)
  // Standing signs may use a sidewalk downstairs, but never float off the deck.
  for (let x = item.x; x < item.x + size.width; x++) for (let z = item.z; z < item.z + size.depth; z++) {
    if (!hasFloorCell(roof, x, z)) return false
  }
  const top = getLevelDocument(doc, getLevelCount(doc) - 1)
  return top.items.filter(other => other.kind === 'stairs').every(stairs => {
    const reserved = rooftopStairBounds(stairs)
    return item.x + size.width <= reserved.minX || item.x >= reserved.maxX
      || item.z + size.depth <= reserved.minZ || item.z >= reserved.maxZ
  })
}

function parseRooftop(value: unknown, building: ShopDocument): RooftopDesign | null {
  if (!isRecord(value) || !exactKeys(value, ['items', 'floorColor']) || !isColor(value.floorColor)
    || !Array.isArray(value.items) || value.items.length > MAX_ITEMS) return null
  const rooftop: RooftopDesign = { items: [], floorColor: value.floorColor }
  const candidate = { ...building, rooftop }
  for (const item of value.items) {
    if (!isItem(item) || !canPlaceRooftop(candidate, item)) return null
    rooftop.items.push({ ...item })
  }
  return rooftop
}

function validRooftop(doc: ShopDocument): boolean {
  return !doc.rooftop || parseRooftop(doc.rooftop, doc) !== null
}

/** Preview the same cross-level constraints that a committed floor edit enforces. */
export function canPlaceLevelItem(doc: ShopDocument, level: number, item: ShopItem, ignoreId?: string): boolean {
  if (!Number.isInteger(level) || level < 0 || level >= getLevelCount(doc)) return false
  const floor = getLevelDocument(doc, level)
  if (!canPlace(floor, item, ignoreId)) return false
  if (!doc.rooftop || level !== getLevelCount(doc) - 1 || item.kind !== 'stairs') return true
  const nextFloor = { ...floor, items: [...floor.items.filter(other => other.id !== ignoreId), item] }
  const candidate = level === 0 ? { ...doc, items: nextFloor.items }
    : { ...doc, upperFloors: doc.upperFloors!.map((other, index) => index === level - 1 ? nextFloor : other) }
  return validRooftop(candidate)
}

/** Furniture and deck finish are editable; supporting contours stay with the floor below. */
export function replaceRooftopDocument(doc: ShopDocument, next: ShopDocument): ShopDocument {
  const current = getRooftopDocument(doc)
  if (next.width !== current.width || next.depth !== current.depth
    || JSON.stringify(getFloorCells(next)) !== JSON.stringify(current.floorCells)
    || (next.wallItems?.length ?? 0) || (next.partitions?.length ?? 0) || (next.interiorDoors?.length ?? 0)) return doc
  const rooftop = parseRooftop({ items: next.items, floorColor: next.floorColor }, doc)
  if (!rooftop || (doc.rooftop && JSON.stringify(doc.rooftop) === JSON.stringify(rooftop))) return doc
  return { ...doc, rooftop }
}

function starterRooftop(doc: ShopDocument): RooftopDesign {
  const rooftop: RooftopDesign = { items: [], floorColor: '#D9CBB6' }
  const candidate = { ...doc, rooftop }
  const bounds = getFloorBounds(getRooftopDocument(candidate))
  const add = (id: string, kind: ItemKind, x: number, z: number) => {
    const item = { ...createItem(kind), id, x, z }
    if (canPlaceRooftop(candidate, item)) rooftop.items.push(item)
  }
  const tableX = Math.max(bounds.minX, bounds.maxX - 3)
  const tableZ = Math.max(bounds.minZ, bounds.maxZ - 3)
  add('roof-table', 'dining-table', tableX, tableZ)
  add('roof-seat-a', 'stool', tableX - 1, tableZ)
  add('roof-seat-b', 'stool', tableX + 2, tableZ + 1)
  add('roof-plant-a', 'plant', bounds.maxX, bounds.minZ)
  add('roof-plant-b', 'plant', bounds.maxX, bounds.maxZ)
  return rooftop
}

/** Add an accessible flight when space permits, retaining every authored object. */
export function ensureRooftopAccess(doc: ShopDocument): ShopDocument {
  const index = getLevelCount(doc) - 1
  const top = getLevelDocument(doc, index)
  if (hasRooftopAccess(doc)) return doc
  const stairs = { ...createItem('stairs'), depth: 4, roofAccess: true }
  const lowerStairs = index > 0 ? getLevelDocument(doc, index - 1).items.find(item => item.kind === 'stairs') : undefined
  const candidates: ShopItem[] = lowerStairs ? [{ ...stairs, x: lowerStairs.x, z: lowerStairs.z, rotation: lowerStairs.rotation }] : []
  const bounds = getFloorBounds(top)
  for (const depth of [4, 3]) for (const rotation of [0, 90, 180, 270] as const) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) candidates.push({ ...stairs, x, z, rotation, depth })
  }
  for (const item of candidates) {
    if (!supportsRooftopExit(top, item) || !canPlace(top, item)) continue
    const next = replaceLevelDocument(doc, index, placeItem(top, item))
    if (next !== doc) return next
  }
  return doc
}

export function getExterior(doc: ShopDocument): ExteriorDesign {
  return doc.exterior ? { ...doc.exterior } : { wallColor: '#EADCCA', trimColor: '#847293', awning: true }
}

export function getExteriorWallMaterial(doc: ShopDocument): 'plaster' | 'brick' { return doc.exterior?.wallMaterial ?? 'plaster' }

export function setRoof(doc: ShopDocument, patch: Partial<RoofDesign>): ShopDocument {
  if (!isRecord(patch) || Reflect.ownKeys(patch).some(key => key !== 'style' && key !== 'color' && key !== 'garden' && key !== 'stairAccess' && key !== 'stairDoors')) return doc
  const current = getRoof(doc)
  const roof = { ...current, ...patch }
  if (!isRoofDesign(roof)) return doc
  const previousDoors = current.stairDoors ?? {}, nextDoors = roof.stairDoors ?? {}
  const unchanged = current.style === roof.style && current.color === roof.color && current.garden === roof.garden && current.stairAccess === roof.stairAccess
    && Object.keys(previousDoors).length === Object.keys(nextDoors).length && Object.keys(previousDoors).every(id => previousDoors[id] === nextDoors[id])
  if (unchanged) return doc
  if (roof.stairDoors) roof.stairDoors = { ...roof.stairDoors }
  let result: ShopDocument = { ...doc, roof }
  if (roof.style === 'rooftop') {
    if (current.style !== 'rooftop') result = ensureRooftopAccess(result)
    if (!result.rooftop) result = { ...result, rooftop: starterRooftop(result) }
  } else {
    const index = getLevelCount(result) - 1
    const top = getLevelDocument(result, index)
    const items = top.items.filter(item => item.kind !== 'stairs' || !item.roofAccess)
    if (items.length !== top.items.length) result = replaceLevelDocument(result, index, { ...top, items })
  }
  return result
}

export function setExterior(doc: ShopDocument, patch: Partial<ExteriorDesign>): ShopDocument {
  if (!isRecord(patch) || Reflect.ownKeys(patch).some(key => key !== 'wallColor' && key !== 'trimColor' && key !== 'awning' && key !== 'wallMaterial')) return doc
  const current = getExterior(doc)
  const exterior = { ...current, ...patch }
  if (!isExteriorDesign(exterior) || (current.wallColor === exterior.wallColor && current.trimColor === exterior.trimColor && current.awning === exterior.awning
    && (current.wallMaterial ?? 'plaster') === (exterior.wallMaterial ?? 'plaster'))) return doc
  return { ...doc, exterior }
}

function floorOnly(doc: ShopDocument): ShopDocument {
  const result = { ...doc }
  delete result.upperFloors
  delete result.roof
  delete result.rooftop
  delete result.exterior
  return result
}

/** A floor replacement cannot overwrite another level or the building's roof and facade. */
export function replaceLevelDocument(doc: ShopDocument, index: number, next: ShopDocument): ShopDocument {
  if (!Number.isInteger(index) || index < 0 || index >= getLevelCount(doc)) return doc
  if (getLevelDocument(doc, index) === next) return doc
  const floor = parseFloor(floorOnly(next), false)
  if (!floor) return doc
  const result = index === 0
    ? { ...floor, ...(doc.upperFloors ? { upperFloors: doc.upperFloors } : {}),
      ...(doc.roof ? { roof: doc.roof } : {}), ...(doc.rooftop ? { rooftop: doc.rooftop } : {}), ...(doc.exterior ? { exterior: doc.exterior } : {}) }
    : { ...doc, upperFloors: doc.upperFloors!.map((level, i) => i === index - 1 ? floor : level) }
  return validRooftop(result) ? result : doc
}

function addConnectingStairs(lower: ShopDocument, upper: ShopDocument, preferred?: ShopItem): ShopDocument {
  if (lower.items.some(item => item.kind === 'stairs')) return lower
  const stairs = createItem('stairs')
  const bounds = getFloorBounds(lower)
  const candidates: ShopItem[] = preferred ? [{ ...stairs, x: preferred.x, z: preferred.z, rotation: preferred.rotation }] : []
  for (const rotation of [0, 90] as const) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) candidates.push({ ...stairs, x, z, rotation })
  }
  for (const candidate of candidates) {
    if (!canPlace(lower, candidate)) continue
    const footprint = getItemFootprint(candidate)
    let supported = true
    for (let x = candidate.x; x < candidate.x + footprint.width; x++) for (let z = candidate.z; z < candidate.z + footprint.depth; z++) {
      if (!hasFloorCell(upper, x, z)) supported = false
    }
    if (supported) return placeItem(lower, candidate)
  }
  return lower
}

/** New levels inherit the top floor's contour; occupied layouts are never rearranged. */
export function setLevelCount(doc: ShopDocument, count: number): ShopDocument {
  if (!Number.isInteger(count) || count < 1 || count > MAX_LEVELS || count === getLevelCount(doc)) return doc
  const oldCount = getLevelCount(doc)
  const floors = [floorOnly(doc), ...(doc.upperFloors ?? [])].slice(0, count)
  while (floors.length < count) {
    const previous = floors[floors.length - 1]
    const next: ShopDocument = {
      version: 2, name: doc.name, width: previous.width, depth: previous.depth,
      wallColor: previous.wallColor, floorColor: previous.floorColor, items: [], wallItems: [],
      ...(previous.wallHeight === undefined ? {} : { wallHeight: previous.wallHeight }),
      ...(previous.floorCells ? { floorCells: getFloorCells(previous) } : {}),
    }
    floors.push(next)
  }
  for (let index = oldCount - 1; index < count - 1; index++) {
    const preferred = index > 0 ? floors[index - 1].items.find(item => item.kind === 'stairs') : undefined
    floors[index] = addConnectingStairs(floors[index], floors[index + 1], preferred)
  }
  const result = { ...doc, items: floors[0].items }
  if (count === 1) delete result.upperFloors
  else result.upperFloors = floors.slice(1)
  if (!validRooftop(result)) return doc
  return getRoof(result).style === 'rooftop' ? ensureRooftopAccess(result) : result
}

/** Materialize the old fixed sidewalk decoration once, without replacing saved items. */
function addDefaultStandingSign(doc: ShopDocument): ShopDocument {
  const id = 'sidewalk-chalkboard'
  if (doc.items.length >= MAX_ITEMS || doc.items.some(item => isStandingSign(item.kind) || item.id === id)
    || doc.wallItems?.some(item => item.id === id)) return doc
  const bounds = getFloorBounds(doc)
  for (let z = bounds.maxZ + 1; z <= Math.min(MAX_FLOOR_COORD, bounds.maxZ + 2); z++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const item: ShopItem = { id, kind: 'chalkboard', x, z, rotation: 0, color: catalogByKind.chalkboard.color, stock: 'none' }
      if (canPlace(doc, item)) return placeItem(doc, item)
    }
  }
  return doc
}

/** Version two records intentional absence, so deleted signs never reappear on load. */
export function upgradeShop(doc: ShopDocument): ShopDocument {
  const named = renameShop(doc, doc.name)
  return named.version === 2 ? named : addDefaultStandingSign({ ...named, version: 2 })
}

export function createInitialShop(): ShopDocument {
  const make = (id: string, kind: ItemKind, x: number, z: number, changes: Partial<ShopItem> = {}): ShopItem => ({
    ...createItem(kind), id, x, z, ...changes,
  })
  const window = (id: string, wall: WallSide, line: number, offset: number): WallItem => ({
    id, kind: 'window', wall, line, offset, height: 1.5, width: 1.8, sizeHeight: 1.4,
    color: '#F5EAD6', text: '', lit: false, windowStyle: 'classic',
  })
  const shop: ShopDocument = {
    ...createEmptyShop(),
    name: 'Sudut Cerita', width: 10, depth: 9,
    entrance: { position: 0.5, open: false },
    items: [
      make('welcome-rug', 'rug', 4, 6),
      make('bookshelf', 'shelf', 3, 0, { stock: 'books' }),
      make('ceramic-shelf', 'shelf', 5, 0, { color: '#B498C4', stock: 'ceramics' }),
      make('warm-lamp', 'lamp', 9, 7),
      make('fashion-rack', 'rack', 7, 6),
      make('display-table', 'table', 4, 4),
      make('checkout', 'counter', 1, 7),
      make('little-seat', 'stool', 1, 6),
      make('green-corner', 'plant', 0, 8),
      make('front-plant', 'plant', 9, 8, { color: '#B797C8' }),
      make('ground-stairs', 'stairs', 0, 1, { depth: 4 }),
      make('ground-toilet', 'toilet', 7, 0),
      make('ground-shower', 'shower', 9, 0),
      make('ground-washbasin', 'washbasin', 9, 2, { rotation: 90 }),
    ],
    partitions: [
      { id: 'wc-left-wall', axis: 'z', line: 7, start: 0, end: 3, color: '#D8E4DC' },
      { id: 'wc-front-wall', axis: 'x', line: 3, start: 7, end: 10, color: '#D8E4DC' },
    ],
    interiorDoors: [{ id: 'wc-door', wallId: 'wc-front-wall', offset: 8.5, width: 1, color: '#B697B8', open: false }],
    upperFloors: [{
      ...createEmptyShop(), name: 'Sudut Cerita', width: 10, depth: 9, floorColor: '#D9CBB6',
      wallItems: [
        window('warehouse-front-window', 'front', 9, 5),
        window('warehouse-right-window', 'right', 10, 5),
      ],
      items: [
        make('warehouse-rack-a', 'warehouse-rack', 3, 0),
        make('warehouse-rack-b', 'warehouse-rack', 6, 0),
        make('warehouse-rack-c', 'warehouse-rack', 3, 3),
        make('warehouse-rack-d', 'warehouse-rack', 6, 3),
        make('warehouse-rack-e', 'warehouse-rack', 3, 6),
        make('warehouse-rack-f', 'warehouse-rack', 6, 6),
      ],
    }],
    roof: { style: 'tiles', color: '#B96B51', garden: false },
    exterior: { wallColor: '#EADCCA', trimColor: '#847293', awning: true },
  }
  delete shop.wallItems
  shop.wallItems = [
    ...getWallItems(shop),
    window('ground-front-window', 'front', 9, 2.2),
    window('ground-right-window', 'right', 10, 5),
    { ...createWallItem('wall-clock'), id: 'ground-wall-clock', wall: 'back', line: 0, offset: 2.5, height: 2.35 },
  ]
  return addDefaultStandingSign(shop)
}

export function placeItem(doc: ShopDocument, item: ShopItem): ShopDocument {
  if (doc.items.length >= MAX_ITEMS || !canPlace(doc, item)) return doc
  return { ...doc, items: [...doc.items, { ...item }] }
}

export function updateItem(doc: ShopDocument, id: string, patch: Partial<ShopItem>): ShopDocument {
  const current = doc.items.find(item => item.id === id)
  if (!current || !isRecord(patch) || Reflect.ownKeys(patch).some(key => typeof key !== 'string' || !allowedItemKeys.includes(key as typeof allowedItemKeys[number]))) return doc
  if (own(patch, 'id') && patch.id !== id) return doc
  const candidate = { ...current, ...patch }
  if (!canPlace(doc, candidate, id)) return doc
  const size = getItemSize(candidate)
  const currentSize = getItemSize(current)
  if (itemKeys.every(key => candidate[key] === current[key]) && size.width === currentSize.width && size.depth === currentSize.depth) return doc
  return { ...doc, items: doc.items.map(item => item.id === id ? candidate : item) }
}

export function removeItem(doc: ShopDocument, id: string): ShopDocument {
  if (!doc.items.some(item => item.id === id)) return doc
  return { ...doc, items: doc.items.filter(item => item.id !== id) }
}

export function resizeShop(doc: ShopDocument, width: number, depth: number): ShopDocument | null {
  if (!isDimension(width) || !isDimension(depth)) return null
  if (doc.floorCells?.length && (doc.width !== width || doc.depth !== depth)) return null
  const candidate = reconcileStandingSigns({ ...doc, width, depth })
  if (!candidate || !validPartitions(candidate)) return null
  return width === doc.width && depth === doc.depth ? doc : reconcileWallItems(doc, candidate)
}

/** Validate imported JSON or an already-parsed value, then return a detached document. */
export function parseShop(input: unknown): ShopDocument | null {
  try {
    let value = input
    if (typeof value === 'string') {
      if (value.length > MAX_JSON_LENGTH) return null
      value = JSON.parse(value) as unknown
    }
    return parseFloor(value, true)
  } catch {
    return null
  }
}

/** Upper floors cannot contain another building, keeping validation and save size bounded. */
function parseFloor(value: unknown, allowBuilding: boolean): ShopDocument | null {
    if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) return null
    const optionalKeys = allowBuilding ? [...optionalDocumentKeys, ...buildingDocumentKeys] : optionalDocumentKeys
    if (!keysWithOptional(value, documentKeys, optionalKeys)) return null
    if (own(value, 'roof') && !isRoofDesign(value.roof)) return null
    if (own(value, 'exterior') && !isExteriorDesign(value.exterior)) return null
    if (own(value, 'upperFloors') && (!Array.isArray(value.upperFloors) || value.upperFloors.length >= MAX_LEVELS)) return null
    if (own(value, 'wallHeight') && !isWallHeight(value.wallHeight)) return null
    if (own(value, 'entrance') && !isEntrance(value.entrance)) return null
    if (own(value, 'wallItems') && (!Array.isArray(value.wallItems) || value.wallItems.length > MAX_WALL_ITEMS)) return null
    if (own(value, 'partitions') && (!Array.isArray(value.partitions) || value.partitions.length > MAX_PARTITIONS)) return null
    if (own(value, 'interiorDoors') && (!Array.isArray(value.interiorDoors) || value.interiorDoors.length > MAX_INTERIOR_DOORS)) return null
    if (own(value, 'floorCells')) {
      if (!Array.isArray(value.floorCells) || (value.version === 1 && !value.floorCells.length) || value.floorCells.length > (MAX_FLOOR_COORD - MIN_FLOOR_COORD + 1) ** 2) return null
      const keys = new Set<string>()
      for (const cell of value.floorCells) {
        if (!isFloorCell(cell) || keys.has(`${cell.x},${cell.z}`)) return null
        keys.add(`${cell.x},${cell.z}`)
      }
    }
    if (typeof value.name !== 'string' || value.name.length > 80 || value.name.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(value.name)) return null
    if (!isDimension(value.width) || !isDimension(value.depth) || !isColor(value.wallColor) || !isColor(value.floorColor)) return null
    if (!Array.isArray(value.items) || value.items.length > MAX_ITEMS) return null

    const result: ShopDocument = {
      version: value.version, name: value.name.trim(), width: value.width, depth: value.depth,
      wallColor: value.wallColor, floorColor: value.floorColor, items: [],
    }
    if (isWallHeight(value.wallHeight)) result.wallHeight = value.wallHeight
    if (isEntrance(value.entrance)) result.entrance = { ...value.entrance }
    if (Array.isArray(value.floorCells)) result.floorCells = (value.floorCells as FloorCell[]).map(cell => ({ ...cell }))
    // An explicitly empty accessory list suppresses virtual legacy decorations
    // while validating IDs in the new wall/door arrays too.
    if (Array.isArray(value.wallItems)) result.wallItems = []
    for (const item of value.items) {
      if (!isItem(item) || !canPlace(result, item)) return null
      result.items.push({ ...item })
    }
    if (Array.isArray(value.partitions)) {
      result.partitions = []
      for (const wall of value.partitions) {
        if (!isPartition(wall) || !canPlacePartition(result, wall)) return null
        result.partitions.push({ ...wall })
      }
    }
    if (Array.isArray(value.interiorDoors)) {
      result.interiorDoors = []
      for (const door of value.interiorDoors) {
        if (!isInteriorDoor(door) || !canPlaceInteriorDoor(result, door)) return null
        result.interiorDoors.push({ ...door })
      }
    }
    if (Array.isArray(value.wallItems)) {
      result.wallItems = []
      const runs = getWallRuns(result)
      for (const item of value.wallItems) {
        if (!isWallItem(item) || !fitsWallItem(result, item, result.wallItems, runs)) return null
        result.wallItems.push({ ...item })
      }
    }
    if (Array.isArray(value.upperFloors)) {
      result.upperFloors = []
      for (const level of value.upperFloors) {
        const floor = parseFloor(level, false)
        if (!floor) return null
        result.upperFloors.push(floor)
      }
    }
    if (isRoofDesign(value.roof)) result.roof = { ...value.roof, ...(value.roof.stairDoors ? { stairDoors: { ...value.roof.stairDoors } } : {}) }
    if (isExteriorDesign(value.exterior)) result.exterior = { ...value.exterior }
    if (own(value, 'rooftop')) {
      const rooftop = parseRooftop(value.rooftop, result)
      if (!rooftop) return null
      result.rooftop = rooftop
    }
    return result
}
