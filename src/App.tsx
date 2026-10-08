import { useCallback, useEffect, useRef, useState } from 'react';
import { Apple, ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Building2, Camera, Check, CheckCheck, ChevronDown, CircleHelp, Cookie, Copy, Croissant, Disc3, DoorOpen, Eraser, Expand, Eye, Footprints, GlassWater, Grid2X2, Layers3, Leaf, Maximize2, Moon, MousePointer2, Move, Paintbrush, Plus, Puzzle, Redo2, RotateCcw, RotateCw, Sandwich, Save, Shirt, ShoppingBag, Sparkles, SprayCan, Store, Sun, Trash2, Undo2, Upload, UtensilsCrossed, X } from 'lucide-react';
import ShopCanvas, { type SceneHandle } from './components/ShopCanvas';
import FurnitureArt from './components/FurnitureArt';
import WallArt from './components/WallArt';
import AmbienceControl from './components/AmbienceControl';
import ExteriorSettings from './components/ExteriorSettings';
import PartitionPanel from './components/PartitionPanel';
import { getPartitions, getEntranceWall, removePartition } from './model';
import { getLevelCount, getLevelDocument, replaceLevelDocument, setLevelCount, getRoof } from './model';
import { CATALOG, FOOD_ITEM_KINDS, FOOD_PRODUCTS, canPlace, createBlankShop, createInitialShop, createItem, getAllowedStocks, getEntrance, getFloorBounds, getFloorCells, getItemSize, getItemFootprint, getItemPlacementBounds, getWallHeight, isStandingSign, parseShop, placeItem, removeItem, renameShop, setEntrance, setWallHeight, updateItem, upgradeShop } from './model';
import type { ItemKind, ProductKind, Rotation, ShopDocument, ShopItem } from './model';
import { WALL_CATALOG, WINDOW_STYLES, getWindowStyle, getWallItems, getWallItemSize, getWallRuns, createWallItem, canPlaceWallItem, findWallPlacement, placeWallItem, updateWallItem, removeWallItem } from './model';
import type { WallItem, WallItemKind, WindowStyle } from './model';

const STORAGE_KEY = 'nemu.store-maker.v1';
const NIGHT_MODE_KEY = 'nemu.store-maker.night-mode';
const COLORS = ['#b89470', '#d6bea0', '#9e91ba', '#8d9e83', '#e1a78c', '#f1e5cf'];
const WALL_COLORS = ['#efe5d6', '#d6dcca', '#e8d7df', '#d6d9e6', '#ead2b6', '#c6b8de'];
const FLOOR_COLORS = ['#e2c9a6', '#d9c6ae', '#d6cfbf', '#b79980', '#d6d1e5', '#c5cdb7'];
const STOCK: { value: ProductKind; name: string; label: string; icon: typeof BookOpen }[] = [
  { value: 'books', name: 'Buku', label: 'buku', icon: BookOpen },
  { value: 'ceramics', name: 'Keramik', label: 'keramik', icon: Store },
  { value: 'plants', name: 'Tanaman', label: 'tanaman', icon: Leaf },
  { value: 'fashion', name: 'Fashion', label: 'fashion', icon: Shirt },
  { value: 'vinyl', name: 'Vinyl', label: 'vinyl', icon: Disc3 },
  { value: 'shoes', name: 'Sepatu', label: 'sepatu', icon: Footprints },
  { value: 'bags', name: 'Tas', label: 'tas', icon: ShoppingBag },
  { value: 'skincare', name: 'Skincare', label: 'skincare', icon: SprayCan },
  { value: 'toys', name: 'Mainan', label: 'mainan', icon: Puzzle },
  { value: 'bread', name: 'Roti', label: 'roti', icon: Sandwich },
  { value: 'pastries', name: 'Pastri', label: 'pastri', icon: Croissant },
  { value: 'drinks', name: 'Minuman', label: 'minuman', icon: GlassWater },
  { value: 'fruit', name: 'Buah', label: 'buah', icon: Apple },
  { value: 'meals', name: 'Hidangan', label: 'hidangan', icon: UtensilsCrossed },
  { value: 'snacks', name: 'Camilan', label: 'camilan', icon: Cookie },
];
const FOOD_ITEMS = new Set<ItemKind>(FOOD_ITEM_KINDS);
const UTILITY_ITEMS = new Set<ItemKind>(['stairs', 'warehouse-rack', 'toilet', 'washbasin', 'shower']);
const FOOD_STOCK = new Set<ProductKind>(FOOD_PRODUCTS);
type History = { past: ShopDocument[]; present: ShopDocument; future: ShopDocument[] };
function loadShop(): ShopDocument {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = parseShop(JSON.parse(raw)); if (parsed) return upgradeShop(parsed); } } catch { /* Recover to a valid example. */ }
  return createInitialShop();
}
function downloadFile(url: string, filename: string) {
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
}
function snappedWallItem(item: WallItem): WallItem {
  return { ...item, offset: Math.round(item.offset * 10) / 10, height: Math.round(item.height * 10) / 10 };
}

