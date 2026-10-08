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

Contoh baru memiliki **dua lantai berukuran 10 × 9 petak**: toko dengan jalur jalan yang lega, kamar mandi di sudut belakang, dan tangga terbuka di lantai 1; rak gudang dengan lorong terpisah di lantai 2. Kedua lantai memiliki jendela depan dan kanan yang ikut terlihat dari luar. Desain yang sudah tersimpan tetap dipertahankan. Gunakan **Desain → Gunakan toko contoh** atau **Reset ke toko contoh** di panel kiri untuk mencoba contoh baru (bisa diurungkan).

- **Jumlah lantai** memilih 1 sampai **4 lantai**. Tombol **LT 1–4** memilih lantai yang sedang ditata. Lantai pilihan tampil penuh pada ketinggian bangunannya; lantai di bawah tetap terlihat samar sebagai konteks, dengan kamera berfokus pada lantai aktif. Hanya lantai aktif yang dapat diedit.
- Lantai baru mengikuti bentuk lantai sebelumnya. Tangga ditambahkan di lantai penghubung jika ada ruang; tangga tambahan dapat dipasang dari **Gudang & utilitas**. Lantai atas memiliki bukaan sungguhan sesuai posisi, arah, dan ukuran tangga di bawah, dengan pagar di tepinya. Katalog ini juga memuat rak gudang berisi kardus, serta **toilet, wastafel, dan shower sebagai perabot terpisah**. Setiap perlengkapan bisa dipindah, diputar, diwarnai, dan diubah ukurannya sendiri. Modul kamar mandi dari desain lama tetap bisa dibuka.
- **Eksterior** memperlihatkan seluruh bangunan dari luar dengan pintu dan jendela yang sama seperti desain Interior. Posisi, arah, bentuk, ukuran, warna, dan keadaan pintu tetap sama; jendela hanya muncul di tempat yang dipasang. Atur warna fasad dan lis, kanopi masuk, serta **Genteng** atau **Rooftop**. Atap genteng memiliki bidang miring dan barisan genteng; rooftop memiliki pagar pembatas dan perabot outdoor yang bisa ditata.
- Pilih tab **Rooftop** di sebelah tombol lantai, atau **Eksterior → Rooftop → Tata rooftop**. Area ini berada di atas lantai paling atas dan tidak menambah hitungan lantai: tetap maksimal **4 lantai + rooftop**. Konversi pertama menyiapkan area duduk dan tanaman jika ada ruang. Pilih **Outdoor** atau **Semua** untuk menambah barang, lalu geser, putar, ubah ukuran, salin, atau hapus seperti biasa. Warna lantainya bisa diubah lewat **Ruangan**. Luas teras mengikuti kontur lantai paling atas.
- Tangga ke rooftop otomatis dipasang di lantai paling atas jika tersedia ruang, lengkap dengan bukaan lantai dan pagar tangga. Jika ruangan penuh, kosongkan area lewat **Ke lantai N**, lalu pilih **Tambah tangga ke rooftop**. Barang tidak bisa menutup bukaan dan jalur keluar tangga. Lantai di bawah terlihat samar saat rooftop ditata. Perabot rooftop ikut autosave, undo/redo, ekspor/impor, dan tetap disimpan saat atap diganti menjadi genteng; tampilkan kembali dengan memilih Rooftop. Perubahan bentuk bangunan yang membuat perabot rooftop kehilangan tempat ditolak sampai barangnya dipindahkan.
- **Lihat tokoku** menyembunyikan panel. Dalam mode Eksterior, foto yang diunduh menampilkan seluruh bangunan dan atap. Pilihan siang/malam tetap tersedia.
- Mengurangi jumlah lantai menghapus lantai paling atas berikut isinya dalam satu langkah; **Urungkan** memulihkannya. Semua lantai, fasad, dan atap ikut autosave, undo/redo, ekspor, serta impor, termasuk ketika file disimpan saat sedang menata lantai atas.

### Musik

Menu **Atur musik dan volume** menyediakan musik cozy ceria (melodi original dengan bunyi petik dan marimba) serta **Piano & gerimis**. Musik ceria dipilih secara default; pilihan lagu dan volume diingat di browser. Musik mengikuti izin autoplay browser, dapat dijeda, dan berhenti saat tab disembunyikan. Seluruh musik disintesis secara lokal tanpa unduhan audio atau layanan luar.

