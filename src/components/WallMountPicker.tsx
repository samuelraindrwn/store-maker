import { getWallItemSize, getWallRuns, type ShopDocument, type WallItem, type WallSide } from '../model';

export const WALL_SIDE_LABELS: Record<WallSide, string> = { front: 'Depan', right: 'Kanan', back: 'Belakang', left: 'Kiri' };
export type WallMount = Pick<WallItem, 'wall' | 'line'>;

export default function WallMountPicker({ shop, item, mount, onChoose, onAuto }: {
  shop: ShopDocument; item: WallItem; mount: WallMount | null;
  onChoose: (side: WallSide) => void; onAuto: () => void;
}) {
  const runs = getWallRuns(shop), size = getWallItemSize(item);
  return <div className="wall-mount-toolbar" role="group" aria-label="Sisi pemasangan aksesori">
    <span className="wall-mount-title">PASANG DI SISI</span>
    <div className="wall-mount-buttons">
      {(['front', 'right', 'back', 'left'] as const).map(side => <button key={side}
        aria-label={`Pasang di sisi ${WALL_SIDE_LABELS[side]}`} aria-pressed={mount?.wall === side}
        disabled={!runs.some(run => run.wall === side && run.end - run.start >= size.width)}
        onClick={() => onChoose(side)}>{WALL_SIDE_LABELS[side]}</button>)}
      <button aria-label="Pilih sisi otomatis" aria-pressed={!mount} onClick={onAuto}>Auto</button>
    </div>
    <span className="wall-mount-hint">{mount ? `Sisi ${WALL_SIDE_LABELS[mount.wall].toLowerCase()} dikunci. Klik bidang bergaris untuk memasang.` : 'Pilih sisi untuk memasang pada dinding depan atau kanan.'}</span>
  </div>;
}
