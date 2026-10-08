export type ItemKind = 'shelf' | 'table' | 'counter' | 'rack' | 'plant' | 'rug' | 'lamp' | 'stool' | 'chalkboard' | 'poster-stand' | 'direction-sign'
  | 'glass-cabinet' | 'display-plinth' | 'pegboard' | 'food-display' | 'drinks-fridge' | 'coffee-station' | 'prep-counter' | 'stove' | 'sink' | 'dining-table' | 'service-cart'
  | 'stairs' | 'warehouse-rack' | 'bathroom'
export type ProductKind = 'books' | 'ceramics' | 'plants' | 'fashion' | 'vinyl' | 'shoes' | 'bags' | 'skincare' | 'toys'
  | 'bread' | 'pastries' | 'drinks' | 'fruit' | 'meals' | 'snacks' | 'none'
export type Rotation = 0 | 90 | 180 | 270
export type WallItemKind = 'window' | 'wall-lamp' | 'wall-shelf' | 'painting' | 'wall-sign'
export type WindowStyle = 'classic' | 'picture' | 'grid' | 'sliding' | 'arched'
export interface WallItem {
  id: string
  kind: WallItemKind
  wall: 'back' | 'left'
  line: number
  offset: number
  height: number
  color: string
  text: string
  lit: boolean
  width?: number
  sizeHeight?: number
  windowStyle?: WindowStyle
}
export interface WallRun { wall: 'back' | 'left'; line: number; start: number; end: number }
export interface WallCatalogEntry {
  kind: WallItemKind
  name: string
  description: string
  width: number
  height: number
  depth: number
  color: string
}

export interface Entrance { position: number; open: boolean; rotation?: Rotation }
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
  /** Floors above the ground floor, ordered from level two through four. */
  upperFloors?: ShopDocument[]
  roof?: RoofDesign
  exterior?: ExteriorDesign
}

export interface RoofDesign { style: 'tiles' | 'rooftop'; color: string; garden: boolean }
export interface ExteriorDesign { wallColor: string; trimColor: string; awning: boolean }
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
  { kind: 'warehouse-rack', name: 'Rak gudang', description: 'Rak penyimpanan tinggi dengan kardus stok yang tertata rapi.', width: 2, depth: 1, color: '#7E9E9C', stockable: false },
  { kind: 'bathroom', name: 'WC / kamar mandi', description: 'Kamar mandi kecil dengan toilet, wastafel, dan dinding privasi.', width: 2, depth: 2, color: '#B4CDC8', stockable: false },
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
  { kind: 'wall-sign', name: 'Papan nama', description: 'Tulisan pilihanmu di dalam toko.', width: 1.6, height: 0.55, depth: 0.1, color: '#C69972' },
]

export const WINDOW_STYLES: { id: WindowStyle; label: string }[] = [
  { id: 'classic', label: 'Klasik' },
  { id: 'picture', label: 'Panoramik' },
  { id: 'grid', label: 'Kisi-kisi' },
  { id: 'sliding', label: 'Geser' },
  { id: 'arched', label: 'Lengkung' },
]

// Internal copies keep validation independent from presentation code using CATALOG.
const catalogByKind = Object.freeze(Object.fromEntries(CATALOG.map(entry => [entry.kind, Object.freeze({ ...entry })]))) as Readonly<Record<ItemKind, CatalogEntry>>
const wallCatalogByKind = Object.freeze(Object.fromEntries(WALL_CATALOG.map(entry => [entry.kind, Object.freeze({ ...entry })]))) as Readonly<Record<WallItemKind, WallCatalogEntry>>
const windowStyles: ReadonlySet<string> = new Set(WINDOW_STYLES.map(style => style.id))
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
const optionalItemKeys = ['width', 'depth'] as const
const allowedItemKeys = [...itemKeys, ...optionalItemKeys] as const
const documentKeys = ['version', 'name', 'width', 'depth', 'wallColor', 'floorColor', 'items'] as const
const optionalDocumentKeys = ['wallHeight', 'entrance', 'floorCells', 'wallItems'] as const
const buildingDocumentKeys = ['upperFloors', 'roof', 'exterior'] as const
const wallItemKeys = ['id', 'kind', 'wall', 'line', 'offset', 'height', 'color', 'text', 'lit'] as const
const optionalWallItemKeys = ['width', 'sizeHeight', 'windowStyle'] as const
const allowedWallItemKeys = [...wallItemKeys, ...optionalWallItemKeys] as const
const MAX_WALL_ITEMS = 60
const MAX_ITEMS = 200
const MAX_JSON_LENGTH = 128_000 * MAX_LEVELS
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