export default function App() {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: loadShop(), future: [] }));
  const building = history.present;
  const levelCount = getLevelCount(building);
  const [requestedLevel, setRequestedLevel] = useState(0);
  const activeLevel = Math.min(requestedLevel, levelCount - 1);
  const shop = getLevelDocument(building, activeLevel);
  const [exteriorOnly, setExteriorOnly] = useState(false);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<ShopItem | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedDoor, setSelectedDoor] = useState(false);
  const [selectedPartitionId, setSelectedPartitionId] = useState<string | null>(null);
  const [resizeMode, setResizeMode] = useState(false);
  const [wallPlacement, setWallPlacement] = useState<WallItem | null>(null);
  const [tab, setTab] = useState<'furniture' | 'room'>(() => getFloorCells(shop).length ? 'furniture' : 'room');
  const [filter, setFilter] = useState<'all' | 'display' | 'decor' | 'sign' | 'wall' | 'food' | 'utility'>('all');
  const [showGrid, setShowGrid] = useState(() => getFloorCells(shop).length === 0);
  const [showWalls, setShowWalls] = useState(true);
  const [showCity, setShowCity] = useState(true);
  const [nightMode, setNightMode] = useState(() => {
    try { return localStorage.getItem(NIGHT_MODE_KEY) === 'true'; } catch { return false; }
  });
  const [editMode, setEditMode] = useState<'arrange' | 'build'>(() => getFloorCells(shop).length ? 'arrange' : 'build');
  const [buildTool, setBuildTool] = useState<'add' | 'erase' | 'walls' | 'partition'>('add');
  const [interaction, setInteraction] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [view, setView] = useState<'orbit' | 'top' | 'front'>('orbit');
  const [cameraReset, setCameraReset] = useState(0);
  const [help, setHelp] = useState(false);
  const [fileMenu, setFileMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState(true);
  const scene = useRef<SceneHandle>(null);
  const importer = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = shop.items.find((item) => item.id === selectedId) ?? null;
  const selectedEntry = CATALOG.find((entry) => entry.kind === selected?.kind);
  const selectedSize = selected ? getItemSize(selected) : null;
  const selectedFootprint = selected ? getItemFootprint(selected) : null;
  const placementFootprint = placement ? getItemFootprint(placement) : null;
  const moving = !!placement && shop.items.some((item) => item.id === placement.id);
  const wallItems = getWallItems(shop);
  const selectedWall = wallItems.find((item) => item.id === selectedWallId) ?? null;
  const selectedWallEntry = WALL_CATALOG.find((entry) => entry.kind === selectedWall?.kind);
  const selectedWallSize = selectedWall ? getWallItemSize(selectedWall) : null;
  const wallPlacementSize = wallPlacement ? getWallItemSize(wallPlacement) : null;
  const movingWall = !!wallPlacement && wallItems.some((item) => item.id === wallPlacement.id);
  const wallPlacementValid = !!wallPlacement && canPlaceWallItem(shop, wallPlacement, movingWall ? wallPlacement.id : undefined) && canPlaceWallItem(shop, snappedWallItem(wallPlacement), movingWall ? wallPlacement.id : undefined);
  const entrance = getEntrance(shop);
  const floorBounds = getFloorBounds(shop);
  const floorCount = getFloorCells(shop).length;
  const placementBounds = getItemPlacementBounds(shop, placement?.kind ?? selected?.kind ?? 'shelf');
  const positionsX = Array.from({ length: placementBounds.maxX - placementBounds.minX + 1 }, (_, i) => placementBounds.minX + i);
  const positionsZ = Array.from({ length: placementBounds.maxZ - placementBounds.minZ + 1 }, (_, i) => placementBounds.minZ + i);

  const announce = useCallback((text: string) => {
    setToast(text); if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    try { localStorage.setItem(NIGHT_MODE_KEY, String(nightMode)); } catch { /* Time of day still works for this session. */ }
  }, [nightMode]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...building, name: building.name.trim() || 'Toko Kecilku' })); setSaved(true); }
    catch { setSaved(false); }
  }, [building]);
  useEffect(() => { if (selectedId && !shop.items.some((item) => item.id === selectedId)) setSelectedId(null); }, [shop.items, selectedId]);
  useEffect(() => { if (selectedWallId && !getWallItems(shop).some((item) => item.id === selectedWallId)) setSelectedWallId(null); }, [shop, selectedWallId]);
  useEffect(() => { if (selectedPartitionId && !getPartitions(shop).some(wall => wall.id === selectedPartitionId)) setSelectedPartitionId(null); }, [shop, selectedPartitionId]);
  useEffect(() => { setResizeMode(false); }, [selectedId, selectedWallId, selectedDoor, selectedPartitionId, placement, wallPlacement, preview, editMode]);

  const commitBuilding = useCallback((next: ShopDocument | ((doc: ShopDocument) => ShopDocument)) => {
    setHistory((current) => {
      const value = typeof next === 'function' ? next(current.present) : next;
      return value === current.present ? current : { past: [...current.past, current.present].slice(-60), present: value, future: [] };
    });
  }, []);
  const commit = useCallback((next: ShopDocument | ((doc: ShopDocument) => ShopDocument)) => {
    commitBuilding(current => {
      if (activeLevel >= getLevelCount(current)) return current;
      const index = activeLevel;
      const floor = getLevelDocument(current, index);
      const value = typeof next === 'function' ? next(floor) : next;
      return value === floor ? current : replaceLevelDocument(current, index, value);
    });
  }, [activeLevel, commitBuilding]);
  const clearSelection = () => {
    setSelectedPartitionId(null);
    setPlacement(null); setWallPlacement(null); setSelectedId(null); setSelectedWallId(null);
    setSelectedDoor(false); setResizeMode(false); setInteraction(null);
  };
  const switchLevel = (index: number) => {
    clearSelection(); setRequestedLevel(index); setExteriorOnly(false);
    setView('orbit'); setCameraReset(value => value + 1);
  };
  const switchExterior = (enabled: boolean) => {
    clearSelection(); setExteriorOnly(enabled); setView('orbit'); setCameraReset(value => value + 1);
    // Reselecting repaints the same renderer; view changes use a loading transition.
    setSceneRevision(value => value + 1);
  };
  const changeLevelCount = (count: number) => {
    const next = setLevelCount(building, count);
    if (next === building) return;
    commitBuilding(next); clearSelection(); setRequestedLevel(Math.min(activeLevel, count - 1));
    setCameraReset(value => value + 1);
    announce(count < levelCount ? `Bangunan menjadi ${count} lantai. Lantai yang dihapus bisa dikembalikan dengan Urungkan.` : `${count} lantai siap ditata. Pilih lantainya untuk mulai.`);
  };
  // ShopCanvas updates the scene before this parent effect resets its framing.
  useEffect(() => { if (cameraReset) scene.current?.resetCamera(); }, [cameraReset]);
  const restartShop = (blank: boolean) => {
    const next = blank ? createBlankShop() : createInitialShop();
    if (JSON.stringify(next) !== JSON.stringify(building)) commitBuilding(next);
    setRequestedLevel(0); setExteriorOnly(false); clearSelection();
    setResizeMode(false); setPreview(false); setFileMenu(false); setInteraction(null);
    setEditMode(blank ? 'build' : 'arrange'); setBuildTool('add'); setTab(blank ? 'room' : 'furniture'); setFilter('all');
    setShowGrid(blank); setShowWalls(true); setShowCity(true); setView('orbit'); setCameraReset(value => value + 1);
    if (!blank) setNightMode(false);
    announce(blank ? 'Semua sudah kosong. Klik petak untuk mulai membangun. Bisa diurungkan.' : 'Toko contoh awal kembali. Bisa diurungkan.');
  };
  const commitGesture = useCallback((next: ShopDocument, label?: string) => {
    commit(next);
    if (label) announce(label);
  }, [commit, announce]);
  const changeMode = (mode: 'arrange' | 'build') => {
    setSelectedPartitionId(null);
    setExteriorOnly(false);
    setEditMode(mode); setTab(mode === 'build' ? 'room' : 'furniture');
    setPlacement(null); setSelectedId(null); setWallPlacement(null); setSelectedWallId(null); setSelectedDoor(false);
    if (mode === 'build') setShowWalls(true);
  };
  const undo = useCallback(() => {
    setPlacement(null); setWallPlacement(null);
    setHistory((current) => current.past.length ? { past: current.past.slice(0, -1), present: current.past.at(-1)!, future: [current.present, ...current.future] } : current);
  }, []);
  const redo = useCallback(() => {
    setPlacement(null); setWallPlacement(null);
    setHistory((current) => current.future.length ? { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1) } : current);
  }, []);
  const updateSelected = (patch: Partial<ShopItem>) => {
    if (!selected) return;
    if (Object.entries(patch).every(([key, value]) => selected[key as keyof ShopItem] === value)) return;
    const next = updateItem(shop, selected.id, patch);
    if (next === shop) announce('Belum muat di sini. Pindahkan ke area yang lebih lega.');
    else commit(next);
  };
  const rotate = useCallback(() => {
    if (wallPlacement || selectedWallId) return;
    if (placement) { setPlacement({ ...placement, rotation: ((placement.rotation + 90) % 360) as Rotation }); return; }
    if (!selected) return;
    const next = updateItem(shop, selected.id, { rotation: ((selected.rotation + 90) % 360) as Rotation });
    if (next === shop) announce('Belum bisa diputar di sini. Geser ke area yang lebih lega.');
    else commit(next);
  }, [placement, selected, shop, commit, announce, wallPlacement, selectedWallId]);
  const deleteSelected = useCallback(() => {
    if (selectedPartitionId) { commit(removePartition(shop, selectedPartitionId)); setSelectedPartitionId(null); return; }
    if (selectedWallId) {
      commit(removeWallItem(shop, selectedWallId)); setSelectedWallId(null); setSelectedDoor(false); setWallPlacement(null); announce('Aksesori dinding dihapus. Bisa dikembalikan dengan Urungkan.'); return;
    }
    if (!selected) return;
    commit(removeItem(shop, selected.id)); setSelectedId(null); setPlacement(null); announce('Barang dihapus. Bisa dikembalikan dengan Urungkan.');
  }, [selected, selectedWallId, selectedPartitionId, shop, commit, announce]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (help) { if (event.key === 'Escape') setHelp(false); return; }
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') { setPlacement(null); setSelectedId(null); setWallPlacement(null); setSelectedWallId(null); setSelectedDoor(false); setSelectedPartitionId(null); setFileMenu(false); }
      if (preview) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (!exteriorOnly && event.key.toLowerCase() === 'r') rotate();
      else if (!exteriorOnly && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [rotate, deleteSelected, undo, redo, preview, help, exteriorOnly]);

  const startPlacement = (kind: ItemKind, clone?: ShopItem) => {
    setSelectedPartitionId(null);
    if (!getFloorCells(shop).length) { changeMode('build'); setBuildTool('add'); setShowGrid(true); announce('Gambar lantainya dulu. Klik atau sapu petak transparan.'); return; }
    setEditMode('arrange'); setWallPlacement(null); setSelectedWallId(null); setSelectedDoor(false);
    const item = clone ? { ...clone, id: createItem(kind).id } : createItem(kind);
    let free: ShopItem | null = null;
    const bounds = getItemPlacementBounds(shop, kind);
    const rows = Array.from({ length: bounds.maxZ - bounds.minZ + 1 }, (_, i) => bounds.minZ + i);
    if (isStandingSign(kind)) rows.sort((a, b) => Number(b > floorBounds.maxZ) - Number(a > floorBounds.maxZ) || a - b);
    for (const z of rows) for (let x = bounds.minX; x <= bounds.maxX && !free; x++) {
      const candidate = { ...item, x, z }; if (canPlace(shop, candidate)) free = candidate;
    }
    if (!free) { announce('Ruangnya penuh. Hapus barang atau perbesar ruangan dulu.'); return; }
    setPlacement(free); setSelectedId(null); setShowGrid(true);
  };
  const placeAt = useCallback((x: number, z: number) => {
    if (!placement || preview) return;
    const candidate = { ...placement, x, z };
    if (!canPlace(shop, candidate, moving ? placement.id : undefined)) { announce(isStandingSign(candidate.kind) ? 'Pilih petak kosong di lantai atau trotoar depan toko.' : 'Ada barang lain atau melewati lantai. Coba petak yang kosong.'); return; }
    const next = moving ? updateItem(shop, placement.id, { x, z, rotation: placement.rotation }) : placeItem(shop, candidate);
    commit(next); setSelectedId(candidate.id); setPlacement(null);
    announce(moving ? 'Posisinya sudah pas.' : `${CATALOG.find((entry) => entry.kind === candidate.kind)?.name} ditambahkan.`);
  }, [placement, shop, moving, preview, commit, announce]);
  const hoverCell = useCallback((cell: { x: number; z: number } | null) => {
    if (!cell) return;
    setPlacement((item) => item && (item.x !== cell.x || item.z !== cell.z) ? { ...item, x: cell.x, z: cell.z } : item);
  }, []);
  const selectItem = useCallback((id: string | null) => { setSelectedPartitionId(null); setSelectedId(id); setPlacement(null); setSelectedWallId(null); setSelectedDoor(false); setWallPlacement(null); if (id) { setEditMode('arrange'); setTab('furniture'); } }, []);
  const selectWallItem = useCallback((id: string | null) => {
    setSelectedPartitionId(null); setSelectedDoor(false); setSelectedWallId(id); setWallPlacement(null); setSelectedId(null); setPlacement(null);
    if (id) { setEditMode('arrange'); setTab('furniture'); setFilter('wall'); setShowWalls(true); }
  }, []);
  const selectDoor = useCallback(() => {
    setSelectedPartitionId(null);
    setSelectedId(null); setSelectedWallId(null); setPlacement(null); setWallPlacement(null);
    setSelectedDoor(true); setShowWalls(true);
  }, []);
  const selectPartition = useCallback((id: string | null) => {
    setSelectedPartitionId(id); setSelectedId(null); setSelectedWallId(null); setSelectedDoor(false);
    setPlacement(null); setWallPlacement(null); setResizeMode(false);
    if (id) { setEditMode('build'); setBuildTool('partition'); setTab('room'); setShowWalls(true); }
  }, []);
  const drawPartition = () => {
    clearSelection(); setExteriorOnly(false); setEditMode('build'); setBuildTool('partition'); setTab('room'); setShowWalls(true); setShowGrid(true);
    announce('Seret garis petak untuk membangun tembok dalam.');
  };
  const startWallPlacement = (kind: WallItemKind, clone?: WallItem) => {
    setSelectedPartitionId(null);
    if (!getFloorCells(shop).length) { changeMode('build'); setBuildTool('add'); setShowGrid(true); announce('Gambar lantainya dulu. Dinding akan mengikuti bentuk lantai.'); return; }
    const item = clone ? { ...clone, id: createWallItem(kind).id } : createWallItem(kind, shop.name);
    const free = findWallPlacement(shop, item, clone);
    if (!free) { announce('Belum ada bidang dinding yang cukup. Geser aksesori lain atau perbesar ruang dulu.'); return; }
    setWallPlacement(free); setSelectedWallId(null); setSelectedDoor(false); setPlacement(null); setSelectedId(null);
    setEditMode('arrange'); setTab('furniture'); setShowWalls(true);
  };
  const updateSelectedWall = (patch: Partial<WallItem>) => {
    if (!selectedWall) return;
    const next = updateWallItem(shop, selectedWall.id, patch);
    if (next === shop && Object.entries(patch).some(([key, value]) => selectedWall[key as keyof WallItem] !== value)) announce('Posisi ini belum pas. Pilih bagian dinding yang lebih lega.');
    else commit(next);
  };
  const placeWallAt = useCallback((candidate: WallItem) => {
    if (!wallPlacement || preview) return;
    const previewItem = { ...wallPlacement, wall: candidate.wall, line: candidate.line, offset: candidate.offset, height: candidate.height };
    const item = snappedWallItem(previewItem);
    const isMoving = getWallItems(shop).some((existing) => existing.id === item.id);
    if (!canPlaceWallItem(shop, previewItem, isMoving ? item.id : undefined) || !canPlaceWallItem(shop, item, isMoving ? item.id : undefined)) { announce('Aksesori belum muat di sini. Pilih bidang dinding yang kosong.'); return; }
    const next = isMoving ? updateWallItem(shop, item.id, item) : placeWallItem(shop, item);
    if (next === shop && !isMoving) return;
    commit(next); setSelectedWallId(item.id); setWallPlacement(null);
    announce(isMoving ? 'Aksesori sudah pindah.' : `${WALL_CATALOG.find((entry) => entry.kind === item.kind)?.name} dipasang.`);
  }, [wallPlacement, preview, shop, commit, announce]);
  const hoverWall = useCallback((candidate: WallItem | null) => {
    if (!candidate) return;
    setWallPlacement((item) => item && (item.wall !== candidate.wall || item.line !== candidate.line || item.offset !== candidate.offset || item.height !== candidate.height) ? { ...item, wall: candidate.wall, line: candidate.line, offset: candidate.offset, height: candidate.height } : item);
  }, []);
  const exportDesign = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(building, null, 2)], { type: 'application/json' }));
    downloadFile(url, `${building.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'tokoku'}.store-maker.json`);
    setTimeout(() => URL.revokeObjectURL(url), 2000); setFileMenu(false); announce('File desain diunduh. Bisa dibuka lagi di sini.');
  };
  const takePhoto = () => {
    const png = scene.current?.capture(); if (png) { downloadFile(png, 'store-maker.png'); announce('Foto toko diunduh. Saatnya pamer!'); } else announce('Kamera belum siap. Coba lagi sebentar.');
  };
  const importDesign = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error();
      const doc = parseShop(JSON.parse(await file.text())); if (!doc) throw new Error();
      commitBuilding(upgradeShop(doc)); setRequestedLevel(0); setExteriorOnly(false); clearSelection(); setFileMenu(false); setView('orbit'); setCameraReset(value => value + 1);
      if (!getFloorCells(doc).length) { setEditMode('build'); setBuildTool('add'); setTab('room'); setShowGrid(true); setPreview(false); setView('orbit'); setCameraReset(value => value + 1); }
      announce('Desain berhasil dibuka. Selamat melanjutkan!');
    } catch { announce('File tidak valid. Pilih file desain JSON hasil simpan dari Store Maker.'); }
    if (importer.current) importer.current.value = '';
  };
  const setCamera = (next: typeof view) => { setView(next); scene.current?.setView(next); };
  const displayedCatalog = CATALOG.filter((entry) => {
    if (entry.kind === 'bathroom') return false;
    const dedicatedFood = FOOD_ITEMS.has(entry.kind) && entry.kind !== 'counter' && entry.kind !== 'stool';
    if (filter === 'all') return true;
    if (filter === 'utility') return UTILITY_ITEMS.has(entry.kind);
    if (filter === 'food') return FOOD_ITEMS.has(entry.kind);
    if (filter === 'display') return entry.stockable && !dedicatedFood;
    if (filter === 'decor') return !entry.stockable && !dedicatedFood && !UTILITY_ITEMS.has(entry.kind);
    return filter === 'sign' && isStandingSign(entry.kind);
  });
  const showWallCatalog = filter === 'all' || filter === 'wall';

  return <div className={`app-shell ${preview ? 'is-preview' : ''}`}>
    <header className="main-header">
      <a className="brand" href="#" aria-label="Store Maker" onClick={(e) => { e.preventDefault(); setPreview(false); setExteriorOnly(false); clearSelection(); scene.current?.resetCamera(); setView('orbit'); }}><img className="brand-mark" src="/favicon.svg" alt="" width="44" height="44" /><span className="brand-copy"><span className="brand-name">Store <span>Maker</span></span><span className="brand-credit">Powered by <span className="credit-nemu">nemu</span></span></span></a>
      <div className="header-actions"><AmbienceControl /><button className="text-button help-button" aria-label="Cara main" onClick={() => setHelp(true)}><CircleHelp size={17} /><span>Cara main</span></button><span className="beta-tag">PLAYGROUND <span>01</span></span></div>
    </header>

    <main>
      <div className="workspace-heading">
        <div className="shop-heading"><span className="shop-heading-icon"><Store size={23} /></span><div><label className="eyebrow" htmlFor="shop-name">TOKO KECIL PUNYAMU</label><input id="shop-name" aria-label="Nama toko" maxLength={80} value={building.name} onChange={(e) => { const name = e.target.value; commitBuilding(doc => renameShop(doc, name)); }} onBlur={() => commitBuilding(doc => doc.name.trim() ? doc : renameShop(doc, 'Toko Kecilku'))} /></div><span className={`save-status ${saved ? '' : 'save-error'}`} title={saved ? 'Disimpan di browser ini' : 'Penyimpanan browser tidak tersedia. Unduh file desain.'}>{saved ? <CheckCheck size={15} /> : <Save size={15} />}<span>{saved ? 'Tersimpan' : 'Unduh cadangan'}</span></span></div>
        <div className="workspace-actions">
          {!preview && <div className="history-actions"><button className="icon-button" title="Urungkan (Ctrl Z)" aria-label="Urungkan" disabled={!history.past.length} onClick={undo}><Undo2 size={18} /></button><button className="icon-button" title="Ulangi (Ctrl Shift Z)" aria-label="Ulangi" disabled={!history.future.length} onClick={redo}><Redo2 size={18} /></button></div>}
          <div className="file-menu-wrap"><button className="button button-light file-trigger" aria-label="Menu file desain" aria-expanded={fileMenu} onClick={() => setFileMenu(!fileMenu)}><ArrowDownToLine size={16} /><span>Desain</span><ChevronDown size={13} /></button>{fileMenu && <><button className="menu-dismiss" aria-label="Tutup menu desain" onClick={() => setFileMenu(false)} /><div className="file-menu"><button onClick={exportDesign}><ArrowDownToLine size={16} />Simpan file desain</button><button onClick={() => { importer.current?.click(); setFileMenu(false); }}><Upload size={16} />Buka file desain</button><button onClick={takePhoto}><Camera size={16} />Unduh foto toko</button></div></>}</div>
          <input ref={importer} aria-label="Buka file desain" className="visually-hidden" type="file" accept=".json,.store-maker.json,.nemu.json,application/json" onChange={(e) => void importDesign(e.target.files?.[0])} />
          <button className={`button ${preview ? 'button-dark' : 'button-purple'}`} onClick={() => { setPreview(!preview); setPlacement(null); setSelectedId(null); setWallPlacement(null); setSelectedWallId(null); setSelectedDoor(false); }} aria-pressed={preview}>{preview ? <ArrowLeft size={16} /> : <Eye size={17} />}<span>{preview ? 'Kembali ngatur' : 'Lihat tokoku'}</span></button>
        </div>
      </div>

      <div className="building-navigation" aria-label="Bangunan dan lantai">
        <div className="building-view-switch" role="group" aria-label="Tampilan bangunan">
          <button className={!exteriorOnly ? 'active' : ''} aria-pressed={!exteriorOnly} onClick={() => switchExterior(false)}><Layers3 size={16} />Interior</button>
          <button className={exteriorOnly ? 'active' : ''} aria-pressed={exteriorOnly} onClick={() => switchExterior(true)}><Building2 size={16} />Eksterior</button>
        </div>
        <div className="floor-navigation" role="group" aria-label="Pilih lantai">
          {Array.from({ length: levelCount }, (_, index) => <button key={index} className={!exteriorOnly && activeLevel === index ? 'active' : ''} aria-label={`Edit lantai ${index + 1}`} aria-pressed={!exteriorOnly && activeLevel === index} onClick={() => switchLevel(index)}><span>LT</span> {index + 1}</button>)}
        </div>
        <span className="building-view-note">{exteriorOnly ? 'Seluruh bangunan, dari luar.' : `Menata lantai ${activeLevel + 1} dari ${levelCount}.`}</span>
        {!preview && <label className="floor-count-field"><span>Jumlah lantai</span><select aria-label="Jumlah lantai" value={levelCount} onChange={event => changeLevelCount(Number(event.target.value))}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>{count} lantai</option>)}</select></label>}
      </div>
      <div className={`builder-layout ${exteriorOnly ? 'exterior-layout' : ''}`}>
        {!preview && <aside className="library-panel">
          <div className="panel-tabs"><button className={!exteriorOnly && tab === 'furniture' ? 'active' : ''} onClick={() => changeMode('arrange')}><Layers3 size={16} />Isi toko</button><button className={!exteriorOnly && tab === 'room' ? 'active' : ''} onClick={() => changeMode('build')}><Paintbrush size={16} />Ruangan</button></div>
          <div className="restart-actions" role="group" aria-label="Mulai ulang toko">
            <button className="button button-light" onClick={() => restartShop(false)}><RotateCcw size={15} /><span>Reset ke toko contoh</span></button>
            <button className="button button-light clear-shop-button" onClick={() => restartShop(true)}><Eraser size={15} /><span>Kosongkan semua</span></button>
            <p>Kosongkan semua menghapus barang, lantai, dinding, dan pintu. Keduanya bisa diurungkan.</p>
          </div>
          {exteriorOnly ? <ExteriorSettings building={building} onChange={commitBuilding} /> : tab === 'furniture' ? <>
            <div className="library-heading"><h2>Mulai dari yang kamu suka.</h2><p>Barang kecil, karakter besar.</p></div>
            <div className="category-tabs" aria-label="Kategori perabot"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Semua</button><button className={filter === 'display' ? 'active' : ''} onClick={() => setFilter('display')}>Pajangan</button><button className={filter === 'food' ? 'active' : ''} onClick={() => setFilter('food')}>Toko makanan</button><button className={filter === 'utility' ? 'active' : ''} onClick={() => setFilter('utility')}>Gudang & utilitas</button><button className={filter === 'decor' ? 'active' : ''} onClick={() => setFilter('decor')}>Dekor</button><button className={filter === 'sign' ? 'active' : ''} onClick={() => setFilter('sign')}>Papan</button><button className={filter === 'wall' ? 'active' : ''} onClick={() => setFilter('wall')}>Dinding</button></div>
            <div className="catalog-grid">{displayedCatalog.map((entry) => <button key={entry.kind} className={`catalog-card ${placement?.kind === entry.kind && !moving ? 'active' : ''}`} aria-label={`Tambah ${entry.name}`} data-testid={`catalog-${entry.kind}`} onClick={() => startPlacement(entry.kind)}><span className="catalog-plus"><Plus size={13} /></span><FurnitureArt kind={entry.kind} color={entry.color} /><strong>{entry.name}</strong><span>{entry.width} × {entry.depth} petak</span></button>)}{showWallCatalog && WALL_CATALOG.map((entry) => <button key={entry.kind} className={`catalog-card ${wallPlacement?.kind === entry.kind && !movingWall ? 'active' : ''}`} aria-label={`Tambah ${entry.name}`} data-testid={`catalog-${entry.kind}`} onClick={() => startWallPlacement(entry.kind)}><span className="catalog-plus"><Plus size={13} /></span><WallArt kind={entry.kind} color={entry.color} /><strong>{entry.name}</strong><span>Tempel di dinding</span></button>)}</div>
            {filter === 'wall' && <p className="wall-catalog-note">Pilih aksesori, lalu klik dinding. Seret untuk mengatur posisi dan tingginya.</p>}
            {filter === 'utility' && <p className="wall-catalog-note">Tata toilet, wastafel, dan shower satu per satu. Bagi ruangnya lewat Ruangan → Tembok dalam; pilih lantai sebelum menata tangga atau rak gudang.</p>}
            {filter === 'food' && <p className="wall-catalog-note">Dari dapur kecil sampai meja makan. Pilih perlengkapannya, lalu isi etalase dengan sajian favoritmu.</p>}
            {filter === 'sign' && <p className="wall-catalog-note">Sambut pengunjung dengan papan pilihanmu. Taruh di lantai atau trotoar depan, lalu seret dan putar sesukamu.</p>}
            <div className="inventory-picker"><label className="field-label" htmlFor="inventory-select">BARANG DI TOKOMU</label><select id="inventory-select" aria-label="Pilih barang di toko" value={selectedWallId ? `wall:${selectedWallId}` : selectedId ?? ''} onChange={(e) => e.target.value.startsWith('wall:') ? selectWallItem(e.target.value.slice(5)) : selectItem(e.target.value || null)}><option value="">Pilih barang ({shop.items.length + wallItems.length})</option><optgroup label="Di lantai">{shop.items.map((item, i) => <option key={item.id} value={item.id}>{CATALOG.find((entry) => entry.kind === item.kind)?.name} · {i + 1}</option>)}</optgroup><optgroup label="Di dinding">{wallItems.map((item, i) => <option key={item.id} value={`wall:${item.id}`}>{WALL_CATALOG.find((entry) => entry.kind === item.kind)?.name} · {i + 1}</option>)}</optgroup></select></div>
            <div className="library-note"><Sparkles size={17} /><p>Nggak ada benar atau salah.<br /><strong>Yang penting, kamu banget.</strong></p></div>
          </> : <div className="room-settings">
            <div className="library-heading"><h2>Petak kecil.<br />Bentuk sesukamu.</h2><p>Bentuk L, sudut kecil, atau teras baru.</p></div>
            <div className="drag-tip"><Grid2X2 size={19} /><p>Klik atau sapu petak transparan.<br /><strong>Dinding mengikuti bentuk lantai.</strong></p></div>
            <div className="floor-summary"><span className="floor-mini-grid" aria-hidden="true"><i/><i/><i/><i/><i/><i/></span><div><strong>{floorCount} petak lantai</strong><span>Setiap petak punya kemungkinan.</span></div></div>
            <div className="room-partition-entry">
              <span className="field-label">TEMBOK & PINTU DALAM</span>
              <p className="muted small">Pisahkan kamar mandi, gudang, atau ruang kerja dengan tembok dan pintu yang bisa kamu atur sendiri.</p>
              <button className="button button-light full-width" aria-label="Atur tembok dalam" onClick={() => { drawPartition(); setSelectedPartitionId(getPartitions(shop)[0]?.id ?? null); }}><Grid2X2 size={16} /><span>Atur tembok dalam</span><small>{getPartitions(shop).length} tembok</small></button>
            </div>
            <label className="field-label spaced">WARNA DINDING</label><ColorPicker colors={WALL_COLORS} value={shop.wallColor} label="dinding" onChange={(color) => commit({ ...shop, wallColor: color })} />
            <label className="field-label spaced">WARNA LANTAI</label><ColorPicker colors={FLOOR_COLORS} value={shop.floorColor} label="lantai" onChange={(color) => commit({ ...shop, floorColor: color })} />
          </div>}
        </aside>}

        <div className="scene-workspace">
          {!preview && !exteriorOnly && <div className="scene-toolbar" role="region" aria-label="Pengaturan editor" data-testid="scene-toolbar">
            {!preview && !placement && !wallPlacement && <div className="edit-mode-switch" aria-label="Mode editor"><button className={editMode === 'arrange' ? 'active' : ''} aria-label="Atur barang" aria-pressed={editMode === 'arrange'} onClick={() => changeMode('arrange')}><MousePointer2 size={15} />Atur barang</button><button className={editMode === 'build' ? 'active' : ''} aria-label="Bangun ruangan" aria-pressed={editMode === 'build'} onClick={() => changeMode('build')}><Expand size={15} />Bangun</button></div>}
            {!preview && editMode === 'build' && !placement && !wallPlacement && <div className="build-tool-switch" aria-label="Alat bentuk ruangan"><button className={buildTool === 'add' ? 'active' : ''} aria-label="Tambah lantai" aria-pressed={buildTool === 'add'} onClick={() => { clearSelection(); setBuildTool('add'); }}><Plus size={14} />Lantai</button><button className={buildTool === 'erase' ? 'active' : ''} aria-label="Hapus lantai" aria-pressed={buildTool === 'erase'} onClick={() => { clearSelection(); setBuildTool('erase'); }}><Eraser size={14} />Hapus</button><button className={buildTool === 'walls' ? 'active' : ''} aria-label="Atur dinding dan pintu" aria-pressed={buildTool === 'walls'} onClick={() => { clearSelection(); setBuildTool('walls'); }}><DoorOpen size={14} />{activeLevel === 0 ? 'Dinding & pintu' : 'Dinding'}</button><button className={buildTool === 'partition' ? 'active' : ''} aria-label="Tembok dalam" aria-pressed={buildTool === 'partition'} onClick={drawPartition}><Grid2X2 size={14} />Sekat</button></div>}
            {!preview && !placement && !wallPlacement && <div className="gesture-hint" data-testid="gesture-hint"><span className="tiny-spark">✦</span>{resizeMode ? 'Seret ujungnya atau klik petak tujuan.' : editMode === 'build' ? buildTool === 'partition' ? 'Seret garis petak untuk membuat tembok. Klik tembok untuk memasang pintu.' : buildTool === 'walls' ? activeLevel === 0 ? 'Tarik tinggi dinding atau geser pintu masuk.' : 'Tarik pegangan untuk mengatur tinggi dinding.' : buildTool === 'erase' ? 'Sapu petak untuk menghapus. Barang tetap aman.' : 'Klik atau sapu petak transparan untuk membangun.' : selectedDoor ? 'Seret pintu untuk pindah. Buka atau tutup lewat panel.' : 'Seret barang atau pintu untuk memindahkannya.'}</div>}
            {placement && <div className="placement-banner"><span className="placement-indicator" /><div><strong>{moving ? 'Pindahkan' : 'Letakkan'} {CATALOG.find((entry) => entry.kind === placement.kind)?.name}</strong><span>{isStandingSign(placement.kind) ? 'Klik lantai atau trotoar depan toko.' : 'Klik petak kosong di lantai.'}</span></div><button className="icon-button" aria-label="Putar barang" title="Putar (R)" onClick={rotate}><RotateCw size={18} /></button><button className="icon-button" aria-label="Batalkan penempatan" title="Batal (Esc)" onClick={() => setPlacement(null)}><X size={18} /></button></div>}
            {wallPlacement && <div className="placement-banner wall-placement-banner"><span className="placement-indicator" /><div><strong>{movingWall ? 'Pindahkan' : 'Pasang'} {WALL_CATALOG.find((entry) => entry.kind === wallPlacement.kind)?.name}</strong><span>Klik dinding. Hijau berarti posisinya pas.</span></div><button className="icon-button" aria-label="Batalkan penempatan aksesori" title="Batal (Esc)" onClick={() => setWallPlacement(null)}><X size={18} /></button></div>}
          </div>}
          <section className={`scene-panel ${placement || wallPlacement ? 'is-placing' : ''} ${editMode === 'build' && !preview ? 'is-building' : ''} ${showCity ? 'with-city' : ''} ${nightMode ? 'is-night' : ''}`} data-testid="scene" aria-label="Toko 3D interaktif">
            <div className="scene-topline"><span className="scene-badge">{nightMode ? <Moon size={12} /> : <span className="live-dot" />}{exteriorOnly ? 'EKSTERIOR TOKOMU' : nightMode ? 'MALAM DI TOKOMU' : preview ? 'TOKOMU, VERSI KAMU' : 'RUANG KREATIF'}</span><span className="scene-dimensions">{exteriorOnly ? levelCount : floorCount}<span>{exteriorOnly ? ' LANTAI' : ` PETAK / LT ${activeLevel + 1}`}</span></span></div>
            <ShopCanvas ref={scene} revision={sceneRevision} shop={shop} building={building} activeLevel={activeLevel} exteriorOnly={exteriorOnly} selectedId={selectedId} placement={placement} selectedWallId={selectedWallId} selectedDoor={selectedDoor} wallPlacement={wallPlacement} resizeMode={resizeMode} showGrid={showGrid && !preview} showWalls={showWalls} showCity={showCity} nightMode={nightMode} editMode={editMode} buildTool={buildTool} preview={preview} onSelect={selectItem} onSelectWall={selectWallItem} onSelectDoor={selectDoor} selectedPartitionId={selectedPartitionId} onSelectPartition={selectPartition} onCell={placeAt} onHover={hoverCell} onWallPlace={placeWallAt} onWallHover={hoverWall} onChange={commitGesture} onInteraction={setInteraction} />
            {interaction && !preview && <div className="interaction-hud" aria-live="off"><Move size={16} /><span>{interaction}</span><kbd>Esc</kbd></div>}
            {preview && <div className="preview-label"><span className="eyebrow">DIBUAT DENGAN SEDIKIT IMAJINASI</span><h2>{building.name || 'Toko Kecilku'}</h2><div className="preview-actions"><button className="button button-dark" onClick={takePhoto}><Camera size={16} />Ambil foto toko</button>{!exteriorOnly && activeLevel === 0 && floorCount > 0 && <button className="button button-light" aria-label={entrance.open ? 'Tutup pintu masuk' : 'Buka pintu masuk'} onClick={() => commit(setEntrance(shop, { open: !entrance.open }))}><DoorOpen size={16} />{entrance.open ? 'Tutup pintu' : 'Buka pintu'}</button>}</div></div>}
            <div className="scene-controls">
              <div className="camera-group" aria-label="Sudut kamera">
                <button aria-label="Kamera perspektif" aria-pressed={view === 'orbit'} className={view === 'orbit' ? 'active' : ''} onClick={() => setCamera('orbit')}><Layers3 size={17} /><span>3D</span></button>
                <button aria-label="Kamera dari atas" aria-pressed={view === 'top'} className={view === 'top' ? 'active' : ''} onClick={() => setCamera('top')}><Grid2X2 size={17} /><span>Atas</span></button>
                <button aria-label="Kamera depan" aria-pressed={view === 'front'} className={view === 'front' ? 'active' : ''} onClick={() => setCamera('front')}><Store size={17} /><span>Depan</span></button>
              </div>
              <div className="view-controls">
                <button className={`icon-button night-mode-toggle ${nightMode ? 'active' : ''}`} aria-label="Mode malam" aria-pressed={nightMode} onClick={() => setNightMode(!nightMode)} title={nightMode ? 'Mode malam · klik untuk siang' : 'Mode siang · klik untuk malam'}>{nightMode ? <Moon size={17} /> : <Sun size={17} />}</button>
                <button className={`icon-button ${showCity ? 'active' : ''}`} aria-label="Tampilkan lingkungan kota" aria-pressed={showCity} onClick={() => setShowCity(!showCity)} title="Lingkungan kota"><Building2 size={17} /></button>
                <button className={`icon-button ${showGrid ? 'active' : ''}`} aria-label="Tampilkan petak" aria-pressed={showGrid} onClick={() => setShowGrid(!showGrid)} title="Petak lantai" disabled={preview || exteriorOnly}><Grid2X2 size={17} /></button>
                <button className={`icon-button ${showWalls ? 'active' : ''}`} aria-label="Tampilkan dinding" aria-pressed={showWalls} onClick={() => setShowWalls(!showWalls)} title="Dinding" disabled={exteriorOnly}><Layers3 size={17} /></button>
                <span className="control-separator" /><button className="icon-button" aria-label="Reset kamera" title="Reset kamera" onClick={() => { scene.current?.resetCamera(); setView('orbit'); }}><Maximize2 size={17} /></button>
              </div>
            </div>
            <div className="canvas-hint"><MousePointer2 size={12} /><span>Geser area kosong untuk putar <span className="hint-dot">·</span> Scroll untuk zoom</span></div>
          </section>
        </div>

        {!preview && <aside className="inspector-panel" data-testid="inspector">
          {exteriorOnly ? <div className="exterior-guide">
            <span className="eyebrow">WAJAH BARU TOKOMU</span>
            <div className="exterior-guide-art" aria-hidden="true"><Building2 size={72} strokeWidth={1.2} /><span>{levelCount}F</span></div>
            <h2>Kecil di jalan.<br />Besar idenya.</h2>
            <p className="muted">Atur warna fasad, lis, dan atap. Putar bangunannya untuk menikmati setiap sisi.</p>
            <div className="building-facts"><span><strong>{levelCount}</strong> lantai</span><span><strong>{getRoof(building).style === 'tiles' ? 'Genteng' : 'Rooftop'}</strong> atap pilihanmu</span></div>
            <div className="level-directory"><span className="field-label">INTIP KE DALAM</span>{Array.from({ length: levelCount }, (_, index) => <button key={index} onClick={() => switchLevel(index)}><Layers3 size={17} /><span><strong>Lantai {index + 1}</strong><small>{getLevelDocument(building, index).items.length} perabot</small></span><ArrowRight size={16} /></button>)}</div>
            <p className="local-note"><CheckCheck size={13} />Semua lantai ikut tersimpan.</p>
          </div> : editMode === 'build' && buildTool === 'partition' && !placement && !wallPlacement ? <PartitionPanel shop={shop} selectedId={selectedPartitionId} onSelect={selectPartition} onChange={commit} onDraw={drawPartition} onMessage={announce} /> : selectedDoor && floorCount > 0 && !placement && !wallPlacement ? <div className="door-inspector" data-testid="door-inspector">
            <div className="inspector-head"><span className="eyebrow">AKSES MASUK TOKOMU</span><button className="icon-button" aria-label="Tutup detail pintu" onClick={() => setSelectedDoor(false)}><X size={16} /></button></div>
            <div className="door-illustration" aria-hidden="true"><span className="door-illustration-arrow">↔</span><DoorOpen size={64} strokeWidth={1.25} /></div>
            <h2>Pintu masuk</h2><p className="muted small">Seret badan pintu atau pegangan hijau untuk memindahkannya.</p>
            <DoorControls shop={shop} onChange={commit} />
            <p className="door-interaction-note"><Move size={15} /><span>Klik memilih pintu. Buka dan tutup lewat tombol di atas.</span></p>
            <p className="stock-note">Satu tarikan, satu undo. <kbd>Esc</kbd> untuk membatalkan.</p>
          </div> : editMode === 'build' && !placement && !wallPlacement ? <>
            <span className="eyebrow">BENTUK RUANGMU SENDIRI</span>
            <div className="build-diagram" aria-hidden="true"><FloorDiagram /></div>
            <h2>{floorCount ? <>Bentuknya bebas.<br />Petaknya rapi.</> : <>Mulai dari<br />petak pertamamu.</>}</h2>
            <ol className="steps build-steps"><li><span>1</span><div><strong>Sapu petak, jadi lantai</strong><p>Pilih + Lantai, lalu klik atau drag.</p></div></li><li><span>2</span><div><strong>Potong bentuknya</strong><p>Pakai Hapus buat sudut L atau ruang terbuka.</p></div></li><li><span>3</span><div><strong>Dinding ikut terbentuk</strong><p>Pilih Dinding & pintu buat atur tinggi dan akses masuk.</p></div></li></ol>
            <div className="architecture-fields"><label className="field-label" htmlFor="wall-height">TINGGI DINDING</label><select id="wall-height" aria-label="Tinggi dinding" value={getWallHeight(shop)} onChange={(e) => commit(setWallHeight(shop, Number(e.target.value)))}>{[...new Set([getWallHeight(shop), ...Array.from({ length: 23 }, (_, i) => (23 + i) / 10)])].sort((a,b) => a-b).map((height) => <option key={height} value={height}>{height.toLocaleString('id-ID')} m</option>)}</select></div>
            {activeLevel === 0 && floorCount > 0 ? <DoorControls shop={shop} onChange={commit} /> : !floorCount ? <p className="blank-shop-note">Areanya sudah kosong. Klik atau sapu petak transparan untuk membuat lantai; dinding dan pintu akan mengikuti.</p> : <p className="stock-note">Akses lantai ini melalui tangga dari lantai di bawahnya.</p>}
            <p className="stock-note">Satu tarikan, satu undo. <kbd>Esc</kbd> untuk membatalkan.</p>
          </> : selectedWall && selectedWallEntry && !wallPlacement ? <>
            <div className="inspector-head"><span className="eyebrow">SENTUHAN DI DINDING</span><button className="icon-button" aria-label="Tutup detail aksesori" onClick={() => setSelectedWallId(null)}><X size={16} /></button></div>
            <div className="selected-art"><WallArt kind={selectedWall.kind} color={selectedWall.color} windowStyle={getWindowStyle(selectedWall)} /></div><h2>{selectedWallEntry.name}</h2><p className="muted small">{selectedWallEntry.description}</p>
            <div className="object-actions"><button aria-label="Pindahkan aksesori" onClick={() => { setWallPlacement({ ...selectedWall }); setShowWalls(true); }}><Move size={17} /><span>Pindah</span></button><button aria-label="Duplikat aksesori" onClick={() => startWallPlacement(selectedWall.kind, selectedWall)}><Copy size={17} /><span>Salin</span></button><button aria-label="Hapus aksesori" className="delete-button" onClick={deleteSelected}><Trash2 size={17} /><span>Hapus</span></button></div>
            {selectedWallSize && <><p className="object-size-summary" aria-label="Ukuran aksesori">{selectedWallSize.width.toLocaleString('id-ID')} × {selectedWallSize.height.toLocaleString('id-ID')} m</p><ResizeControls key={selectedWall.id} active={resizeMode} onToggle={() => setResizeMode(!resizeMode)} wall width={selectedWallSize.width} depthOrHeight={selectedWallSize.height} onWidth={(width) => updateSelectedWall({ width })} onDepthOrHeight={(sizeHeight) => updateSelectedWall({ sizeHeight })} /></>}
            <label className="field-label spaced">PILIH WARNA</label><ColorPicker colors={COLORS} value={selectedWall.color} label="aksesori" onChange={(color) => updateSelectedWall({ color })} />
            {selectedWall.kind === 'window' && <WindowStylePicker color={selectedWall.color} value={getWindowStyle(selectedWall)} onChange={(windowStyle) => updateSelectedWall({ windowStyle })} />}
            {selectedWall.kind === 'wall-sign' && <label className="wall-text-field"><span className="field-label">TULISAN PAPAN</span><input aria-label="Tulisan papan" maxLength={80} value={selectedWall.text} onChange={(e) => updateSelectedWall({ text: e.target.value })} placeholder="Ceritakan tokomu" /></label>}
            {selectedWall.kind === 'wall-lamp' && <button className={`button button-light full-width wall-light-toggle ${selectedWall.lit ? 'active' : ''}`} aria-label="Nyalakan lampu dinding" aria-pressed={selectedWall.lit} onClick={() => updateSelectedWall({ lit: !selectedWall.lit })}><Sparkles size={16} />{selectedWall.lit ? 'Lampu menyala' : 'Lampu padam'}</button>}
            <WallPositionFields shop={shop} item={selectedWall} onChange={updateSelectedWall} onWallChange={(candidate) => candidate ? updateSelectedWall(candidate) : announce('Belum ada posisi kosong di dinding itu.')} />
            <p className="stock-note">Seret langsung di dinding untuk menggeser atau menaikkan. Satu tarikan, satu undo.</p>
          </> : wallPlacement ? <>
            <span className="eyebrow">SATU SENTUHAN BARU</span><div className="selected-art"><WallArt kind={wallPlacement.kind} color={wallPlacement.color} windowStyle={getWindowStyle(wallPlacement)} /></div><h2>Carikan dindingnya.</h2><p className="muted">Pilih sisi depan, kanan, belakang, atau kiri. Bayangan hijau berarti aksesori bisa dipasang.</p>
            {wallPlacement.kind === 'window' && <WindowStylePicker color={wallPlacement.color} value={getWindowStyle(wallPlacement)} onChange={(windowStyle) => setWallPlacement({ ...wallPlacement, windowStyle })} />}
            {wallPlacementSize && <p className="object-size-summary" aria-label="Ukuran aksesori yang dipasang">{wallPlacementSize.width.toLocaleString('id-ID')} × {wallPlacementSize.height.toLocaleString('id-ID')} m</p>}
            <WallPositionFields shop={shop} item={wallPlacement} onChange={(patch) => setWallPlacement({ ...wallPlacement, ...patch })} onWallChange={(candidate) => candidate ? setWallPlacement(candidate) : announce('Belum ada posisi kosong di dinding itu.')} />
            <button className="button button-purple full-width wall-place-confirm" disabled={!wallPlacementValid} onClick={() => placeWallAt(wallPlacement)}>Pasang di sini<Check size={15} /></button><button className="text-button full-width" onClick={() => setWallPlacement(null)}>Batal</button>
          </> : selected && selectedEntry && !placement ? <>
            <div className="inspector-head"><span className="eyebrow">SENTUHAN KECILMU</span><button className="icon-button" aria-label="Tutup detail barang" onClick={() => setSelectedId(null)}><X size={16} /></button></div>
            <div className="selected-art"><FurnitureArt kind={selected.kind} color={selected.color} /></div><h2>{selectedEntry.name}</h2><p className="muted small">{selectedEntry.description}</p>
            <div className="object-actions"><button onClick={() => { setPlacement({ ...selected }); setShowGrid(true); }} aria-label="Pindahkan barang"><Move size={17} /><span>Pindah</span></button><button onClick={rotate} aria-label="Putar barang"><RotateCw size={17} /><span>Putar</span></button><button onClick={() => startPlacement(selected.kind, selected)} aria-label="Duplikat barang"><Copy size={17} /><span>Salin</span></button><button onClick={deleteSelected} aria-label="Hapus barang" className="delete-button"><Trash2 size={17} /><span>Hapus</span></button></div>
            {selectedSize && selectedFootprint && <><p className="object-size-summary" aria-label="Ukuran barang">Jejak lantai {selectedFootprint.width} × {selectedFootprint.depth} petak</p><ResizeControls key={selected.id} active={resizeMode} onToggle={() => setResizeMode(!resizeMode)} width={selectedSize.width} depthOrHeight={selectedSize.depth} onWidth={(width) => updateSelected({ width })} onDepthOrHeight={(depth) => updateSelected({ depth })} /></>}
            {isStandingSign(selected.kind) && <><label className="field-label spaced">VARIASI PAPAN</label><div className="sign-style-options" role="group" aria-label="Variasi papan">{CATALOG.filter((entry) => isStandingSign(entry.kind)).map((entry) => <button key={entry.kind} className={selected.kind === entry.kind ? 'active' : ''} aria-label={`Ganti ke ${entry.name}`} aria-pressed={selected.kind === entry.kind} onClick={() => updateSelected({ kind: entry.kind })}><FurnitureArt kind={entry.kind} color={selected.color} /><span>{entry.name}</span></button>)}</div><p className="stock-note">Seret papan langsung ke lantai atau trotoar depan. Tekan R untuk memutar.</p></>}
            <label className="field-label spaced">PILIH WARNA</label><ColorPicker colors={COLORS} value={selected.color} label="perabot" onChange={(color) => updateSelected({ color })} />
            {selectedEntry.stockable && <StockPicker key={selected.id} item={selected} onChange={(stock) => updateSelected({ stock })} />}
            <div className="position-editor"><label className="field-label">{isStandingSign(selected.kind) ? 'POSISI PAPAN' : 'POSISI DI LANTAI'}</label><div className="position-fields"><label>X<select aria-label="Posisi X" value={selected.x} onChange={(e) => updateSelected({ x: Number(e.target.value) })}>{positionsX.map((i) => <option key={i} value={i}>{i + 1}</option>)}</select></label><label>Y<select aria-label="Posisi Y" value={selected.z} onChange={(e) => updateSelected({ z: Number(e.target.value) })}>{positionsZ.map((i) => <option key={i} value={i}>{i + 1}</option>)}</select></label><span>{selected.rotation}°</span></div></div>
          </> : placement ? <>
            <span className="eyebrow">SATU IDE BARU</span><div className="selected-art"><FurnitureArt kind={placement.kind} color={placement.color} /></div><h2>Carikan tempatnya.</h2><p className="muted">{isStandingSign(placement.kind) ? 'Klik lantai atau trotoar depan untuk meletakkan papan.' : 'Klik lantai untuk meletakkan barang.'} Bayangan hijau berarti tempatnya pas.</p>
            {placementFootprint && <p className="object-size-summary" aria-label="Ukuran barang yang diletakkan">Jejak lantai {placementFootprint.width} × {placementFootprint.depth} petak</p>}
            <div className="placement-manual"><label className="field-label">ATAU PILIH PETAK</label><div className="position-fields"><label>X<select aria-label="Petak X" value={Math.max(placementBounds.minX, Math.min(placementBounds.maxX, placement.x))} onChange={(e) => setPlacement({ ...placement, x: Number(e.target.value) })}>{positionsX.map((i) => <option key={i} value={i}>{i + 1}</option>)}</select></label><label>Y<select aria-label="Petak Y" value={Math.max(placementBounds.minZ, Math.min(placementBounds.maxZ, placement.z))} onChange={(e) => setPlacement({ ...placement, z: Number(e.target.value) })}>{positionsZ.map((i) => <option key={i} value={i}>{i + 1}</option>)}</select></label></div><button className="button button-purple full-width" disabled={!canPlace(shop, placement, moving ? placement.id : undefined)} onClick={() => placeAt(placement.x, placement.z)}>Letakkan di sini<Check size={15} /></button><button className="button button-light full-width" onClick={rotate}><RotateCw size={15} />Putar 90°</button><button className="text-button full-width" onClick={() => setPlacement(null)}>Batal</button></div>
          </> : <>
            <span className="eyebrow">INI DUNIA KECILMU</span><div className="welcome-illustration"><span className="welcome-orbit orbit-one" /><span className="welcome-orbit orbit-two" /><Store size={48} strokeWidth={1.35} /><span className="illustration-spark">✦</span><span className="illustration-dot" /></div><h2>Tokonya kamu.<br />Ceritanya juga.</h2><p className="muted">Toko buku di sudut kota?<br />Atau tempat barang unik ketemu pemilik baru?</p>
            <ol className="steps"><li><span>1</span><div><strong>Pilih, taruh, geser</strong><p>Seret barang langsung di dalam toko.</p></div></li><li><span>2</span><div><strong>Bentuk ruang sesukamu</strong><p>Pilih Bangun, lalu sapu petak lantainya.</p></div></li><li><span>3</span><div><strong>Atur pintu masuk</strong><p>Seret untuk pindah. Klik untuk melihat pengaturannya.</p></div></li></ol>
            <div className="shop-stat"><span><strong>{shop.items.length + wallItems.length}</strong> sentuhan kecil</span><span className="stat-flower">✳</span></div><p className="local-note"><CheckCheck size={13} />Tersimpan di browser ini.</p>
          </>}
        </aside>}
      </div>
      <footer className="workspace-footer"><span><span className="footer-spark">✦</span> Bikin tempat yang bikin orang pengin mampir.</span><span>Made for the joy of making.</span></footer>
    </main>
    <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite"><Check size={16} />{toast}</div>
    {help && <HelpDialog onClose={() => setHelp(false)} />}
  </div>;
}

