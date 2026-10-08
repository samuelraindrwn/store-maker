import type { ItemKind } from '../model';

export default function FurnitureArt({ kind, color = '#bea78b' }: { kind: ItemKind; color?: string }) {
  const wood = '#c49767';
  return <svg viewBox="0 0 100 82" aria-hidden="true" className="furniture-art">
    <ellipse cx="52" cy="72" rx="31" ry="6" fill="#443346" opacity=".09" />
    {kind === 'stairs' && <>
      <path d="m18 66 16 8 51-23V13L68 6 18 56z" fill={color} />
      <path d="m18 61 16 8 12-6v-9l11-5v-9l11-5v-9l12-5v-9L68 6 57 17v10l-11 5v9l-12 5v9z" fill="#e0c29a" />
      <path d="m19 59 15 8 12-6m-12-7 12 7m0-16 11 6m-11-14 11 5m0-16 11 6m-11-14 11 5m0-14 12 6" fill="none" stroke="#b3946d" strokeWidth="2" />
      <path d="M22 57V41l46-40v14M36 66V49l46-40v15m-35 32V40m12 9V29m11 12V21" fill="none" stroke="#7f736b" strokeWidth="2.5" strokeLinecap="round" />
    </>}
    {kind === 'warehouse-rack' && <>
      <path d="m22 17 15 9 43-10m-58 1v45m15-36v47m43-57v44m-16-51v44" fill="none" stroke={color} strokeWidth="5" />
      <path d="m22 33 42-10 16 9-43 11zm0 19 42-10 16 9-43 11z" fill="#c2c4b9" />
      <path d="m24 33 13 8 41-10v4L37 46l-13-8zm0 19 13 8 41-10v4L37 65l-13-8z" fill={color} />
      <path d="m31 21 13-3 8 5-14 4zm18-4 14-3 8 5-14 4z" fill="#e0bf94" />
      <path d="m31 21 7 6v11l-7-5zm18-4 8 6v11l-8-5z" fill="#bc936c" /><path d="m38 27 14-4v11l-14 4zm19-4 14-4v11l-14 4z" fill="#cfaa7c" />
      <path d="m36 48 13-4 8 5-14 4zm20-5 13-3 7 4-13 4z" fill="#e1c69d" /><path d="m36 48 7 5 14-4v9l-14 4-7-5zm20-5 7 5 13-4v9l-13 4-7-5z" fill="#cba77d" />
      <path d="m42 31 6-2m14-2 5-1m-17 28 5-1m12-4 5-2" stroke="#f7ecd8" strokeWidth="3" />
    </>}
    {kind === 'bathroom' && <>
      <path d="m17 26 39-14 28 15v38L45 78 17 62z" fill="#d8e0d5" /><path d="m17 26 28 17v35L17 62z" fill={color} /><path d="m45 43 39-16v38L45 78z" fill="#e7eadf" />
      <path d="m21 49 22 13 38-14m-49 17 38-14m-37 2 23 14" fill="none" stroke="#c2cdbf" strokeWidth="1" />
      <path d="m27 35 13-4 7 5v15l-13 4-7-5z" fill="#fbf8eb" /><ellipse cx="40" cy="53" rx="12" ry="7" fill="#fffbed" /><path d="M33 55v10l9 3 6-8v-8" fill="#f4f4e8" /><ellipse cx="40" cy="51" rx="11" ry="6" fill="#fffdf2" /><ellipse cx="40" cy="51" rx="6" ry="3" fill="#a9c6c3" />
      <path d="m59 25 16-6v16l-16 6z" fill="#a2c7c6" stroke="#b49d80" strokeWidth="2" /><path d="m56 44 15-5 9 5-16 6z" fill="#fff9e9" /><path d="m56 44 8 6 16-6v13l-16 6-8-7z" fill="#b9a58b" /><ellipse cx="68" cy="44" rx="6" ry="3" fill="#b4cfca" /><path d="M69 41v-7h-4v4" fill="none" stroke="#869e9a" strokeWidth="2" />
    </>}
    {kind === 'shelf' && <>
      <path d="M25 17 68 10 80 17 38 25Z" fill="#d7b590" /><path d="M25 17 38 25 38 71 25 62Z" fill="#ac8059" /><path d="M38 25 80 17 80 63 38 71Z" fill={color} />
      <path d="m41 28 35-6v14l-35 6zm0 20 35-6v15l-35 6z" fill="#745441" opacity=".55" />
      <path d="m42 40 4-1V27l-4 1zm7-1 5-1V26l-5 1z" fill="#aba0c8" /><path d="m57 37 5-1V24l-5 1z" fill="#d8e8b6" /><path d="m65 36 5-1V25l-5 1z" fill="#f5dfb3" />
      <path d="m44 59 9-2-2-9-5 1zm17-2 11-2-3-8-6 1z" fill="#efe5d5" /><path d="m38 43 42-7v4l-42 7zm0 23 42-7v4l-42 7z" fill="#d3af88" />
    </>}
    {kind === 'table' && <>
      <path d="m25 40 6 2v26l-6-3zm43-2 6-3v29l-6 3zM47 50l6 1v25l-6-2z" fill="#98734e" />
      <path d="m19 32 38-12 28 18-37 14z" fill={color} /><path d="m19 32 29 16 37-10v6L48 57 19 39z" fill={wood} />
      <path d="m40 28 15-4 10 6-16 4z" fill="#b7c99c" /><path d="m40 28 9 6 16-4v4l-16 4-9-6z" fill="#f6e4bc" />
      <path d="m63 34 8-2 2 5-8 3z" fill="#c3b1df" />
    </>}
    {kind === 'counter' && <>
      <path d="m23 28 41-9 17 12-42 10z" fill="#ecdfcb" /><path d="m23 28 16 13v30L23 58z" fill="#96775b" /><path d="m39 41 42-10v28L39 71z" fill={color} />
      <path d="m47 45 27-7v17l-27 7z" fill="#efdfc8" opacity=".5" /><path d="m54 20 13-3v11l-13 3z" fill="#383344" /><path d="m56 21 9-2v7l-9 2z" fill="#bbcec0" /><path d="m59 30 1 4 9-2-4-3z" fill="#51495d" />
    </>}
    {kind === 'rack' && <>
      <path d="M28 62V22l42-8v43M23 63l12 4m28-8 13 2" fill="none" stroke="#ac8968" strokeWidth="4" strokeLinecap="round" />
      <path d="m32 29 5-2 5 2 8 1 3 9-7 4-2-7v23l-17 4V41l-3 8-6-2 8-15z" fill={color} /><path d="m58 24 5-2 6 2 10 2 5 8-7 3-4-7v24l-19 4V37l-3 8-7-3 9-15z" fill="#a7b6a0" />
    </>}
    {kind === 'plant' && <>
      <path d="m38 52 29-3-5 22-18 1z" fill={color} /><ellipse cx="52" cy="51" rx="15" ry="5" fill="#eedfc6" /><path d="m53 51-1-30m0 17-13-7m14 2 11-12" stroke="#486950" strokeWidth="3" fill="none" />
      <path d="M50 30C29 34 22 13 36 16c11 1 15 7 14 14M53 24C41 13 48 5 56 9c9 5 7 13-3 15M53 39c4-25 28-25 21-8-4 8-15 10-21 8M47 44c-16 3-27-11-16-15 9-3 18 7 16 15" fill="#739778" />
    </>}
    {kind === 'rug' && <>
      <path d="m15 43 43-17 29 19-43 21z" fill={color} /><path d="m23 44 34-13 22 14-34 16z" fill="none" stroke="#ede2d5" strokeWidth="2" /><path d="m16 46-5 2m10 1-5 2m10 1-5 2m10 1-5 2m10 1-5 2m10 1-5 2" stroke={color} strokeWidth="2" />
    </>}
    {kind === 'lamp' && <>
      <ellipse cx="52" cy="68" rx="15" ry="5" fill="#ac8a69" /><path d="M52 66V30" stroke="#8d7055" strokeWidth="3" /><path d="m37 16 25-3 10 22-38 4z" fill={color} /><ellipse cx="53" cy="36" rx="19" ry="5" fill="#f9e6b4" />
    </>}
    {kind === 'stool' && <>
      <path d="m35 39-4 28m29-26 6 29m-19-26-1 30" stroke="#aa825a" strokeWidth="5" /><ellipse cx="49" cy="39" rx="23" ry="12" fill="#ae8964" /><ellipse cx="49" cy="35" rx="23" ry="12" fill={color} />
    </>}
    {kind === 'chalkboard' && <>
      <path d="m35 20-9 51m38-50 10 47m-9-47-3 52M34 21l5 51" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <path d="m31 17 35-4 3 43-38 6z" fill={color} /><path d="m34 20 29-3 2 36-31 5z" fill="#453a4f" />
      <path d="m40 29 19-2m-18 10 16-2m-15 10 12-1" fill="none" stroke="#fff1d9" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="49" cy="51" rx="4" ry="2" fill="#dba79a" />
    </>}
    {kind === 'poster-stand' && <>
      <ellipse cx="51" cy="69" rx="17" ry="5" fill="#847586" /><path d="M51 67V49" stroke={color} strokeWidth="5" />
      <path d="m31 12 37-4 1 43-38 4z" fill={color} /><path d="m35 16 29-3 1 34-30 4z" fill="#f8ecda" />
      <circle cx="47" cy="28" r="8" fill="#d6a583" /><path d="m44 42 11-19 7 17z" fill="#9c9fb5" />
      <path d="m40 46 20-2" stroke="#756680" strokeWidth="2" />
    </>}
    {kind === 'direction-sign' && <>
      <ellipse cx="50" cy="70" rx="15" ry="5" fill="#be9d7b" /><path d="M50 67V12" stroke={wood} strokeWidth="5" strokeLinecap="round" />
      <path d="m25 19 37-3 13 9-12 11-38 3z" fill={color} />
      <path d="m38 28 21-2m-6-4 6 4-5 5" fill="none" stroke="#fff1d9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m63 42-26 2-12 10 13 8 25-3z" fill="#d6bea0" />
      <path d="m54 51-14 2m5-4-5 4 5 3" fill="none" stroke="#796180" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>}
    {kind === 'glass-cabinet' && <>
      <path d="m25 17 41-7 14 9-41 8z" fill="#ddd5c6" /><path d="m25 17 14 10v43L25 60z" fill="#849995" /><path d="m39 27 41-8v43l-41 8z" fill={color} />
      <path d="m42 29 34-7v36l-34 7z" fill="#b4d1ca" /><path d="m28 23 8 6v34l-8-6z" fill="#adc8c4" />
      <path d="m41 46 37-8M59 25v36" stroke="#ede7d9" strokeWidth="2" />
      <path d="m46 40 7-2-1-9-5 1zm17-3 8-2-2-9-5 1z" fill="#f0e4d2" /><ellipse cx="50" cy="55" rx="5" ry="3" fill="#d9ab8c" /><ellipse cx="68" cy="51" rx="5" ry="3" fill="#b59cc8" />
      <path d="m45 31 9-2-9 13m20 4 9-9" stroke="#f4fbf2" strokeWidth="2" opacity=".7" /><path d="m38 66 42-8v5l-42 8z" fill={color} /><path d="M34 67v5m40-10v5" stroke="#776c75" strokeWidth="3" />
    </>}
    {kind === 'display-plinth' && <>
      <path d="m30 39 28-8 18 10-29 9z" fill="#eee2d2" /><path d="m30 39 17 11v24L30 63z" fill="#a28691" /><path d="m47 50 29-9v24l-29 9z" fill={color} />
      <path d="m51 53 20-6v14l-20 6z" fill="#fff6e6" opacity=".22" /><ellipse cx="53" cy="38" rx="10" ry="5" fill="#967aa1" /><path d="M45 37c-2-5 3-8 4-15h8c0 7 6 10 4 14-2 5-13 6-16 1" fill="#bfa4c9" /><ellipse cx="53" cy="22" rx="4" ry="2" fill="#795f85" />
    </>}
    {kind === 'pegboard' && <>
      <path d="m29 18 44-8 7 5-43 8z" fill="#dbc7a7" /><path d="m29 18 8 5v40l-8-6z" fill="#9a7b60" /><path d="m37 23 43-8v40l-43 8z" fill={color} />
      {[0, 1, 2, 3, 4].flatMap(row => [0, 1, 2, 3, 4].map(col => <circle key={`${row}-${col}`} cx={42 + col * 7.5} cy={27 + row * 6 - col * 1.35} r="1" fill="#745d64" opacity=".48" />))}
      <path d="m35 60-5 11m41-17 6 11M28 71l13-2m31-3 13-2" stroke="#896f61" strokeWidth="3" strokeLinecap="round" />
      <path d="M47 34v4m20-10v5" stroke="#ede2d2" strokeWidth="3" /><path d="m42 39 11-2 1 13-13 2z" fill="#a3b5a1" /><path d="M44 39v-3c0-4 7-5 7-1v3" fill="none" stroke="#69836c" strokeWidth="2" /><path d="m62 36 10-2v12l-10 2z" fill="#c2afd4" /><path d="m42 57 30-6" stroke="#ede2d2" strokeWidth="3" />
    </>}
    {kind === 'food-display' && <>
      <path d="m22 42 43-11 17 11-43 12z" fill="#ede5d5" /><path d="m22 42 17 12v17L22 60z" fill="#9a7b62" /><path d="m39 54 43-12v17L39 71z" fill={color} />
      <path d="m23 22 42-9 16 28-42 12z" fill="#b7d4cc" opacity=".7" /><path d="m23 22 16 31-17-11z" fill="#8cafaa" opacity=".65" />
      <path d="m23 22 42-9 16 28-42 12-17-11zM23 22l16 31" fill="none" stroke="#d9decf" strokeWidth="2.5" />
      <path d="m38 44 9-3 8 4-10 3zm18-5 9-3 8 4-10 3z" fill="#7e6b70" /><path d="m39 41c4-8 10-6 11 1l-5 2zm20-5c3-6 8-6 10 1l-6 3z" fill="#e0b278" /><path d="m35 28 17-4-10 12" stroke="#f2f9ef" strokeWidth="3" fill="none" opacity=".8" /><path d="m46 60 27-7" stroke="#ecdec7" strokeWidth="2" />
    </>}
    {kind === 'drinks-fridge' && <>
      <path d="m31 14 31-6 12 8-31 7z" fill="#e7e5dc" /><path d="m31 14 12 9v49L31 64z" fill="#889b9d" /><path d="m43 23 31-7v49l-31 7z" fill={color} />
      <path d="m47 27 23-5v35l-23 5z" fill="#647b85" /><path d="m47 37 23-5m-23 17 23-5m-23 15 23-5" stroke="#bacac8" strokeWidth="1.6" />
      {[0, 1, 2].flatMap(row => [0, 1, 2].map(col => <g key={`${row}-${col}`} transform={`translate(${51 + col * 7} ${29 + row * 11 - col * 1.5})`}><path d="M0 0h3v2l1 1v6h-5V3l1-1z" fill={['#d9a587', '#b0c896', '#d6c8a3'][col]} /><path d="M0-1h3" stroke="#eee4ce" strokeWidth="1.4" /></g>))}
      <path d="m48 65 19-4m-18 7 17-4" stroke="#7d7888" strokeWidth="1.5" /><path d="M70 39v9" stroke="#eee7d8" strokeWidth="2" strokeLinecap="round" /><path d="m49 29 9-2-9 10" fill="none" stroke="#e8f5ee" opacity=".45" strokeWidth="2" />
    </>}
    {kind === 'coffee-station' && <>
      <path d="m20 44 43-11 19 12-43 13z" fill="#ece3d1" /><path d="m20 44 19 14v13L20 58z" fill="#97785f" /><path d="m39 58 43-13v14L39 71z" fill={color} />
      <path d="m35 25 29-7 10 6-30 8z" fill="#c5cfca" /><path d="m35 25 9 7v18l-9-6z" fill="#7f8f90" /><path d="m44 32 30-8v19l-30 8z" fill="#9aabb0" /><path d="m48 37 21-6v10l-21 6z" fill="#514d5a" />
      <path d="m48 35 4-1m12-3 4-1M52 39v5m12-8v5" stroke="#e8decc" strokeWidth="2" /><path d="m45 49 28-8v4l-28 8z" fill="#dbe1d8" /><path d="m50 43 7-2v5l-6 2zm12-3 7-2v5l-6 2z" fill="#f5e6cf" />
      <path d="m48 24 7-2v5l-6 2zm11-3 7-2v5l-6 2z" fill="#f7eee0" /><ellipse cx="29" cy="46" rx="5" ry="3" fill="#bd9fba" /><path d="M27 43v-9h5v10" fill="#89717e" />
    </>}
    {kind === 'prep-counter' && <>
      <path d="m21 38 43-11 19 12-43 14z" fill="#d9e0d9" /><path d="m21 38 19 15v17L21 56z" fill="#92a2a0" /><path d="m40 53 43-14v18L40 71z" fill={color} />
      <path d="m44 57 33-10v8L44 65z" fill="#f0ebdc" opacity=".5" /><path d="m50 57 14-4" stroke="#807d81" strokeWidth="2" strokeLinecap="round" /><path d="m28 59-1 10m15 1v5m35-18v8" stroke="#879291" strokeWidth="3" />
      <path d="m33 36 23-6 14 8-23 7z" fill="#cda878" /><path d="m49 34 5 3m-2-6 5 3" stroke="#e8c88c" strokeWidth="3" /><path d="m36 37 4-2 8 5-4 1z" fill="#d5dfd9" /><path d="m32 34 5 3" stroke="#766572" strokeWidth="2.5" /><ellipse cx="66" cy="31" rx="5" ry="3" fill="#b97762" /><path d="m65 27 2 4 2-4" fill="none" stroke="#769579" strokeWidth="2" />
    </>}
    {kind === 'stove' && <>
      <path d="m24 34 39-10 18 12-39 12z" fill="#d4dcd6" /><path d="m24 34 18 14v23L24 59z" fill="#869794" /><path d="m42 48 39-12v24L42 71z" fill={color} />
      <path d="m48 53 27-8v15l-27 8z" fill="#635b69" /><path d="m52 56 18-6v9l-18 6z" fill="#9faaa5" /><path d="m51 59 16-5" stroke="#d9b285" strokeWidth="2" /><path d="m50 53 21-6" stroke="#e2e6db" strokeWidth="2" />
      <ellipse cx="40" cy="35" rx="6" ry="3" fill="#6b6671" /><ellipse cx="58" cy="30" rx="6" ry="3" fill="#6b6671" /><ellipse cx="52" cy="41" rx="6" ry="3" fill="#6b6671" /><ellipse cx="70" cy="36" rx="6" ry="3" fill="#6b6671" />
      <path d="m26 32 38-10v-5l-38 10z" fill="#a6b6ae" /><circle cx="47" cy="50" r="1.5" fill="#eed6b0" /><circle cx="54" cy="48" r="1.5" fill="#eed6b0" /><circle cx="61" cy="46" r="1.5" fill="#eed6b0" />
    </>}
    {kind === 'sink' && <>
      <path d="m22 35 43-11 18 12-43 13z" fill="#dde3da" /><path d="m22 35 18 14v22L22 59z" fill="#92a09a" /><path d="m40 49 43-13v23L40 71z" fill={color} />
      <path d="m33 35 27-7 11 7-28 8z" fill="#a5b8b4" /><path d="m38 35 22-5 6 5-22 6z" fill="#718e91" /><path d="m43 35 18-4" stroke="#b4ceca" strokeWidth="1.5" />
      <path d="M60 29V18c0-7-11-6-11 1v6" fill="none" stroke="#879da2" strokeWidth="3.5" strokeLinecap="round" /><path d="M49 24v3" stroke="#d3e7dd" strokeWidth="2" /><path d="m42 47 38-11m-19 7v21" stroke="#9b969a" strokeWidth="1" /><path d="m56 51v6m8-9v6" stroke="#e5decf" strokeWidth="2" strokeLinecap="round" />
    </>}
    {kind === 'dining-table' && <>
      <path d="m32 44-4 26m42-27 6 24M49 51v24" stroke="#9b7758" strokeWidth="5" strokeLinecap="round" /><ellipse cx="52" cy="42" rx="31" ry="17" fill="#aa8764" /><ellipse cx="52" cy="37" rx="31" ry="17" fill={color} />
      <ellipse cx="41" cy="35" rx="10" ry="5" fill="#f2eadb" /><ellipse cx="41" cy="35" rx="6" ry="3" fill="#d6c6b0" /><ellipse cx="64" cy="41" rx="9" ry="4.5" fill="#f2eadb" /><ellipse cx="64" cy="41" rx="5" ry="2.5" fill="#cfc1c6" />
      <path d="m26 31 7 4m36 2 7 4" stroke="#eee8d7" strokeWidth="1.5" strokeLinecap="round" /><path d="m54 28 7-1v6l-7 1z" fill="#a2beb9" /><path d="M56 27v-3" stroke="#e9d9b5" strokeWidth="1.5" />
    </>}
    {kind === 'service-cart' && <>
      <path d="M29 30v33m43-46v40M28 30l-7-5v-9l13-3" fill="none" stroke="#8f898f" strokeWidth="3" strokeLinecap="round" />
      <path d="m27 48 33-8 17 11-33 9z" fill="#b1c0b6" /><path d="m27 48 17 12 33-9v5l-33 9-17-12z" fill={color} /><path d="m28 25 33-8 17 11-34 9z" fill="#e7ded0" /><path d="m28 25 16 12 34-9v5l-34 9-16-12z" fill={color} />
      <path d="M44 38v26m34-36v29" stroke="#9d9198" strokeWidth="3" /><circle cx="31" cy="66" r="4" fill="#6a626f" /><circle cx="46" cy="71" r="4" fill="#6a626f" /><circle cx="75" cy="61" r="4" fill="#6a626f" />
      <path d="m40 24 5-1v-9l-2-1v-3h-2v4l-1 1z" fill="#9cb894" /><path d="m51 23 5-1v-9l-2-1V9h-2v4l-1 1z" fill="#d4b080" /><path d="m58 27 9-2v5l-9 2z" fill="#f7eee0" /><path d="m42 54 22-6m-20 9 20-6" stroke="#f7ecda" strokeWidth="3" strokeLinecap="round" />
    </>}
  </svg>;
}