Pergantian Interior/Eksterior dan lantai menampilkan loading singkat, lalu membuka scene setelah frame baru siap. Canvas tetap dipakai ulang. Musik yang sudah disiapkan berjalan sebagai loop audio native, sehingga pembangunan model 3D tidak memutus atau mengulang lagunya.

### Menata ruangan

1. Pilih perabot di **Isi toko**, lalu klik petak lantai atau gunakan pilihan petak dan tombol **Letakkan di sini**.
2. Di mode **Atur barang**, seret perabot langsung di scene untuk memindahkannya. Klik untuk mengganti warna, memutar 90°, menyalin, atau menghapusnya. Pada perabot pajangan, pilih isi melalui kelompok **Barang** atau **Makanan**, atau tekan **Kosong**.
3. Pilih **Bangun → + Lantai**: klik atau sapu petak transparan untuk menambah lantai. Pilih **Hapus** untuk memotong bentuknya menjadi L, membentuk halaman, atau membuat bagian lain. Dinding mengikuti kontur petak; lantai di bawah furnitur dilindungi. Petak terakhir dapat dihapus jika tidak ada barang atau aksesori yang kehilangan tempat. Area gambar maksimum 24×24 petak; panduan di sekitar bentuk bertambah saat diperluas. Palet dinding/lantai ada di **Ruangan**.
4. Pilih **Dinding & pintu**: tarik pegangan atas untuk tinggi dinding (**2,3–4,5 m**), atau pilih **Sisi pintu masuk** (depan, kanan, belakang, kiri) dan geser pegangan pintu sepanjang sisi tersebut. Pintu menyesuaikan batas lantai, termasuk bentuk L. Di mode Atur barang maupun Dinding & pintu, seret badan pintu langsung untuk memindahkannya. Klik/ketuk hanya memilih pintu dan menampilkan pegangan hijau serta panel pengaturannya; membuka/menutup memakai tombol terpisah pada panel atau tampilan Lihat tokoku. Kontrol posisi di panel menjadi alternatif tanpa drag. Klik dan gerakan kecil tidak mengubah desain atau mengisi riwayat undo.
5. Pilih **Ruangan → Atur tembok dalam** atau **Bangun → Sekat**. Tarik garis petak untuk membangun tembok, atau gunakan **Tambah**. Pilih tembok untuk mengubah arah, posisi, panjang, warna, atau menghapusnya. **Tambah pintu** membuat bukaan sungguhan; posisi, lebar, dan keadaan buka/tutup pintu dapat diatur terpisah. Tembok memerlukan lantai di kedua sisi dan tidak boleh memotong perabot. Menghapus tembok menghapus pintu yang menempel padanya; semuanya bisa diurungkan dan ikut tersimpan.
6. Tombol ikon kota menyembunyikan/menampilkan jalan, trotoar, pohon, dan bangunan tetangga. Gunakan **Lihat tokoku** untuk melihat hasil tanpa panel pengeditan.

Panel pintu menyediakan **Putar kiri** dan **Putar kanan**, masing-masing 90°. Bingkai, kanopi, keset, dan pijakan ikut berputar di posisi yang sama. Arah pintu tersimpan dalam desain, mendukung undo/redo, dan tetap dipertahankan saat pintu digeser atau dibuka/ditutup.

Dua tombol **Mulai ulang toko** tersedia di panel kiri, tepat di bawah tab Isi toko/Ruangan:

- **Reset ke toko contoh** mengembalikan seluruh desain bawaan: nama, bentuk ruangan, warna, pintu, perabot, dan aksesori.
- **Kosongkan semua** membersihkan area sampai **nol petak**, termasuk lantai, dinding, pintu, keset, perabot, dan aksesori. Mode Bangun dengan petak transparan langsung aktif; klik atau sapu petak untuk memulai lagi. Lingkungan kota tetap menjadi latar.

Setiap aksi merupakan satu langkah **Urungkan** dan dapat diulang lewat **Ulangi**. Hasil tersimpan otomatis; desain kosong tetap kosong setelah dimuat ulang atau diekspor/impor. Mengklik tombol yang sama ketika desain sudah persis sesuai tidak menambah riwayat kosong.

