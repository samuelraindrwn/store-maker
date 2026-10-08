import { Check, Flower2, Home, Paintbrush, Sun } from 'lucide-react';
import { getExterior, getRoof, setExterior, setRoof, type ShopDocument } from '../model';

const FACADES = ['#EADCCA', '#C8D4BE', '#DABAC5', '#BECAD9', '#D8B28E', '#C4B5D9'];
const TRIMS = ['#847293', '#657B70', '#A77653', '#EEE7D8', '#526478', '#A96665'];
const ROOFS = ['#B96B51', '#A85C54', '#728475', '#74798A', '#C4A77C', '#827193'];

export default function ExteriorSettings({ building, onChange }: { building: ShopDocument; onChange: (doc: ShopDocument) => void }) {
  const exterior = getExterior(building);
  const roof = getRoof(building);
  return <div className="exterior-settings" data-testid="exterior-settings">
    <div className="library-heading"><span className="eyebrow">DARI LUAR, JATUH HATI</span><h2>Satu toko.<br />Banyak cerita.</h2><p>Fasad hangat, atap pilihanmu.</p></div>
    <div className="exterior-section-heading"><Paintbrush size={16} /><h3>Warna bangunan</h3></div>
    <ExteriorColors label="fasad" colors={FACADES} value={exterior.wallColor} onChange={wallColor => onChange(setExterior(building, { wallColor }))} />
    <ExteriorColors label="bingkai" colors={TRIMS} value={exterior.trimColor} onChange={trimColor => onChange(setExterior(building, { trimColor }))} />
    <label className="building-toggle"><span><Sun size={16} /><span>Kanopi toko<small>Naungan di atas pintu masuk.</small></span></span><input type="checkbox" aria-label="Kanopi toko" checked={exterior.awning} onChange={event => onChange(setExterior(building, { awning: event.target.checked }))} /></label>
    <div className="exterior-section-heading roof-heading"><Home size={17} /><h3>Atap pilihanmu</h3></div>
    <div className="roof-options" role="group" aria-label="Jenis atap">
      {(['tiles', 'rooftop'] as const).map(style => <button key={style} className={roof.style === style ? 'active' : ''} aria-label={style === 'tiles' ? 'Atap genteng' : 'Rooftop'} aria-pressed={roof.style === style} onClick={() => onChange(setRoof(building, { style }))}>
        <RoofArt flat={style === 'rooftop'} color={roof.color} />
        <strong>{style === 'tiles' ? 'Genteng' : 'Rooftop'}</strong><small>{style === 'tiles' ? 'Klasik & hangat' : 'Ruang di atas kota'}</small>{roof.style === style && <Check className="roof-check" size={14} />}
      </button>)}
    </div>
    <ExteriorColors label="atap" colors={ROOFS} value={roof.color} onChange={color => onChange(setRoof(building, { color }))} />
    {roof.style === 'rooftop' && <label className="building-toggle"><span><Flower2 size={16} /><span>Taman rooftop<small>Pergola dan tanaman hijau.</small></span></span><input type="checkbox" aria-label="Taman rooftop" checked={roof.garden} onChange={event => onChange(setRoof(building, { garden: event.target.checked }))} /></label>}
    <p className="wall-catalog-note">Bentuk fasad mengikuti petak setiap lantai. Pindah ke Interior untuk mengubah bentuk dan menata ruangannya.</p>
  </div>;
}

function ExteriorColors({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="exterior-color-field"><span className="field-label">WARNA {label.toUpperCase()}</span><div className="color-picker" role="group" aria-label={`Warna ${label}`}>{colors.map((color, index) => <button key={color} style={{ background: color }} className={value.toLowerCase() === color.toLowerCase() ? 'selected' : ''} aria-label={`Warna ${label} ${index + 1}`} aria-pressed={value.toLowerCase() === color.toLowerCase()} onClick={() => onChange(color)}>{value.toLowerCase() === color.toLowerCase() && <Check size={14} />}</button>)}</div></div>;
}

function RoofArt({ flat, color }: { flat: boolean; color: string }) {
  return <svg viewBox="0 0 110 78" aria-hidden="true"><ellipse cx="56" cy="69" rx="40" ry="5" fill="#ded4e5" /><path d="M19 40 57 55 93 36 93 59 57 75 19 60Z" fill="#e9dcc6" /><path d="M57 55 93 36 93 59 57 75Z" fill="#cabbac" />{flat ? <><path d="M14 34 51 17 97 32 57 53Z" fill={color} /><path d="M14 34V25L51 9V17L22 31 57 44 89 28 97 32 57 53Z" fill="#efe6d6" /><path d="M57 44 97 24V32L57 53Z" fill="#b9aa98" /><path d="M51 9 97 24 89 28 51 17Z" fill="#d7ccb9" /></> : <><path d="M12 38 30 10 71 24 57 56Z" fill={color} /><path d="M71 24 99 37 57 56Z" fill="#aa7963" /><path d="M30 10 71 24" stroke="#e4b59b" strokeWidth="4" /><path d="m22 25 41 15m-46 2 40 14m-17-39-18 31m29-27-18 31m28-27-18 30" stroke="#ffffff" opacity=".24" strokeWidth="2" /></>}<path d="M64 57V66L73 62V52Z" fill="#8fa6a6" /></svg>;
}