function isRoofDesign(value: unknown): value is RoofDesign {
  return isRecord(value) && exactKeys(value, ['style', 'color', 'garden'])
    && (value.style === 'tiles' || value.style === 'rooftop') && isColor(value.color) && typeof value.garden === 'boolean'
}

function isExteriorDesign(value: unknown): value is ExteriorDesign {
  return isRecord(value) && exactKeys(value, ['wallColor', 'trimColor', 'awning'])
    && isColor(value.wallColor) && isColor(value.trimColor) && typeof value.awning === 'boolean'
}

function isWallHeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 2.3 && value <= 4.5
}

function isEntrance(value: unknown): value is Entrance {
  return isRecord(value) && (exactKeys(value, ['position', 'open']) || exactKeys(value, ['position', 'open', 'rotation']))
    && typeof value.position === 'number' && Number.isFinite(value.position)
    && value.position >= 0 && value.position <= 1 && typeof value.open === 'boolean'
    && (!own(value, 'rotation') || (typeof value.rotation === 'number' && rotations.includes(value.rotation)))
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

export function getWallRuns(doc: ShopDocument): WallRun[] {
  const cells = getFloorCells(doc)
  const occupied = new Set(cells.map(cell => `${cell.x},${cell.z}`))
  const result: WallRun[] = []
  for (const wall of ['back', 'left'] as const) {
    const lines = new Map<number, number[]>()
    for (const cell of cells) {
      if (occupied.has(wall === 'back' ? `${cell.x},${cell.z - 1}` : `${cell.x - 1},${cell.z}`)) continue
      const line = wall === 'back' ? cell.z : cell.x
      const values = lines.get(line) ?? []
      values.push(wall === 'back' ? cell.x : cell.z)
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
  return typeof value.id === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value.id)
    && typeof value.kind === 'string' && own(wallCatalogByKind, value.kind)
    && (value.wall === 'back' || value.wall === 'left')
    && typeof value.line === 'number' && Number.isInteger(value.line) && value.line >= MIN_FLOOR_COORD && value.line <= MAX_FLOOR_COORD
    && typeof value.offset === 'number' && Number.isFinite(value.offset) && value.offset >= MIN_FLOOR_COORD && value.offset <= MAX_FLOOR_COORD + 1
    && typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0 && value.height <= 4.5
    && isColor(value.color) && typeof value.text === 'string' && value.text.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value.text)
    && typeof value.lit === 'boolean'
}

/** Accessory dimensions; mounting height remains item.height and depth is catalog-defined. */
export function getWallItemSize(item: WallItem): { width: number; height: number; depth: number } {
  const entry = wallCatalogByKind[item.kind]
  return { width: item.width ?? entry.width, height: item.sizeHeight ?? entry.height, depth: entry.depth }
}

/** Old windows retain their original appearance without materializing a new field. */
export function getWindowStyle(item: WallItem): WindowStyle {
  return item.windowStyle ?? 'classic'
}

function wallItemsOverlap(a: WallItem, b: WallItem): boolean {
  if (a.wall !== b.wall || a.line !== b.line) return false
  const first = getWallItemSize(a)
  const second = getWallItemSize(b)
  return Math.abs(a.offset - b.offset) < (first.width + second.width) / 2 - 0.000001
    && Math.abs(a.height - b.height) < (first.height + second.height) / 2 - 0.000001
}

function fitsWallItem(doc: ShopDocument, item: WallItem, existing: WallItem[], runs: WallRun[], ignoreId?: string): boolean {
  if (!isWallItem(item) || doc.items.some(furniture => furniture.id === item.id)) return false
  const size = getWallItemSize(item)
  if (item.height - size.height / 2 < -0.000001 || item.height + size.height / 2 > getWallHeight(doc) + 0.000001) return false
  if (!runs.some(run => run.wall === item.wall && run.line === item.line
    && item.offset - size.width / 2 >= run.start - 0.000001 && item.offset + size.width / 2 <= run.end + 0.000001)) return false
  return existing.every(other => other.id === ignoreId || (other.id !== item.id && !wallItemsOverlap(item, other)))
}

export function wallItemPosition(doc: ShopDocument, item: WallItem): { x: number; y: number; z: number; rotation: number } {
  return item.wall === 'back'
    ? { x: item.offset - doc.width / 2, y: item.height, z: item.line - doc.depth / 2 + 0.012, rotation: 0 }
    : { x: item.line - doc.width / 2 + 0.012, y: item.height, z: item.offset - doc.depth / 2, rotation: Math.PI / 2 }
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
  if (!isWallItem(proposed) || doc.items.some(furniture => furniture.id === proposed.id)) return null
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
    const axis = run.wall === 'back' ? target.x + doc.width / 2 : target.z + doc.depth / 2
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
    && getWindowStyle(candidate) === getWindowStyle(current)) return doc
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
    const candidate = withSigns ? reconcileWallItems(current, withSigns) : null
    if (candidate) current = candidate
    else if (operation === 'add') cells.delete(key)
    else cells.set(key, { ...cell })
  }
  return current
}