function ColorPicker({ colors, value, label, onChange }: { colors: string[]; value: string; label: string; onChange: (color: string) => void }) {
  return <div className="color-picker" role="group" aria-label={`Warna ${label}`}>{colors.map((color, i) => <button key={color} style={{ background: color }} className={value.toLowerCase() === color.toLowerCase() ? 'selected' : ''} aria-label={`Warna ${label} ${i + 1}`} aria-pressed={value.toLowerCase() === color.toLowerCase()} onClick={() => onChange(color)}>{value.toLowerCase() === color.toLowerCase() && <Check size={15} />}</button>)}</div>;
}

function StockPicker({ item, onChange }: { item: ShopItem; onChange: (stock: ProductKind) => void }) {
  const allowed = getAllowedStocks(item.kind);
  const options = STOCK.filter(option => allowed.includes(option.value));
  const hasFood = options.some(option => FOOD_STOCK.has(option.value));
  const hasGoods = options.some(option => !FOOD_STOCK.has(option.value));
  const [group, setGroup] = useState<'goods' | 'food'>(() => FOOD_STOCK.has(item.stock) || (item.stock === 'none' && FOOD_ITEMS.has(item.kind)) ? 'food' : 'goods');
  useEffect(() => {
    if (item.stock !== 'none') setGroup(FOOD_STOCK.has(item.stock) ? 'food' : 'goods');
    else if (!hasGoods && hasFood) setGroup('food');
  }, [item.stock, item.kind, hasGoods, hasFood]);
  const activeGroup = group === 'food' && hasFood ? 'food' : hasGoods ? 'goods' : 'food';
  const visible = options.filter(option => FOOD_STOCK.has(option.value) === (activeGroup === 'food'));
  return <div className="stock-picker"><span className="field-label spaced">MAU DIISI APA?</span>
    {hasGoods && hasFood && <div className="stock-group-switch" role="group" aria-label="Kelompok isi pajangan"><button className={activeGroup === 'goods' ? 'active' : ''} aria-pressed={activeGroup === 'goods'} onClick={() => setGroup('goods')}><ShoppingBag size={13} />Barang</button><button className={activeGroup === 'food' ? 'active' : ''} aria-pressed={activeGroup === 'food'} onClick={() => setGroup('food')}><UtensilsCrossed size={13} />Makanan</button></div>}
    <div className="stock-options">{visible.map(({ value, name, label, icon: Icon }) => <button key={value} className={item.stock === value ? 'active' : ''} aria-label={`Isi dengan ${label}`} aria-pressed={item.stock === value} onClick={() => onChange(value)}><Icon size={16} /><span>{name}</span>{item.stock === value && <Check size={12} />}</button>)}</div>
    <button className={`stock-empty ${item.stock === 'none' ? 'active' : ''}`} aria-label="Isi dengan tanpa barang" aria-pressed={item.stock === 'none'} onClick={() => onChange('none')}><X size={14} /><span>Kosong</span>{item.stock === 'none' && <Check size={12} />}</button>
    <p className="stock-note">{activeGroup === 'food' ? 'Sajiannya langsung tampil di pajanganmu.' : 'Barangnya langsung muncul di pajanganmu.'}</p>
  </div>;
}

