import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ShopDocument, ShopItem, WallItem } from '../model';
import { ShopScene, type CameraView, type Cell } from '../scene/ShopScene';
import './ShopCanvas.css';

export type SceneHandle = {
  resetCamera: () => void;
  capture: () => string | null;
  setView: (view: CameraView) => void;
};

export type ShopCanvasProps = {
  shop: ShopDocument;
  building?: ShopDocument;
  activeLevel?: number;
  exteriorOnly?: boolean;
  rooftopOnly?: boolean;
  revision?: number;
  selectedId: string | null;
  placement: ShopItem | null;
  selectedWallId: string | null;
  selectedPartitionId?: string | null;
  selectedDoor: boolean;
  resizeMode?: boolean;
  wallPlacement: WallItem | null;
  wallPlacementMount?: Pick<WallItem, 'wall' | 'line'> | null;
  showGrid: boolean;
  showWalls: boolean;
  showAllWalls?: boolean;
  preview: boolean;
  editMode: 'arrange' | 'build';
  buildTool: 'add' | 'erase' | 'walls' | 'partition';
  showCity: boolean;
  nightMode?: boolean;
  gameMinutes?: number;
  onSelect: (id: string | null) => void;
  onCell: (x: number, z: number) => void;
  onHover: (cell: Cell | null) => void;
  onSelectWall: (id: string | null) => void;
  onSelectPartition?: (id: string | null) => void;
  onSelectDoor: () => void;
  onWallPlace: (candidate: WallItem) => void;
  onWallHover: (candidate: WallItem | null) => void;
  onMove?: (id: string, x: number, z: number) => void;
  onChange: (doc: ShopDocument, label?: string) => void;
  onInteraction?: (text: string | null) => void;
};

const ShopCanvas = forwardRef<SceneHandle, ShopCanvasProps>(function ShopCanvas(props, ref) {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<ShopScene | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const applied = useRef<ShopCanvasProps | null>(null);
  const awaitingFrame = useRef(false);
  const revealFrame = useRef(0);

  useImperativeHandle(ref, () => ({
    resetCamera: () => engine.current?.resetCamera(),
    capture: () => engine.current?.capture() ?? null,
    setView: (view) => engine.current?.setView(view),
  }), []);

  useEffect(() => {
    if (!mount.current) return;
    let instance: ShopScene | null = null;
    let secondFrame = 0;
    // Paint the loading veil before constructing WebGL or generating geometry.
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
    try {
      if (!mount.current) return;
      instance = new ShopScene(mount.current, {
        onSelect: (id) => latest.current.onSelect(id),
        onCell: (x, z) => latest.current.onCell(x, z),
        onHover: (cell) => latest.current.onHover(cell),
        onSelectWall: (id) => latest.current.onSelectWall(id),
        onSelectPartition: (id) => latest.current.onSelectPartition?.(id),
        onSelectDoor: () => latest.current.onSelectDoor(),
        onWallPlace: (candidate) => latest.current.onWallPlace(candidate),
        onWallHover: (candidate) => latest.current.onWallHover(candidate),
        onMove: (id, x, z) => latest.current.onMove?.(id, x, z),
        onChange: (doc, label) => latest.current.onChange(doc, label),
        onInteraction: (message) => latest.current.onInteraction?.(message),
        onError: message => { setError(message); setLoading(false); },
        onFrame: () => {
          if (!awaitingFrame.current) return;
          awaitingFrame.current = false;
          revealFrame.current = requestAnimationFrame(() => setLoading(false));
        },
      });
      engine.current = instance;
      awaitingFrame.current = true;
      applied.current = latest.current;
      instance.update(latest.current);
      instance.setGameTime(latest.current.gameMinutes ?? 360);
    } catch (cause) {
      instance?.dispose();
      engine.current = null;
      setError('Tampilan 3D belum bisa dibuka di browser ini. Aktifkan akselerasi grafis atau coba browser terbaru.');
      setLoading(false);
      console.error('ShopCanvas could not initialise WebGL', cause);
    }
    }); });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      cancelAnimationFrame(revealFrame.current);
      awaitingFrame.current = false;
      instance?.dispose();
      engine.current = null;
      applied.current = null;
    };
  }, []);

  // Clock hands update in place; ticking never rebuilds geometry or interrupts a drag.
  useEffect(() => {
    engine.current?.setGameTime(props.gameMinutes ?? 360);
  }, [props.gameMinutes]);

  useEffect(() => {
    const instance = engine.current, previous = applied.current;
    if (!instance || !previous) return;
    const changingView = props.exteriorOnly !== previous.exteriorOnly || props.rooftopOnly !== previous.rooftopOnly || props.activeLevel !== previous.activeLevel
      || props.revision !== previous.revision;
    if (!changingView) {
      applied.current = props;
      // Moving or editing objects keeps the current view interactive. Document
      // identity changes on every commit and must never trigger a loading veil.
      // A quick reversal may cancel a queued switch and return to this view.
      // Its next frame must also release any loading veil left by that switch.
      awaitingFrame.current = true;
      instance.renderer.domElement.dataset.transitioning = 'false';
      instance.update(props);
      return;
    }
    setLoading(true);
    instance.renderer.domElement.dataset.ready = 'false';
    instance.renderer.domElement.dataset.transitioning = 'true';
    awaitingFrame.current = false;
    cancelAnimationFrame(revealFrame.current);
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => {
      applied.current = latest.current;
      awaitingFrame.current = true;
      instance.renderer.domElement.dataset.transitioning = 'false';
      try { instance.update(latest.current); }
      catch (cause) {
        awaitingFrame.current = false;
        setLoading(false);
        setError('Tampilan belum berhasil diperbarui. Muat ulang halaman untuk membuka desain tersimpan.');
        console.error('ShopCanvas could not update the scene', cause);
      }
    }); });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [props.shop, props.building, props.activeLevel, props.exteriorOnly, props.rooftopOnly, props.revision, props.selectedId, props.placement, props.selectedWallId, props.selectedPartitionId, props.selectedDoor, props.resizeMode, props.wallPlacement, props.wallPlacementMount, props.showGrid, props.showWalls, props.showAllWalls, props.preview, props.editMode, props.buildTool, props.showCity, props.nightMode]);

  return (
    <div className="shop-canvas" aria-busy={loading} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#e8e3ed' }}>
      <div ref={mount} style={{ position: 'absolute', inset: 0 }} />
      <div className={`scene-loading ${loading ? 'is-loading' : ''}`} data-testid="scene-loading" role={loading ? 'status' : undefined} aria-hidden={!loading}>
        <div className="scene-loading-mark" aria-hidden="true"><i /><i /><i /></div>
        <strong>{props.exteriorOnly ? 'Menyiapkan tampilan luar' : props.rooftopOnly ? 'Menyiapkan rooftop' : `Menyiapkan lantai ${(props.activeLevel ?? 0) + 1}`}</strong>
        <span>Sebentar, tokomu sedang ditata.</span>
      </div>
      {error && (
        <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', gap: 12, padding: 32, textAlign: 'center', background: '#eee9f2', color: '#51445d' }}>
          <span aria-hidden="true" style={{ fontSize: 34 }}>◇</span>
          <strong style={{ fontSize: 18 }}>Ruang 3D belum tersedia</strong>
          <p style={{ maxWidth: 340, margin: 0, fontSize: 14, lineHeight: 1.7 }}>{error}</p>
        </div>
      )}
    </div>
  );
});

export default ShopCanvas;
