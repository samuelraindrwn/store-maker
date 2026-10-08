import { ArrowRight, Check, Home, Paintbrush, Sun } from 'lucide-react';
import { getExterior, getRoof, getRooftopDocument, replaceRooftopDocument, setExterior, setRoof, getLevelCount, getLevelDocument, getWallItems, getWallItemMount, getExteriorWallMaterial, WALL_CATALOG, WALL_LAMP_STYLES, WALL_SIGN_STYLES, type WallSignStyle, type ShopDocument, type WallItemKind, type WallLampStyle } from '../model';
import WallArt from './WallArt';

const FACADES = ['#EADCCA', '#C8D4BE', '#DABAC5', '#BECAD9', '#D8B28E', '#C4B5D9'];
const TRIMS = ['#847293', '#657B70', '#A77653', '#EEE7D8', '#526478', '#A96665'];
const ROOFS = ['#B96B51', '#A85C54', '#728475', '#74798A', '#C4A77C', '#827193'];

export default function ExteriorSettings({ building, onChange, onEditRooftop, activeLevel, onSelectLevel, onSelectWall, onAddWall }: { building: ShopDocument; onChange: (doc: ShopDocument) => void; onEditRooftop: () => void; activeLevel: number; onSelectLevel: (level: number) => void; onSelectWall: (id: string) => void; onAddWall: (kind: WallItemKind, lampStyle?: WallLampStyle, signStyle?: WallSignStyle) => void }) {
  const exterior = getExterior(building);
  const roof = getRoof(building);
  const accessories = getWallItems(getLevelDocument(building, activeLevel)).filter(item => item.kind === 'window' || getWallItemMount(item) === 'exterior');
  return <div className="exterior-settings" data-testid="exterior-settings">
    <div className="library-heading"><span className="eyebrow">DARI LUAR, JATUH HATI</span><h2>Satu toko.<br />Banyak cerita.</h2><p>Fasad hangat, atap pilihanmu.</p></div>
    <div className="exterior-section-heading"><Paintbrush size={16} /><h3>Warna bangunan</h3></div>
    <div className="facade-material-options" role="group" aria-label="Material fasad">
      {(['plaster', 'brick'] as const).map(material => <button key={material} className={getExteriorWallMaterial(building) === material ? 'active' : ''} aria-pressed={getExteriorWallMaterial(building) === material} onClick={() => onChange(setExterior(building, { wallMaterial: material }))}><span className={`material-swatch material-${material}`} />{material === 'brick' ? 'Bata' : 'Plester'}</button>)}
    </div>
    <ExteriorColors label="fasad" colors={FACADES} value={exterior.wallColor} onChange={wallColor => onChange(setExterior(building, { wallColor }))} />
    <ExteriorColors label="lis fasad" colors={TRIMS} value={exterior.trimColor} onChange={trimColor => onChange(setExterior(building, { trimColor }))} />
    <label className="building-toggle"><span><Sun size={16} /><span>Kanopi toko<small>Naungan di atas pintu masuk.</small></span></span><input type="checkbox" aria-label="Kanopi toko" checked={exterior.awning} onChange={event => onChange(setExterior(building, { awning: event.target.checked }))} /></label>
    <div className="exterior-section-heading roof-heading"><Home size={17} /><h3>Atap pilihanmu</h3></div>
    <div className="roof-options" role="group" aria-label="Jenis atap">
      {(['tiles', 'rooftop'] as const).map(style => <button key={style} className={roof.style === style ? 'active' : ''} aria-label={style === 'tiles' ? 'Atap genteng' : 'Rooftop'} aria-pressed={roof.style === style} onClick={() => onChange(setRoof(building, { style }))}>
        <RoofArt flat={style === 'rooftop'} color={roof.color} />
        <strong>{style === 'tiles' ? 'Genteng' : 'Rooftop'}</strong><small>{style === 'tiles' ? 'Klasik & hangat' : 'Ruang di atas kota'}</small>{roof.style === style && <Check className="roof-check" size={14} />}
      </button>)}
    </div>
    <ExteriorColors label={roof.style === 'rooftop' ? 'lantai rooftop' : 'atap'} colors={ROOFS} value={roof.style === 'rooftop' ? getRooftopDocument(building).floorColor : roof.color} onChange={color => onChange(roof.style === 'rooftop' ? replaceRooftopDocument(building, { ...getRooftopDocument(building), floorColor: color }) : setRoof(building, { color }))} />
    {roof.style === 'rooftop' && <><RoofAccessPicker building={building} onChange={onChange} /><div className="roof-access-card"><p>Tata area duduk, tenda, dan tanaman di rooftop. Tangga terhubung dari lantai paling atas.</p><button className="button button-purple full-width" onClick={onEditRooftop}><Sun size={16} />Tata rooftop<ArrowRight size={16} /></button></div></>}
    <div className="exterior-section-heading"><Paintbrush size={16} /><h3>Dekorasi luar</h3></div>
    <label className="exterior-level-select"><span className="field-label">LANTAI YANG DITATA</span><select aria-label="Lantai dekorasi eksterior" value={activeLevel} onChange={event => onSelectLevel(Number(event.target.value))}>{Array.from({ length: getLevelCount(building) }, (_, level) => <option key={level} value={level}>Lantai {level + 1}</option>)}</select></label>
    <div className="catalog-grid exterior-catalog">
      <button className="catalog-card" aria-label="Tambah jendela eksterior" onClick={() => onAddWall('window')}><WallArt kind="window" color="#F5EAD6" /><strong>Jendela</strong></button>
      {WALL_SIGN_STYLES.map(style => <button key={style.id} className="catalog-card" aria-label={`Tambah signage ${style.label}`} onClick={() => onAddWall('wall-sign', undefined, style.id)}><WallArt kind="wall-sign" color="#78638E" wallSignStyle={style.id} /><strong>{style.label}</strong><span>Signage luar</span></button>)}
      {WALL_LAMP_STYLES.map(style => <button key={style.id} className="catalog-card" aria-label={`Tambah lampu luar ${style.label}`} onClick={() => onAddWall('wall-lamp', style.id)}><WallArt kind="wall-lamp" color="#B08B63" wallLampStyle={style.id} /><strong>{style.label}</strong><span>Lampu luar</span></button>)}
    </div>
    <div className="exterior-accessory-list"><span className="field-label">TERPASANG DI LANTAI {activeLevel + 1}</span>{accessories.map((item, index) => <button key={item.id} onClick={() => onSelectWall(item.id)} aria-label={`Edit ${WALL_CATALOG.find(entry => entry.kind === item.kind)?.name} luar ${index + 1}`}><WallArt kind={item.kind} color={item.color} wallLampStyle={item.wallLampStyle} wallSignStyle={item.wallSignStyle} /><span>{WALL_CATALOG.find(entry => entry.kind === item.kind)?.name}</span><ArrowRight size={14} /></button>)}{!accessories.length && <p className="wall-catalog-note">Pilih dekorasi, lalu pasang pada sisi bangunan.</p>}</div>
    <p className="wall-catalog-note">Jendela terhubung dengan Interior. Pilih lantai dan sisi, lalu geser atau atur posisinya dari panel.</p>
  </div>;
}