function WindowStylePicker({ color, value, onChange }: { color: string; value: WindowStyle; onChange: (style: WindowStyle) => void }) {
  return <div className="window-style-picker"><span className="field-label">VARIASI JENDELA</span><div className="window-style-options" role="group" aria-label="Variasi jendela">
    {WINDOW_STYLES.map(({ id, label }) => <button key={id} className={value === id ? 'active' : ''} aria-label={`Jendela ${label}`} aria-pressed={value === id} onClick={() => { if (value !== id) onChange(id); }}><WallArt kind="window" color={color} windowStyle={id} /><span>{label}</span>{value === id && <Check className="window-style-check" size={11} />}</button>)}
  </div></div>;
}

function DimensionField({ label, accessibleLabel, value, min, max, step, unit, onCommit }: { label: string; accessibleLabel: string; value: number; min: number; max: number; step: number; unit: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const finish = (text: string) => {
    const next = Number(text);
    // Model validation owns collisions and limits; rejected input returns to the saved size.
    if (text.trim() && Number.isFinite(next) && next !== value) onCommit(next);
    setDraft(String(value));
  };
  return <label className="dimension-field"><span>{label}</span><div><input aria-label={accessibleLabel} type="number" inputMode={step === 1 ? 'numeric' : 'decimal'} min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={(event) => finish(event.currentTarget.value)} onKeyDown={(event) => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.value = String(value); setDraft(String(value)); event.currentTarget.blur(); }
  }} /><span>{unit}</span></div></label>;
}

