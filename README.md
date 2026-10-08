# Store Maker

Playground lokal untuk merancang toko 3D di sebuah sudut kota: gambar bentuk lantai dari petak, tarik tinggi dinding, geser perabot, isi pajangan, lalu simpan desain atau foto toko. Dibuat dengan React, TypeScript, dan Three.js. Seluruh bentuk 3D dibuat secara prosedural dari kode, tanpa model 3D eksternal.

## Menjalankan

Siapkan Node.js dan npm, lalu jalankan dari folder `store-maker`:

```sh
npm install
npm run dev
```

Buka **http://127.0.0.1:4330**. Di Windows, jalankan `run.bat` atau `./run.bat` dari terminal; skrip memasang dependensi jika `node_modules` belum ada, lalu menjalankan aplikasi. Port 4330 harus kosong.

## Membuat toko

### Bangunan, lantai, dan eksterior

Contoh baru memiliki **dua lantai**: toko, kamar mandi, dan tangga di lantai 1; rak gudang di lantai 2. Desain yang sudah tersimpan tetap dipertahankan. Gunakan **Reset ke toko contoh** untuk mencoba contoh baru (bisa diurungkan).

- **Jumlah lantai** memilih 1 sampai **4 lantai**. Tombol **LT 1–4** memilih lantai yang sedang ditata. Interior menampilkan satu lantai terbuka agar barang mudah dipilih; bentuk lantai, dinding, perabot, dan aksesori masing-masing lantai dapat diubah sendiri.
- Lantai baru mengikuti bentuk lantai sebelumnya. Tangga ditambahkan di lantai penghubung jika ada ruang; tangga tambahan dapat dipasang dari **Gudang & utilitas**. Katalog ini juga memuat rak gudang berisi kardus dan modul kamar mandi dengan toilet, wastafel, serta pancuran.
- **Eksterior** memperlihatkan seluruh bangunan dari luar dengan pintu dan jendela yang sama seperti desain Interior. Posisi, arah, bentuk, ukuran, warna, dan keadaan pintu tetap sama; jendela hanya muncul di tempat yang dipasang. Atur warna fasad dan lis, kanopi masuk, serta **Genteng** atau **Rooftop**. Atap genteng memiliki bidang miring dan barisan genteng; rooftop memiliki pagar pembatas dan pilihan taman dengan pergola.
- **Lihat tokoku** menyembunyikan panel. Dalam mode Eksterior, foto yang diunduh menampilkan seluruh bangunan dan atap. Pilihan siang/malam tetap tersedia.
- Mengurangi jumlah lantai menghapus lantai paling atas berikut isinya dalam satu langkah; **Urungkan** memulihkannya. Semua lantai, fasad, dan atap ikut autosave, undo/redo, ekspor, serta impor, termasuk ketika file disimpan saat sedang menata lantai atas.

### Musik

Menu **Atur musik dan volume** menyediakan musik cozy ceria (melodi original dengan bunyi petik dan marimba) serta **Piano & gerimis**. Musik ceria dipilih secara default; pilihan lagu dan volume diingat di browser. Musik mengikuti izin autoplay browser, dapat dijeda, dan berhenti saat tab disembunyikan. Seluruh musik disintesis secara lokal tanpa unduhan audio atau layanan luar.

### Menata ruangan

1. Pilih perabot di **Isi toko**, lalu klik petak lantai atau gunakan pilihan petak dan tombol **Letakkan di sini**.
2. Di mode **Atur barang**, seret perabot langsung di scene untuk memindahkannya. Klik untuk mengganti warna, memutar 90°, menyalin, atau menghapusnya. Pada perabot pajangan, pilih isi melalui kelompok **Barang** atau **Makanan**, atau tekan **Kosong**.
3. Pilih **Bangun → + Lantai**: klik atau sapu petak transparan untuk menambah lantai. Pilih **Hapus** untuk memotong bentuknya menjadi L, membentuk halaman, atau membuat bagian lain. Dinding mengikuti kontur petak; lantai di bawah furnitur dilindungi. Petak terakhir dapat dihapus jika tidak ada barang atau aksesori yang kehilangan tempat. Area gambar maksimum 24×24 petak; panduan di sekitar bentuk bertambah saat diperluas. Palet dinding/lantai ada di **Ruangan**.
4. Pilih **Dinding & pintu**: tarik pegangan atas untuk tinggi dinding (**2,3–4,5 m**), atau geser pegangan pintu sepanjang sisi depan yang tersedia. Pintu menyesuaikan batas lantai, termasuk bentuk L. Di mode Atur barang maupun Dinding & pintu, seret badan pintu langsung untuk memindahkannya. Klik/ketuk hanya memilih pintu dan menampilkan pegangan hijau serta panel pengaturannya; membuka/menutup memakai tombol terpisah pada panel atau tampilan Lihat tokoku. Kontrol posisi di panel menjadi alternatif tanpa drag. Klik dan gerakan kecil tidak mengubah desain atau mengisi riwayat undo.
5. Tombol ikon kota menyembunyikan/menampilkan jalan, trotoar, pohon, dan bangunan tetangga. Gunakan **Lihat tokoku** untuk melihat hasil tanpa panel pengeditan.