/** Find a front-facing boundary run for the actual floor contour, including L shapes. */
export function getEntranceAnchor(doc: ShopDocument): { x: number; z: number; width: number } {
  const bounds = getFloorBounds(doc)
  const rows = new Map<number, number[]>()
  for (const cell of getFloorCells(doc)) {
    if (hasFloorCell(doc, cell.x, cell.z + 1)) continue
    const row = rows.get(cell.z) ?? []; row.push(cell.x); rows.set(cell.z, row)
  }
  const margin = Math.min(1.1, bounds.width / 2)
  const desired = bounds.minX + margin + getEntrance(doc).position * Math.max(0, bounds.width - 2 * margin)
  let best = { x: desired, z: bounds.maxZ + 1, width: 1.84, cost: Infinity }
  for (const [z, values] of rows) {
    const xs = values.sort((a,b) => a-b)
    for (let start = 0; start < xs.length;) {
      let end = start
      while (end + 1 < xs.length && xs[end + 1] === xs[end] + 1) end++
      const length = xs[end] - xs[start] + 1
      const inset = Math.min(1.1, length / 2)
      const x = Math.max(xs[start] + inset, Math.min(xs[end] + 1 - inset, desired))
      const cost = Math.abs(x - desired) + (bounds.maxZ - z) * 0.001
      if (cost < best.cost) best = { x, z: z + 1, width: length >= 2 ? 1.84 : 0.85, cost }
      start = end + 1
    }
  }
  return { x: best.x - doc.width / 2, z: best.z - doc.depth / 2 + 0.09, width: best.width }
}

export function getWallHeight(doc: ShopDocument): number { return doc.wallHeight ?? 2.75 }

export function getEntrance(doc: ShopDocument): Entrance {
  return doc.entrance ? { ...doc.entrance } : { position: 0.72, open: false }
}

/** The whole entrance orientation, independent from its door leaf opening. */
export function getEntranceRotation(doc: ShopDocument): Rotation {
  return doc.entrance?.rotation ?? 0
}

export function setWallHeight(doc: ShopDocument, height: number): ShopDocument {
  if (!isWallHeight(height)) return doc
  const rounded = Math.round(height * 10) / 10
  return rounded === getWallHeight(doc) ? doc : reconcileWallItems(doc, { ...doc, wallHeight: rounded }) ?? doc
}

