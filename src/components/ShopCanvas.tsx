import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ShopDocument, ShopItem, WallItem } from '../model';
import { ShopScene, type CameraView, type Cell } from '../scene/ShopScene';

export type SceneHandle = {
  resetCamera: () => void;
  capture: () => string | null;
  setView: (view: CameraView) => void;
};

export type ShopCanvasProps = {
  shop: ShopDocument;
  selectedId: string | null;
  placement: ShopItem | null;
  selectedWallId: string | null;
  selectedDoor: boolean;
  resizeMode?: boolean;
  wallPlacement: WallItem | null;
  showGrid: boolean;
  showWalls: boolean;
  preview: boolean;
  editMode: 'arrange' | 'build';
  buildTool: 'add' | 'erase' | 'walls';
  showCity: boolean;
  nightMode?: boolean;
  onSelect: (id: string | null) => void;
  onCell: (x: number, z: number) => void;
  onHover: (cell: Cell | null) => void;
  onSelectWall: (id: string | null) => void;
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

  useImperativeHandle(ref, () => ({
    resetCamera: () => engine.current?.resetCamera(),
    capture: () => engine.current?.capture() ?? null,
    setView: (view) => engine.current?.setView(view),
  }), []);

  useEffect(() => {
    if (!mount.current) return;
    let instance: ShopScene | null = null;
    try {
      instance = new ShopScene(mount.current, {
        onSelect: (id) => latest.current.onSelect(id),
        onCell: (x, z) => latest.current.onCell(x, z),
        onHover: (cell) => latest.current.onHover(cell),
        onSelectWall: (id) => latest.current.onSelectWall(id),
        onSelectDoor: () => latest.current.onSelectDoor(),
        onWallPlace: (candidate) => latest.current.onWallPlace(candidate),
        onWallHover: (candidate) => latest.current.onWallHover(candidate),
        onMove: (id, x, z) => latest.current.onMove?.(id, x, z),
        onChange: (doc, label) => latest.current.onChange(doc, label),
        onInteraction: (message) => latest.current.onInteraction?.(message),
        onError: setError,
      });
      engine.current = instance;
      instance.update(latest.current);
    } catch (cause) {
      instance?.dispose();
      engine.current = null;
      setError('Tampilan 3D belum bisa dibuka di browser ini. Aktifkan akselerasi grafis atau coba browser terbaru.');
      console.error('ShopCanvas could not initialise WebGL', cause);
    }
    return () => {
      instance?.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.update(props);
  }, [props.shop, props.selectedId, props.placement, props.selectedWallId, props.selectedDoor, props.resizeMode, props.wallPlacement, props.showGrid, props.showWalls, props.preview, props.editMode, props.buildTool, props.showCity, props.nightMode]);

  return (
    <div className="shop-canvas" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#e8e3ed' }}>
      <div ref={mount} style={{ position: 'absolute', inset: 0 }} />
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