Panel pintu menyediakan **Putar kiri** dan **Putar kanan**, masing-masing 90°. Bingkai, kanopi, keset, dan pijakan ikut berputar di posisi yang sama. Arah pintu tersimpan dalam desain, mendukung undo/redo, dan tetap dipertahankan saat pintu digeser atau dibuka/ditutup.

Dua tombol **Mulai ulang toko** tersedia di panel kiri, tepat di bawah tab Isi toko/Ruangan:

- **Reset ke toko contoh** mengembalikan seluruh desain bawaan: nama, bentuk ruangan, warna, pintu, perabot, dan aksesori.
- **Kosongkan semua** membersihkan area sampai **nol petak**, termasuk lantai, dinding, pintu, keset, perabot, dan aksesori. Mode Bangun dengan petak transparan langsung aktif; klik atau sapu petak untuk memulai lagi. Lingkungan kota tetap menjadi latar.

Setiap aksi merupakan satu langkah **Urungkan** dan dapat diulang lewat **Ulangi**. Hasil tersimpan otomatis; desain kosong tetap kosong setelah dimuat ulang atau diekspor/impor. Mengklik tombol yang sama ketika desain sudah persis sesuai tidak menambah riwayat kosong.

Lingkungan kota berisi ruko dengan balkon dan taman atap, teras kafe, petak bunga, pejalan kaki, dan siluet gedung tinggi yang lebih samar di kejauhan. Semua bagian ini dekoratif dan mengikuti batas toko; tidak ikut terpilih ketika mengatur barang. Kamera 3D memberi sedikit ruang tambahan untuk lingkungan, sementara sudut Atas dan Depan tetap berfokus pada toko.

Tombol **matahari/bulan** di deretan kontrol kanan bawah mengganti **siang / mode malam**. Peralihan mengubah langit, cahaya lingkungan, dan kabut secara halus; lampu toko, lampu jalan, serta sebagian jendela kota memberi cahaya hangat. Lampu dinding mengikuti pengaturan nyala/padamnya. Saat dinding atau lingkungan kota disembunyikan, pencahayaan dari bagian tersebut ikut disembunyikan. Editor tetap dapat digunakan pada malam hari, termasuk menggambar lantai dari area kosong.

Pilihan siang/malam diingat pada browser ini sebagai preferensi tampilan terpisah dari dokumen desain, sehingga mengganti waktu tidak mengubah susunan toko atau riwayat undo. **Reset ke toko contoh** kembali ke siang; **Kosongkan semua** mempertahankan waktu yang sedang dipilih. **Lihat tokoku** dan **Unduh foto toko** mengikuti pencahayaan yang dipilih. Preferensi pengurangan animasi pada perangkat dihormati dengan pergantian langsung.

Ada **25 perabot lantai**, termasuk tangga, rak gudang, kamar mandi, dan tiga papan berdiri. Kategori **Pajangan** menambahkan **vitrin kaca, podium pajang, dan rak aksesori** di samping rak, meja, serta gantungan baju. Isi barang tersedia dalam sembilan jenis: **buku, keramik, tanaman, fashion, vinyl, sepatu, tas, skincare, dan mainan**. Bentuk produk tampil langsung pada rak atau meja.

Kategori **Toko makanan** berisi **etalase makanan, kulkas minuman, bar kopi, meja persiapan, kompor & oven, bak cuci, meja makan dengan kursi, dan troli saji**, serta meja kasir dan bangku. Bar kopi sudah dilengkapi mesin kopi, penggiling, dan cangkir; meja persiapan, kompor, serta bak cuci memiliki detail perlengkapannya sendiri.

