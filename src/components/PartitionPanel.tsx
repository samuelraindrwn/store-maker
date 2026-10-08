import { DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { createInteriorDoor, createPartition, getInteriorDoors, getPartitions, placeInteriorDoor, placePartition, removeInteriorDoor, removePartition, updateInteriorDoor, updatePartition, type PartitionWall, type ShopDocument } from '../model';
import './PartitionPanel.css';

type Props = {
  shop: ShopDocument;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (shop: ShopDocument) => void;
  onDraw: () => void;
  onMessage: (message: string) => void;
};
const WALL_ERROR = 'Tembok belum pas. Gunakan garis di dalam lantai yang tidak memotong perabot atau menumpuk tembok lain.';
const DOOR_ERROR = 'Pintu belum muat. Atur posisi dan lebarnya agar tetap di dalam tembok dan tidak menumpuk pintu lain.';
const COLORS = ['#efe5d6', '#d6dcca', '#e8d7df', '#d6d9e6', '#ead2b6', '#c6b8de'];

export default function PartitionPanel({ shop, selectedId, onSelect, onChange, onDraw, onMessage }: Props) {
  const walls = getPartitions(shop), selected = walls.find(wall => wall.id === selectedId);
  const doors = getInteriorDoors(shop).filter(door => door.wallId === selected?.id);
  const change = (next: ShopDocument, error = WALL_ERROR) => {
    if (next === shop) { onMessage(error); return false; }
    onChange(next); return true;
  };
  const update = (patch: Partial<PartitionWall>) => {
    if (!selected) return false;
    if (Object.entries(patch).every(([key, value]) => selected[key as keyof PartitionWall] === value)) return true;
    return change(updatePartition(shop, selected.id, patch));
  };
  const numberChange = (input: HTMLInputElement, previous: number, commit: (value: number) => boolean) => {
    const value = input.value.trim() === '' ? NaN : Number(input.value);
    if (value === previous) return;
    if (!Number.isFinite(value)) { input.value = String(previous); onMessage('Isi angka yang valid. Nilai sebelumnya tetap dipakai.'); return; }
    if (!commit(value)) input.value = String(previous);
  };
  return <div className="partition-panel" data-testid="partition-panel">
    <span className="eyebrow">BAGI RUANG SESUAI CERITAMU</span>
    <h2>Tembok dalam</h2>
    <p className="muted small">Buat ruang kecil, gudang, atau kamar mandi. Seret sepanjang garis petak, lalu tambahkan pintunya.</p>
    <div className="partition-actions">
      <button className="button button-purple" aria-label="Gambar tembok dalam" onClick={onDraw}><Pencil size={15} />Gambar tembok</button>
      <button className="button button-light" aria-label="Tambah tembok dalam" onClick={() => {
        const wall = createPartition(shop);
        if (!wall) { onMessage('Belum ada garis kosong untuk tembok. Geser perabot atau perluas lantainya.'); return; }
        if (change(placePartition(shop, wall))) onSelect(wall.id);
      }}><Plus size={15} />Tambah</button>
    </div>
    <div className="partition-list" role="group" aria-label="Tembok dalam ruangan">
      {walls.map((wall, index) => <button key={wall.id} aria-label={`Pilih tembok dalam ${index + 1}`} aria-pressed={selectedId === wall.id} className={selectedId === wall.id ? 'active' : ''} onClick={() => onSelect(wall.id)}>
        <strong>Tembok {index + 1}</strong><span>{wall.end - wall.start} m · {wall.axis === 'x' ? 'Mendatar' : 'Memanjang'}</span>
      </button>)}
    </div>
    {!walls.length && <p className="wall-catalog-note">Belum ada tembok dalam. Coba pisahkan sudut toko untuk kamar mandi.</p>}
    {selected && <>
      <label className="partition-field"><span className="field-label">ARAH TEMBOK</span><select aria-label="Arah tembok dalam" value={selected.axis} onChange={event => update({ axis: event.target.value as 'x' | 'z' })}><option value="x">Mendatar (X)</option><option value="z">Memanjang (Y)</option></select></label>
      <div className="partition-numbers">
        {(['line','start','end'] as const).map((key,index) => <label key={`${selected.id}:${key}:${selected[key]}`} className="partition-field"><span className="field-label">{['GARIS','DARI','SAMPAI'][index]}</span><input type="number" step="1" aria-label={['Garis tembok dalam','Awal tembok dalam','Akhir tembok dalam'][index]} defaultValue={selected[key]} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} onBlur={event => {
          numberChange(event.currentTarget, selected[key], value => update({ [key]: value }));
        }} /></label>)}
      </div>
      <span className="field-label">WARNA TEMBOK</span><div className="color-picker" role="group" aria-label="Warna tembok dalam">{COLORS.map((color,index) => <button key={color} style={{background:color}} aria-label={`Warna tembok dalam ${index+1}`} aria-pressed={selected.color === color} onClick={() => update({color})} />)}</div>
      <div className="partition-actions">
        <button className="button button-light" aria-label="Tambah pintu dalam" onClick={() => {
          const door=createInteriorDoor(shop,selected.id);
          if (!door) { onMessage('Belum ada ruang kosong untuk pintu di tembok ini.'); return; }
          change(placeInteriorDoor(shop,door), DOOR_ERROR);
        }}><DoorOpen size={15}/>Tambah pintu</button>
        <button className="button button-light" aria-label="Hapus tembok dalam" onClick={() => { onChange(removePartition(shop,selected.id));onSelect(null); }}><Trash2 size={15}/>Hapus</button>
      </div>
      {doors.map((door,index) => <div className="partition-door" key={door.id}>
        <strong>Pintu {index+1}</strong>
        <div className="partition-numbers">
          <label className="partition-field"><span className="field-label">POSISI</span><input key={door.offset} type="number" step="0.1" aria-label={`Posisi pintu dalam ${index+1}`} defaultValue={door.offset} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}} onBlur={event=>{numberChange(event.currentTarget, door.offset, value => change(updateInteriorDoor(shop, door.id, { offset: value }), DOOR_ERROR));}}/></label>
          <label className="partition-field"><span className="field-label">LEBAR</span><input key={door.width} type="number" min="0.6" max="2.4" step="0.1" aria-label={`Lebar pintu dalam ${index+1}`} defaultValue={door.width} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}} onBlur={event=>{numberChange(event.currentTarget, door.width, value => change(updateInteriorDoor(shop, door.id, { width: value }), DOOR_ERROR));}}/></label>
        </div>
        <div className="partition-actions"><button className="button button-light" aria-label={`${door.open?'Tutup':'Buka'} pintu dalam ${index+1}`} onClick={()=>onChange(updateInteriorDoor(shop,door.id,{open:!door.open}))}><DoorOpen size={15}/>{door.open?'Tutup':'Buka'} pintu</button><button className="button button-light" aria-label={`Hapus pintu dalam ${index+1}`} onClick={()=>onChange(removeInteriorDoor(shop,door.id))}><Trash2 size={15}/></button></div>
      </div>)}
    </>}
  </div>;
}