Lingkungan kota berisi ruko dengan balkon dan taman atap, teras kafe, petak bunga, pejalan kaki, dan siluet gedung tinggi yang lebih samar di kejauhan. Semua bagian ini dekoratif dan mengikuti batas toko; tidak ikut terpilih ketika mengatur barang. Kamera 3D memberi sedikit ruang tambahan untuk lingkungan, sementara sudut Atas dan Depan tetap berfokus pada toko.

Tombol **matahari/bulan** di deretan kontrol kanan bawah mengganti **siang / mode malam**. Peralihan mengubah langit, cahaya lingkungan, dan kabut secara halus; lampu toko, lampu jalan, serta sebagian jendela kota memberi cahaya hangat. Lampu dinding mengikuti pengaturan nyala/padamnya. Saat dinding atau lingkungan kota disembunyikan, pencahayaan dari bagian tersebut ikut disembunyikan. Editor tetap dapat digunakan pada malam hari, termasuk menggambar lantai dari area kosong.

Pilihan siang/malam diingat pada browser ini sebagai preferensi tampilan terpisah dari dokumen desain, sehingga mengganti waktu tidak mengubah susunan toko atau riwayat undo. **Reset ke toko contoh** kembali ke siang; **Kosongkan semua** mempertahankan waktu yang sedang dipilih. **Lihat tokoku** dan **Unduh foto toko** mengikuti pencahayaan yang dipilih. Preferensi pengurangan animasi pada perangkat dihormati dengan pergantian langsung.

Ada **27 perabot lantai** di katalog, termasuk tangga, rak gudang, toilet, wastafel, shower, dan tiga papan berdiri. Kategori **Pajangan** menambahkan **vitrin kaca, podium pajang, dan rak aksesori** di samping rak, meja, serta gantungan baju. Isi barang tersedia dalam sembilan jenis: **buku, keramik, tanaman, fashion, vinyl, sepatu, tas, skincare, dan mainan**. Bentuk produk tampil langsung pada rak atau meja.

Kategori **Toko makanan** berisi **etalase makanan, kulkas minuman, bar kopi, meja persiapan, kompor & oven, bak cuci, meja makan dengan kursi, dan troli saji**, serta meja kasir dan bangku. Bar kopi sudah dilengkapi mesin kopi, penggiling, dan cangkir; meja persiapan, kompor, serta bak cuci memiliki detail perlengkapannya sendiri.

Pilihan isi **Makanan** mencakup **roti, kue, minuman, buah, hidangan, dan camilan**. Etalase dan troli menerima semua jenis makanan; kulkas menerima minuman, buah, hidangan, atau camilan. Pajangan umum juga bisa diisi makanan. Pilihan yang tidak sesuai dengan perabot tidak ditampilkan. Setiap pajangan tetap bisa dikosongkan.

Penempatan memeriksa tabrakan dan batas lantai, termasuk setelah rotasi. Semua perabot baru mendukung pindah, putar, ubah ukuran, salin, undo/redo, dan penyimpanan desain. Karpet boleh berada di bawah furnitur; dua karpet tidak boleh bertumpuk.

Semua perabot dan aksesori dinding dapat diubah ukurannya. Pilih objek, lalu aktifkan **Ubah ukuran**. Seret salah satu pegangan ungu untuk memperpanjang atau memperpendek satu sisi; sisi seberangnya tetap menjadi patokan. Klik petak transparan untuk menentukan sudut ukuran baru. Perabot mengikuti petak lantai utuh, sementara aksesori dinding memakai langkah 0,1 m saat diseret dan panduan petak 0,5 m saat diklik. Kolom **Panjang**, **Kedalaman**, atau **Tinggi** menyediakan pengaturan angka; tekan Enter atau pindah kolom untuk menyimpan.

Pratinjau merah menandakan ukuran melewati lantai/dinding atau bertabrakan. Perubahan tersebut dikembalikan saat dilepas. Escape atau sentuhan kedua membatalkan tarikan; satu tarikan menghasilkan satu langkah undo. Ukuran tetap tersimpan setelah objek diputar, dipindahkan, disalin, diekspor, atau halaman dimuat ulang. Bukaan jendela ikut berubah ukurannya. Rak/meja besar menambah bagian penyangga dan isi pajangan, dengan tinggi perabot tetap sama. Papan berdiri yang diperbesar harus sepenuhnya berada di lantai atau trotoar agar kakinya berada pada permukaan yang sama.