function ResizeControls({ active, onToggle, wall = false, width, depthOrHeight, onWidth, onDepthOrHeight }: { active: boolean; onToggle: () => void; wall?: boolean; width: number; depthOrHeight: number; onWidth: (value: number) => void; onDepthOrHeight: (value: number) => void }) {
  return <div className={`resize-controls ${active ? 'active' : ''}`} data-testid="resize-controls">
    <button className="button button-light full-width resize-toggle" aria-label={wall ? 'Ubah ukuran aksesori' : 'Ubah ukuran barang'} aria-pressed={active} aria-expanded={active} onClick={onToggle}><Maximize2 size={16} /><span>Ubah ukuran</span>{active && <Check size={14} />}</button>
    {active && <div className="resize-fields"><p>Seret ujungnya atau klik petak tujuan.</p><div className="dimension-pair">
      <DimensionField label="Panjang" accessibleLabel={wall ? 'Panjang aksesori' : 'Panjang barang'} value={width} min={wall ? 0.3 : 1} max={24} step={wall ? 0.1 : 1} unit={wall ? 'm' : 'petak'} onCommit={onWidth} />
      <DimensionField label={wall ? 'Tinggi' : 'Kedalaman'} accessibleLabel={wall ? 'Tinggi aksesori' : 'Kedalaman barang'} value={depthOrHeight} min={wall ? 0.3 : 1} max={wall ? 4.5 : 24} step={wall ? 0.1 : 1} unit={wall ? 'm' : 'petak'} onCommit={onDepthOrHeight} />
    </div><span className="resize-size-note">{wall ? 'Ukuran aksesori, bukan tinggi pemasangan.' : 'Panjang dan kedalaman mengikuti arah barang.'}</span></div>}
  </div>;
}