export function RoofAccessPicker({ building, onChange }: { building: ShopDocument; onChange: (doc: ShopDocument) => void }) {
  const roof = getRoof(building);
  return <div className="roof-access-options"><span className="field-label">AKSES TANGGA ROOFTOP</span><div className="facade-material-options" role="group" aria-label="Bentuk akses tangga rooftop">{(['open', 'enclosed'] as const).map(stairAccess => <button key={stairAccess} className={roof.stairAccess === stairAccess ? 'active' : ''} aria-pressed={roof.stairAccess === stairAccess} onClick={() => onChange(setRoof(building, { stairAccess }))}>{stairAccess === 'open' ? 'Terbuka' : 'Berdinding & beratap'}</button>)}</div></div>;
}

function ExteriorColors({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="exterior-color-field"><span className="field-label">WARNA {label.toUpperCase()}</span><div className="color-picker" role="group" aria-label={`Warna ${label}`}>{colors.map((color, index) => <button key={color} style={{ background: color }} className={value.toLowerCase() === color.toLowerCase() ? 'selected' : ''} aria-label={`Warna ${label} ${index + 1}`} aria-pressed={value.toLowerCase() === color.toLowerCase()} onClick={() => onChange(color)}>{value.toLowerCase() === color.toLowerCase() && <Check size={14} />}</button>)}</div></div>;
}

function RoofArt({ flat, color }: { flat: boolean; color: string }) {
  return <svg viewBox="0 0 110 78" aria-hidden="true"><ellipse cx="56" cy="69" rx="40" ry="5" fill="#ded4e5" /><path d="M19 40 57 55 93 36 93 59 57 75 19 60Z" fill="#e9dcc6" /><path d="M57 55 93 36 93 59 57 75Z" fill="#cabbac" />{flat ? <><path d="M14 34 51 17 97 32 57 53Z" fill={color} /><path d="M14 34V25L51 9V17L22 31 57 44 89 28 97 32 57 53Z" fill="#efe6d6" /><path d="M57 44 97 24V32L57 53Z" fill="#b9aa98" /><path d="M51 9 97 24 89 28 51 17Z" fill="#d7ccb9" /></> : <><path d="M12 38 30 10 71 24 57 56Z" fill={color} /><path d="M71 24 99 37 57 56Z" fill="#aa7963" /><path d="M30 10 71 24" stroke="#e4b59b" strokeWidth="4" /><path d="m22 25 41 15m-46 2 40 14m-17-39-18 31m29-27-18 31m28-27-18 30" stroke="#ffffff" opacity=".24" strokeWidth="2" /></>}<path d="M64 57V66L73 62V52Z" fill="#8fa6a6" /></svg>;
}