Pilihan isi **Makanan** mencakup **roti, kue, minuman, buah, hidangan, dan camilan**. Etalase dan troli menerima semua jenis makanan; kulkas menerima minuman, buah, hidangan, atau camilan. Pajangan umum juga bisa diisi makanan. Pilihan yang tidak sesuai dengan perabot tidak ditampilkan. Setiap pajangan tetap bisa dikosongkan.

Penempatan memeriksa tabrakan dan batas lantai, termasuk setelah rotasi. Semua perabot baru mendukung pindah, putar, ubah ukuran, salin, undo/redo, dan penyimpanan desain. Karpet boleh berada di bawah furnitur; dua karpet tidak boleh bertumpuk.

Semua perabot dan aksesori dinding dapat diubah ukurannya. Pilih objek, lalu aktifkan **Ubah ukuran**. Seret salah satu pegangan ungu untuk memperpanjang atau memperpendek satu sisi; sisi seberangnya tetap menjadi patokan. Klik petak transparan untuk menentukan sudut ukuran baru. Perabot mengikuti petak lantai utuh, sementara aksesori dinding memakai langkah 0,1 m saat diseret dan panduan petak 0,5 m saat diklik. Kolom **Panjang**, **Kedalaman**, atau **Tinggi** menyediakan pengaturan angka; tekan Enter atau pindah kolom untuk menyimpan.

Pratinjau merah menandakan ukuran melewati lantai/dinding atau bertabrakan. Perubahan tersebut dikembalikan saat dilepas. Escape atau sentuhan kedua membatalkan tarikan; satu tarikan menghasilkan satu langkah undo. Ukuran tetap tersimpan setelah objek diputar, dipindahkan, disalin, diekspor, atau halaman dimuat ulang. Bukaan jendela ikut berubah ukurannya. Rak/meja besar menambah bagian penyangga dan isi pajangan, dengan tinggi perabot tetap sama. Papan berdiri yang diperbesar harus sepenuhnya berada di lantai atau trotoar agar kakinya berada pada permukaan yang sama.

Kategori **Isi toko → Papan** menambah **papan kapur, poster berdiri, dan penunjuk arah**. Ketiganya bisa diseret di lantai atau dua baris petak trotoar depan toko, diputar, diwarnai, disalin, dan dihapus. Panel **Variasi papan** mengganti bentuk tanpa mengubah posisi. Papan mengikuti permukaan tempatnya berdiri ketika lingkungan kota ditampilkan atau disembunyikan.

Kategori **Isi toko → Dinding** berisi **jendela, lampu dinding, rak buku tempel, lukisan, dan papan nama**. Pilih aksesori lalu klik dinding belakang atau kiri; pratinjau hijau menandakan posisi yang valid. Seret aksesori untuk menggeser, menaikkan, atau memindahkannya ke bidang dinding lain. Posisi disimpan pada kelipatan 0,1 m. Bukaan jendela ikut berpindah. Panel detail menyediakan pilihan bidang dinding, posisi, tinggi, warna, salin, dan hapus. Tulisan papan dapat diedit, dan lampu dapat dinyalakan/dimatikan.

Jendela memiliki lima pilihan pada **Variasi jendela**: **Klasik**, **Panoramik**, **Kisi-kisi**, **Geser**, dan **Lengkung**. Pilih gaya sebelum memasang atau ketika jendela sudah dipilih. Mengganti gaya mempertahankan ukuran, warna, dan posisi; bentuk bukaan pada model Lengkung mengikuti kurvanya. Gaya ikut tersimpan, disalin, dan dipulihkan lewat undo/redo. Jendela dari desain lama tetap menggunakan gaya Klasik.

Aksesori harus muat pada bidang dinding dan tidak bertumpuk dengan aksesori lain. Ketika lantai atau tinggi dinding berubah, aksesori yang masih muat dipertahankan di tempatnya; yang terdampak dipindahkan ke bidang valid terdekat. Perubahan bentuk yang tidak menyisakan tempat untuk semua aksesori ditolak, sehingga aksesori tidak hilang. Rak tempel merupakan aksesori dinding dengan buku; pengaturan isi pajangan tersedia pada perabot lantai.

Geser area kosong untuk memutar kamera, dan gulir untuk zoom. Di ponsel, tarik objek/pegangan dengan satu jari, geser area kosong untuk memutar, dan cubit dengan dua jari untuk zoom. Tombol **3D**, **Atas**, **Depan**, reset kamera, petak, dan dinding membantu melihat susunan dari berbagai sisi.