function DoorControls({ shop, onChange }: { shop: ShopDocument; onChange: (next: ShopDocument) => void }) {
  const entrance = getEntrance(shop);
  const rotation = entrance.rotation ?? 0;
  const side = getEntranceWall(shop);
  const alongDepth = side === 'left' || side === 'right';
  return <div className="architecture-fields door-fields">
    <label className="field-label" htmlFor="door-wall">SISI PINTU MASUK</label>
    <select id="door-wall" aria-label="Sisi pintu masuk" value={side} onChange={event => onChange(setEntrance(shop, {wall:event.target.value as 'front'|'right'|'back'|'left'}))}>
      <option value="front">Depan</option><option value="right">Kanan</option><option value="back">Belakang</option><option value="left">Kiri</option>
    </select>
    <label className="field-label" htmlFor="door-position">POSISI PINTU</label>
    <select id="door-position" aria-label="Posisi pintu" value={entrance.position} onChange={(e) => onChange(setEntrance(shop, { position: Number(e.target.value) }))}>
      {[...new Set([0, .25, .5, .75, 1, entrance.position])].sort((a, b) => a - b).map((position) => <option key={position} value={position}>{position === 0 ? alongDepth ? 'Belakang' : 'Kiri' : position === 1 ? alongDepth ? 'Depan' : 'Kanan' : position === .5 ? 'Tengah' : `${Math.round(position * 100)}% dari ${alongDepth ? 'belakang' : 'kiri'}`}</option>)}
    </select>
    <div className="door-rotation-heading"><span className="field-label">ARAH PINTU</span><output aria-label="Sudut pintu masuk" aria-live="polite">{rotation}°</output></div>
    <div className="door-rotation-actions" role="group" aria-label="Putar pintu masuk">
      <button className="button button-light" aria-label="Putar pintu kiri" title="Putar pintu 90° ke kiri" onClick={() => onChange(setEntrance(shop, { rotation: ((rotation + 270) % 360) as Rotation }))}><RotateCcw size={15} /><span>Putar kiri</span></button>
      <button className="button button-light" aria-label="Putar pintu kanan" title="Putar pintu 90° ke kanan" onClick={() => onChange(setEntrance(shop, { rotation: ((rotation + 90) % 360) as Rotation }))}><RotateCw size={15} /><span>Putar kanan</span></button>
    </div>
    <button className="button button-light full-width door-toggle" aria-label={entrance.open ? 'Tutup pintu masuk' : 'Buka pintu masuk'} onClick={() => onChange(setEntrance(shop, { open: !entrance.open }))}><DoorOpen size={16} />{entrance.open ? 'Tutup pintu' : 'Buka pintu'}</button>
  </div>;
}