Kategori **Isi toko → Papan** menambah **papan kapur, poster berdiri, dan penunjuk arah**. Ketiganya bisa diseret di lantai atau dua baris petak trotoar depan toko, diputar, diwarnai, disalin, dan dihapus. Panel **Variasi papan** mengganti bentuk tanpa mengubah posisi. Papan mengikuti permukaan tempatnya berdiri ketika lingkungan kota ditampilkan atau disembunyikan.

Kategori **Isi toko → Dinding** berisi **jendela, lampu dinding, rak buku tempel, lukisan, dan papan nama**. Saat memasang, tombol **Depan, Kanan, Belakang, Kiri** muncul di atas area 3D. Pilih sisi lalu klik bidang bergaris; sisi tetap dikunci saat kursor bergerak. Pratinjau hijau menandakan posisi valid, merah berarti belum muat. Tombol **Auto** mengembalikan pemilihan dinding berdasarkan arah kursor. Bidang dan posisi juga bisa dipilih melalui panel lalu **Pasang di sini**. Seret aksesori yang sudah dipasang untuk menggeser, menaikkan, atau memindahkannya ke bidang dinding lain. Posisi disimpan pada kelipatan 0,1 m. Bukaan jendela ikut berpindah. Panel detail menyediakan tinggi, warna, salin, dan hapus. Tulisan papan dapat diedit, dan lampu dapat dinyalakan/dimatikan.

Jendela memiliki lima pilihan pada **Variasi jendela**: **Klasik**, **Panoramik**, **Kisi-kisi**, **Geser**, dan **Lengkung**. Pilih gaya sebelum memasang atau ketika jendela sudah dipilih. Mengganti gaya mempertahankan ukuran, warna, dan posisi; bentuk bukaan pada model Lengkung mengikuti kurvanya. Gaya ikut tersimpan, disalin, dan dipulihkan lewat undo/redo. Jendela dari desain lama tetap menggunakan gaya Klasik.

Aksesori harus muat pada bidang dinding dan tidak bertumpuk dengan aksesori lain. Ketika lantai atau tinggi dinding berubah, aksesori yang masih muat dipertahankan di tempatnya; yang terdampak dipindahkan ke bidang valid terdekat. Perubahan bentuk yang tidak menyisakan tempat untuk semua aksesori ditolak, sehingga aksesori tidak hilang. Rak tempel merupakan aksesori dinding dengan buku; pengaturan isi pajangan tersedia pada perabot lantai.

Geser area kosong untuk memutar kamera, dan gulir untuk zoom. Di ponsel, tarik objek/pegangan dengan satu jari, geser area kosong untuk memutar, dan cubit dengan dua jari untuk zoom. Tombol **3D**, **Atas**, **Depan**, reset kamera, petak, dan dinding membantu melihat susunan dari berbagai sisi.

Kontrol **Atur barang / Bangun**, alat bangun, dan petunjuk berada di panel perabot agar kanvas tetap penuh. Tombol **Tampilkan dinding** (ikon lapisan) menyembunyikan atau menampilkan tembok. Tombol **Tampilkan seluruh tembok** (ikon bata) di sebelahnya menampilkan keempat sisi lengkap dengan bukaan pintu dan jendela; klik lagi untuk kembali ke tampilan sebagian. Kedua tombol hanya mengatur tampilan, tanpa mengubah desain atau riwayat undo.

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

File desain lama tetap bisa dibuka. Tinggi dinding dan keadaan pintu menggunakan nilai awal jika belum ada dalam file; lantai lama tetap berbentuk persegi panjang sampai diedit. Bentuk baru tersimpan sebagai `floorCells`. Jangkar koordinat lama tetap dipakai agar menambah petak tidak menggeser perabot yang sudah ada. Tembok dalam disimpan sebagai `partitions`, pintunya sebagai `interiorDoors`, dan sisi pintu masuk sebagai `entrance.wall`. Aksesori disimpan sebagai `wallItems`; jendela dan papan bawaan pada desain lama menjadi aksesori yang dapat dipilih dan diedit. Ruang kosong baru tidak memiliki aksesori bawaan.

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