Sapuan petak dan tarikan menampilkan pratinjau langsung, lalu menyimpan satu perubahan saat dilepas. **Escape**, pembatalan pointer, atau penambahan jari kedua membatalkan tarikan. Penempatan yang bertabrakan atau melewati petak kosong dikembalikan; satu kali undo membatalkan satu tarikan utuh. Kamera tidak direset ketika bentuk lantai berubah.

| Pintasan | Aksi |
| --- | --- |
| `R` | Putar perabot yang dipilih atau sedang ditempatkan |
| `Delete` / `Backspace` | Hapus perabot terpilih |
| `Escape` | Batalkan penempatan atau pilihan |
| `Ctrl+Z` | Urungkan |
| `Ctrl+Shift+Z` | Ulangi |

Di macOS, gunakan `Cmd` sebagai pengganti `Ctrl`. Pintasan pengeditan tidak aktif saat mengetik di kolom atau melihat pratinjau. Riwayat undo menyimpan maksimal **60 perubahan dalam sesi** dan direset saat halaman dimuat ulang.

## Menyimpan dan memindahkan desain

Desain otomatis tersimpan di `localStorage` dengan kunci **`nemu.store-maker.v1`**, pada browser, profil, dan alamat aplikasi yang sama. Data tidak tersinkron antarperangkat; menghapus data situs dapat menghapus desain.

File desain lama tetap bisa dibuka. Tinggi dinding dan keadaan pintu menggunakan nilai awal jika belum ada dalam file; lantai lama tetap berbentuk persegi panjang sampai diedit. Bentuk baru tersimpan sebagai `floorCells`. Jangkar koordinat lama tetap dipakai agar menambah petak tidak menggeser perabot yang sudah ada. Aksesori disimpan sebagai `wallItems`; jendela dan papan bawaan pada desain lama menjadi aksesori yang dapat dipilih dan diedit. Ruang kosong baru tidak memiliki aksesori bawaan.

Dokumen versi 1 dimigrasikan ke versi 2 saat dibuka: papan kapur dekoratif menjadi barang yang dapat diedit jika tersedia tempat valid. Papan berdiri disimpan di `items`, sehingga posisi, variasi, dan penghapusannya bertahan setelah dimuat ulang. Kunci penyimpanan browser tetap sama agar desain lama ditemukan.

Menu **Desain** menyediakan:

- **Simpan file desain**: unduh cadangan `.store-maker.json` yang bisa diedit lagi.
- **Buka file desain**: impor cadangan, termasuk file lama `.nemu.json` atau `.json`; struktur, ukuran, warna, posisi, dan tabrakan divalidasi sebelum diterapkan.
- **Unduh foto toko**: simpan tampilan kamera sebagai `store-maker.png`. PNG adalah gambar, bukan cadangan yang dapat diimpor.

Jika penyimpanan browser tidak tersedia, aplikasi menampilkan **Unduh cadangan**. Simpan file desain untuk mempertahankan pekerjaan.

## Build dan pemeriksaan

```sh
npm run build
npm run preview
npm test
npx playwright install chromium
npm run test:e2e
```

Build menghasilkan `dist/`; preview memakai port 4330. Vitest menguji model dan validasi. Playwright menjalankan browser desktop dan seluler pada server terpisah di **4335**, sehingga port tersebut harus tersedia. Instalasi Chromium cukup dilakukan saat browser pengujian belum terpasang.

## Struktur utama

```text
src/App.tsx               Panel editor, riwayat, autosave, impor/ekspor
src/model.ts              Dokumen, katalog, validasi, perubahan immutable
src/model.test.ts         Tes model
src/components/ShopCanvas.tsx  Penghubung React dengan scene
src/scene/ShopScene.ts    Kamera, interaksi, renderer, foto
src/scene/objects.ts      Bentuk perabot dan isi pajangan
src/scene/catalogObjects.ts  Perabot pajangan dan perlengkapan toko makanan
src/scene/stockObjects.ts    Bentuk produk, makanan, dan minuman
src/scene/city.ts         Lingkungan kota dengan instanced meshes
src/scene/lighting.ts     Peralihan siang/malam dan pencahayaan lampu
tests/                   Tes browser Playwright
```

Prototype ini belum terhubung ke akun Nemu, belum menerbitkan toko, dan belum memiliki simulasi pelanggan, transaksi, atau ekonomi. Isi pajangan bersifat visual.
