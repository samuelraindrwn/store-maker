import type { WallItemKind, WindowStyle } from '../model';

/** Small front-facing catalog illustrations, matching the editable wall objects. */
export default function WallArt({ kind, color, windowStyle = 'classic' }: { kind: WallItemKind; color: string; windowStyle?: WindowStyle }) {
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
    {kind === 'wall-lamp' && <>
      <path d="m47 49-12 25h50L73 49z" fill="#f3da9e" opacity=".55" />
      <rect x="55" y="23" width="10" height="37" rx="4" fill={color} />
      <path d="M60 45v-9h13" fill="none" stroke="#967654" strokeWidth="4" />
      <path d="M45 31h30l6 22H39z" fill={color} stroke="#ac9378" strokeWidth="1" />
      <ellipse cx="60" cy="53" rx="20" ry="4" fill="#ffefc3" />
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
    {kind === 'wall-sign' && <>
      <path d="m41 37 19-15 19 15" fill="none" stroke="#b59973" strokeWidth="2" />
      <rect x="26" y="36" width="68" height="30" rx="3" fill={color} />
      <rect x="30" y="40" width="60" height="22" rx="1" fill="#f5ead6" />
      <text x="60" y="55" textAnchor="middle" fontFamily="Georgia,serif" fontSize="10" fill="#65516e">HELLO</text>
    </>}
  </svg>;
}