function WallPositionFields({ shop, item, onChange, onWallChange }: { shop: ShopDocument; item: WallItem; onChange: (patch: Partial<WallItem>) => void; onWallChange: (candidate: WallItem | null) => void }) {
  const entry = getWallItemSize(item);
  const runs = getWallRuns(shop);
  const key = (run: typeof runs[number]) => `${run.wall}:${run.line}:${run.start}:${run.end}`;
  const current = runs.find((run) => run.wall === item.wall && run.line === item.line && item.offset >= run.start && item.offset <= run.end);
  const choices = (min: number, max: number, value: number) => [...new Set([value, ...Array.from({ length: Math.max(0, Math.floor(max * 10) - Math.ceil(min * 10) + 1) }, (_, i) => (Math.ceil(min * 10) + i) / 10)])].sort((a, b) => a - b);
  const offsets = current ? choices(current.start + entry.width / 2, current.end - entry.width / 2, item.offset) : [item.offset];
  const heights = choices(entry.height / 2, getWallHeight(shop) - entry.height / 2, item.height);
  return <div className="wall-position-fields">
    <label><span className="field-label">BIDANG DINDING</span><select aria-label="Dinding aksesori" value={current ? key(current) : ''} onChange={(e) => {
      const run = runs.find((candidate) => key(candidate) === e.target.value);
      if (!run) return;
      const candidate = findWallPlacement(shop, item, { wall: run.wall, line: run.line, offset: (run.start + run.end) / 2, height: item.height });
      onWallChange(candidate && candidate.wall === run.wall && candidate.line === run.line && candidate.offset - entry.width / 2 >= run.start && candidate.offset + entry.width / 2 <= run.end ? candidate : null);
    }}>
      {!current && <option value="">Arahkan ke dinding</option>}
      {runs.map((run, i) => <option key={key(run)} value={key(run)} disabled={run.end - run.start < entry.width}>{{back:'Belakang',left:'Kiri',front:'Depan',right:'Kanan'}[run.wall]} · bidang {i + 1}</option>)}
    </select></label>
    <div className="wall-position-pair"><label><span className="field-label">GESER POSISI</span><select aria-label="Posisi aksesori di dinding" value={item.offset} onChange={(e) => onChange({ offset: Number(e.target.value) })}>{offsets.map((value) => <option key={value} value={value}>{(value - (current?.start ?? 0)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} m</option>)}</select></label><label><span className="field-label">TINGGI TENGAH</span><select aria-label="Ketinggian aksesori" value={item.height} onChange={(e) => onChange({ height: Number(e.target.value) })}>{heights.map((value) => <option key={value} value={value}>{value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} m</option>)}</select></label></div>
  </div>;
}

function FloorDiagram() {
  return <svg viewBox="0 0 200 135">{Array.from({ length: 16 }, (_, i) => {
    const x = i % 4, z = Math.floor(i / 4), active = x < 2 || z < 2;
    return <g key={i} transform={`translate(${100 + (x - z) * 21} ${20 + (x + z) * 12})`}>
      {active && <path d="M-19 0 0 11 19 0v6L0 17-19 6z" fill="#bca6d4" />}
      <path d="M0-11 19 0 0 11-19 0z" fill={active ? '#ded0ed' : '#f4eef9'} stroke={active ? '#b3a0c8' : '#d9cbe6'} strokeDasharray={active ? undefined : '3 3'} />
    </g>;
  })}<circle cx="100" cy="9" r="4" fill="#8a65be" /><circle cx="37" cy="56" r="4" fill="#8a65be" /><path d="M140 106h18m-9-9v18" stroke="#997abe" strokeWidth="2.5" strokeLinecap="round" /></svg>;
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={dialogRef} className="help-dialog" onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="help-title">
    <button className="icon-button dialog-close" aria-label="Tutup cara main" onClick={onClose}><X size={20} /></button>
    <span className="eyebrow">SELAMAT DATANG DI TOKO KECILMU</span><h2 id="help-title">Tinggal tarik.<br /><span>Jadi milikmu.</span></h2>
    <p>Di mode <strong>Atur barang</strong>, pilih perabot lalu taruh di lantai. Barang yang sudah ada bisa langsung diseret. Klik barang untuk mengganti warna dan isi pajangannya.</p>
    <div className="help-controls">
      <div><Grid2X2 size={20} /><strong>Bentuk lantai dari petak</strong><span>Pilih Bangun lalu + Lantai. Klik atau sapu petak transparan untuk menambah lantai. Pilih Hapus untuk membuat bentuk L, halaman kecil, atau sudut terbuka. Dinding mengikuti tepinya.</span></div>
      <div><Expand size={20} /><strong>Atur tinggi dinding</strong><span>Pilih Dinding & pintu, lalu tarik pegangan di atas dinding. Lantai di bawah perabot tidak bisa dihapus; geser barangnya dulu.</span></div>
      <div><DoorOpen size={20} /><strong>Atur pintu masuk</strong><span>Pilih sisi depan, kanan, belakang, atau kiri di panel pintu. Seret badan pintu untuk pindah; buka/tutup melalui tombol pada panel.</span></div>
      <div><Grid2X2 size={20} /><strong>Bagi ruangan</strong><span>Buka Ruangan lalu Atur tembok dalam. Gambar garis petak, pilih temboknya, lalu Tambah pintu. Toilet, wastafel, dan shower tersedia terpisah di Gudang & utilitas.</span></div>
      <div><Move size={20} /><strong>Jelajahi sudut kota</strong><span>Geser area kosong untuk memutar. Scroll atau cubit dengan dua jari untuk zoom. Tombol kota menyembunyikan lingkungan sekitar.</span></div>
      <div><RotateCcw size={20} /><strong>Bebas coba-coba</strong><span>Satu sapuan menjadi satu langkah undo. Esc membatalkan perubahan selama jari atau mouse masih ditahan.</span></div>
    </div>
    <p className="keyboard-note"><kbd>R</kbd> Putar barang <kbd>Del</kbd> Hapus <kbd>Esc</kbd> Batal</p>
    <p className="help-storage"><strong>Aksesori dinding:</strong> buka kategori Dinding, pilih jendela atau hiasan, lalu pilih bidang belakang, kiri, depan, atau kanan. Seret untuk mengatur posisi dan tinggi; klik aksesori untuk mengganti warna, tulisan papan, atau nyala lampu.</p>
    <p className="help-storage">Desain tersimpan di browser ini. Unduh <strong>file desain</strong> untuk cadangan atau pindah perangkat. Store Maker adalah playground lokal; desainmu belum dipublikasikan.</p>
    <button className="button button-purple full-width" onClick={onClose}>Oke, waktunya bikin<ArrowRight size={16} /></button>
  </dialog>;
}