export function setEntrance(doc: ShopDocument, patch: Partial<Entrance>): ShopDocument {
  if (!isRecord(patch) || Reflect.ownKeys(patch).some(key => key !== 'position' && key !== 'open' && key !== 'rotation')) return doc
  const current = getEntrance(doc)
  const next = { ...current, ...patch }
  if (!isEntrance(next)) return doc
  const position = Math.round(next.position * 1000) / 1000
  if (current.position === position && current.open === next.open && (current.rotation ?? 0) === (next.rotation ?? 0)) return doc
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

export function canPlace(doc: ShopDocument, item: ShopItem, ignoreId?: string): boolean {
  if (!isDimension(doc.width) || !isDimension(doc.depth) || !Array.isArray(doc.items) || !isItem(item)) return false
  if (doc.floorCells?.length === 0) return false
  if (doc.wallItems?.some(accessory => accessory.id === item.id)) return false
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
export function getRoof(doc: ShopDocument): RoofDesign {
  return doc.roof ? { ...doc.roof } : { style: 'tiles', color: '#B96B51', garden: false }
}

export function getExterior(doc: ShopDocument): ExteriorDesign {
  return doc.exterior ? { ...doc.exterior } : { wallColor: '#EADCCA', trimColor: '#847293', awning: true }
}

export function setRoof(doc: ShopDocument, patch: Partial<RoofDesign>): ShopDocument {
  if (!isRecord(patch) || Reflect.ownKeys(patch).some(key => key !== 'style' && key !== 'color' && key !== 'garden')) return doc
  const current = getRoof(doc)
  const roof = { ...current, ...patch }
  if (!isRoofDesign(roof) || (current.style === roof.style && current.color === roof.color && current.garden === roof.garden)) return doc
  return { ...doc, roof }
}

export function setExterior(doc: ShopDocument, patch: Partial<ExteriorDesign>): ShopDocument {
  if (!isRecord(patch) || Reflect.ownKeys(patch).some(key => key !== 'wallColor' && key !== 'trimColor' && key !== 'awning')) return doc
  const current = getExterior(doc)
  const exterior = { ...current, ...patch }
  if (!isExteriorDesign(exterior) || (current.wallColor === exterior.wallColor && current.trimColor === exterior.trimColor && current.awning === exterior.awning)) return doc
  return { ...doc, exterior }
}

function floorOnly(doc: ShopDocument): ShopDocument {
  const result = { ...doc }
  delete result.upperFloors
  delete result.roof
  delete result.exterior
  return result
}

/** A floor replacement cannot overwrite another level or the building's roof and facade. */
export function replaceLevelDocument(doc: ShopDocument, index: number, next: ShopDocument): ShopDocument {
  if (!Number.isInteger(index) || index < 0 || index >= getLevelCount(doc)) return doc
  if (getLevelDocument(doc, index) === next) return doc
  const floor = parseFloor(floorOnly(next), false)
  if (!floor) return doc
  if (index === 0) {
    return { ...floor, ...(doc.upperFloors ? { upperFloors: doc.upperFloors } : {}),
      ...(doc.roof ? { roof: doc.roof } : {}), ...(doc.exterior ? { exterior: doc.exterior } : {}) }
  }
  return { ...doc, upperFloors: doc.upperFloors!.map((level, i) => i === index - 1 ? floor : level) }
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
  return result
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
  const shop: ShopDocument = {
    ...createEmptyShop(),
    name: 'Sudut Cerita',
    items: [
      make('welcome-rug', 'rug', 2, 3),
      make('bookshelf', 'shelf', 0, 0, { stock: 'books' }),
      make('ceramic-shelf', 'shelf', 2, 0, { color: '#B498C4', stock: 'ceramics' }),
      make('warm-lamp', 'lamp', 4, 0),
      make('fashion-rack', 'rack', 5, 0),
      make('display-table', 'table', 3, 2),
      make('checkout', 'counter', 0, 4),
      make('little-seat', 'stool', 2, 4),
      make('green-corner', 'plant', 0, 5),
      make('front-plant', 'plant', 6, 5, { color: '#B797C8' }),
      make('ground-stairs', 'stairs', 0, 1),
      make('ground-bathroom', 'bathroom', 5, 1),
    ],
    upperFloors: [{
      ...createEmptyShop(), name: 'Sudut Cerita', floorColor: '#D9CBB6',
      items: [
        make('warehouse-rack-a', 'warehouse-rack', 0, 0),
        make('warehouse-rack-b', 'warehouse-rack', 3, 0),
        make('warehouse-rack-c', 'warehouse-rack', 5, 0),
        make('warehouse-rack-d', 'warehouse-rack', 3, 3),
        make('warehouse-rack-e', 'warehouse-rack', 5, 3),
      ],
    }],
    roof: { style: 'tiles', color: '#B96B51', garden: false },
    exterior: { wallColor: '#EADCCA', trimColor: '#847293', awning: true },
  }
  delete shop.wallItems
  shop.wallItems = getWallItems(shop)
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
  if (!candidate) return null
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
    for (const item of value.items) {
      if (!isItem(item) || !canPlace(result, item)) return null
      result.items.push({ ...item })
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
    if (isRoofDesign(value.roof)) result.roof = { ...value.roof }
    if (isExteriorDesign(value.exterior)) result.exterior = { ...value.exterior }
    return result
}
