import type { WallItemKind, WallLampStyle, WallSignStyle, WindowStyle } from '../model';

/** Small front-facing catalog illustrations, matching the editable wall objects. */
export default function WallArt({ kind, color, windowStyle = 'classic', wallLampStyle = 'sconce', wallSignStyle = 'plaque' }: { kind: WallItemKind; color: string; windowStyle?: WindowStyle; wallLampStyle?: WallLampStyle; wallSignStyle?: WallSignStyle }) {
  return <svg className="furniture-art wall-art" viewBox="0 0 120 90" aria-hidden="true">
    <rect x="15" y="12" width="90" height="66" rx="8" fill="#ece6de" />
    <path d="M15 61h90M40 12v12m39 37v17" stroke="#ded6cd" strokeWidth="1" />
    {kind === 'window' && windowStyle === 'classic' && <>
      <rect x="32" y="18" width="56" height="53" rx="2" fill={color} />
      <path d="M36 22h20v42H36zm25 0h23v42H61z" fill="#bcd8d3" />
      <path d="m39 26 10-4m-10 14 14-7m12 18 15-9" stroke="#e7f4ee" strokeWidth="3" opacity=".65" />
      <path d="M35 44h50" stroke={color} strokeWidth="3" />
      <rect x="28" y="68" width="64" height="6" rx="2" fill={color} />
    </>}
    {kind === 'window' && windowStyle === 'picture' && <>
      <rect x="23" y="24" width="74" height="46" rx="2" fill={color} />
      <rect x="27" y="28" width="66" height="38" rx="1" fill="#b9d6d2" />
      <path d="M27 55 56 28h18L34 66h-7z" fill="#e5f4ed" opacity=".6" />
      <path d="m67 66 26-25v11L79 66z" fill="#e5f4ed" opacity=".45" />
      <path d="M28 65h64" stroke="#8eb5ad" strokeWidth="2" />
      <rect x="20" y="70" width="80" height="4" rx="1.5" fill={color} />
    </>}
    {kind === 'window' && windowStyle === 'grid' && <>
      <rect x="30" y="17" width="60" height="55" rx="2" fill={color} />
      <rect x="34" y="21" width="52" height="47" fill="#b7d0ce" />
      <path d="m36 23 19 0-19 18zm23 0h12L36 58V46zm27 15v12L68 68H56z" fill="#e6f2ec" opacity=".6" />
      <path d="M51 20v49m18-49v49M33 36h54M33 52h54" stroke={color} strokeWidth="3" />
      <rect x="27" y="70" width="66" height="5" rx="1.5" fill={color} />
    </>}
    {kind === 'window' && windowStyle === 'sliding' && <>
      <rect x="25" y="23" width="70" height="49" rx="2" fill={color} />
      <rect x="29" y="27" width="62" height="40" fill="#a9c9c8" />
      <path d="m65 28 14 0-15 16zM73 65l17-17v11l-6 6" fill="#deeee7" opacity=".55" />
      <rect x="30" y="28" width="34" height="38" fill="#c4ddda" stroke={color} strokeWidth="3" />
      <path d="m34 31 17 0-17 17zm0 26 26-24v9L43 61h-9z" fill="#edf6ef" opacity=".55" />
      <path d="M58 43v9m11-9v9" stroke="#806e80" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27 69h66" stroke="#e6dfd2" strokeWidth="1" />
      <rect x="22" y="72" width="76" height="4" rx="1.5" fill={color} />
    </>}
    {kind === 'window' && windowStyle === 'arched' && <>
      <path d="M32 71V44a28 28 0 0 1 56 0v27z" fill={color} />
      <path d="M37 66V44a23 23 0 0 1 46 0v22z" fill="#b8d5d0" />
      <path d="M40 43a20 20 0 0 1 20-20h7L40 50zM43 62l23-22h12L51 66h-8z" fill="#e8f4ec" opacity=".6" />
      <path d="M60 21v46M36 44h48M42 29l18 15 18-15" fill="none" stroke={color} strokeWidth="3" />
      <rect x="28" y="70" width="64" height="5" rx="2" fill={color} />
    </>}
    {kind === 'wall-lamp' && wallLampStyle === 'sconce' && <>
      <path d="m47 49-12 25h50L73 49z" fill="#f3da9e" opacity=".55" />
      <rect x="55" y="23" width="10" height="37" rx="4" fill={color} />
      <path d="M60 45v-9h13" fill="none" stroke="#967654" strokeWidth="4" />
      <path d="M45 31h30l6 22H39z" fill={color} stroke="#ac9378" strokeWidth="1" />
      <ellipse cx="60" cy="53" rx="20" ry="4" fill="#ffefc3" />
    </>}
    {kind === 'wall-lamp' && wallLampStyle === 'lantern' && <>
      <ellipse cx="60" cy="52" rx="29" ry="30" fill="#ffe4a3" opacity=".3" />
      <path d="M60 16v12" stroke={color} strokeWidth="5" strokeLinecap="round" />
      <path d="m37 34 23-14 23 14z" fill={color} />
      <rect x="42" y="35" width="36" height="32" rx="2" fill="#fbe8b8" />
      <path d="M42 34v34m36-34v34M60 34v34" stroke={color} strokeWidth="3" />
      <path d="M38 68h44v6H38z" fill={color} />
      <path d="m48 39 7 0-7 18z" fill="#fff7df" opacity=".8" />
    </>}
    {kind === 'wall-lamp' && wallLampStyle === 'bulkhead' && <>
      <ellipse cx="60" cy="47" rx="28" ry="32" fill="#ffe4a3" opacity=".3" />
      <rect x="55" y="18" width="10" height="57" rx="3" fill={color} />
      <ellipse cx="60" cy="46" rx="22" ry="29" fill={color} />
      <ellipse cx="60" cy="46" rx="17" ry="24" fill="#fff0c9" />
      <path d="M43 37h34M43 55h34M60 22v48" stroke={color} strokeWidth="3" />
      <path d="M49 28q-7 9-5 17" fill="none" stroke="#fffbee" strokeWidth="2" opacity=".9" />
    </>}
    {kind === 'wall-shelf' && <>
      <path d="M31 28v40m58-40v40" stroke={color} strokeWidth="5" />
      <path d="M29 48h62v5H29zm0 21h62v5H29z" fill={color} />
      <path d="M35 27h8v20h-8z" fill="#8a9c7c" /><path d="M45 24h7v23h-7z" fill="#b19dc8" />
      <path d="M55 29h8v18h-8zm19 26h7v13h-7z" fill="#d8a27e" />
      <path d="M66 25h7v22h-7zm-30 34h25v9H36z" fill="#d7c47d" />
      <path d="M76 32h8v15h-8zm-40 22h21v5H36z" fill="#90a6b0" />
    </>}
    {kind === 'painting' && <>
      <rect x="36" y="18" width="48" height="56" rx="2" fill={color} />
      <rect x="41" y="23" width="38" height="46" fill="#f5e4cd" />
      <circle cx="65" cy="36" r="8" fill="#dbad79" />
      <path d="m41 56 16-15 22 23v5H41z" fill="#91a17f" />
      <path d="m41 65 23-12 15 8v8H41z" fill="#b9a8c8" />
    </>}
    {kind === 'wall-sign' && wallSignStyle === 'plaque' && <>
      <path d="m41 37 19-15 19 15" fill="none" stroke="#b59973" strokeWidth="2" />
      <rect x="26" y="36" width="68" height="30" rx="3" fill={color} />
      <rect x="30" y="40" width="60" height="22" rx="1" fill="#f5ead6" />
      <text x="60" y="55" textAnchor="middle" fontFamily="Georgia,serif" fontSize="10" fill="#65516e">HELLO</text>
    </>}
    {kind === 'wall-sign' && wallSignStyle === 'fascia' && <>
      <rect x="19" y="31" width="84" height="34" rx="3" fill="#b7a995" />
      <rect x="17" y="28" width="84" height="34" rx="3" fill={color} />
      <rect x="21" y="32" width="76" height="25" rx="1" fill="#fff1cb" />
      <text x="59" y="49" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="12" fill={color}>TOKO KITA</text>
      <path d="M25 61h68" stroke="#d7bf8e" strokeWidth="2" />
    </>}
    {kind === 'wall-sign' && wallSignStyle === 'projecting' && <>
      <rect x="26" y="19" width="7" height="51" rx="2" fill={color} />
      <path d="M29 22h59m-45 0v11m35-11v11" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <path d="M38 31h50v40H38z" fill={color} />
      <path d="m88 31 5 4v39l-5-3z" fill="#7e7186" />
      <rect x="42" y="35" width="42" height="32" rx="1" fill="#fff1cb" />
      <text x="63" y="55" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="10" fill={color}>TOKO</text>
    </>}
    {kind === 'wall-clock' && <>
      <circle cx="61" cy="47" r="28" fill="#cfc2b3" />
      <circle cx="60" cy="44" r="28" fill={color} />
      <circle cx="60" cy="44" r="23" fill="#fff4db" />
      {Array.from({ length: 12 }, (_, index) => <path key={index} d={index % 3 === 0 ? 'M60 24v5' : 'M60 24v3'} stroke="#6a594d" strokeWidth={index % 3 === 0 ? 2 : 1.3} strokeLinecap="round" transform={`rotate(${index * 30} 60 44)`} />)}
      <path d="M60 44V30m0 14 10 6" fill="none" stroke="#534652" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="60" cy="44" r="2.7" fill="#a67a50" />
    </>}
  </svg>;
}
