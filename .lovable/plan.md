

## Rencana: Samakan Tampilan dengan Screenshot

### Pemahaman
User ingin balik ke tampilan **single-worker focused** (sesuai screenshot), bukan tabel agregat multi-worker. Layout persis seperti foto:
- Title: **"Rekap Gaji Worker"**
- 1 Filter Card: Pilih Worker + Pilih Bulan + tombol hijau "+ Tambah Pengambilan Gaji"
- 3 Summary Cards full-color (hijau muda / biru muda / hijau muda)
- 2 Tabel side-by-side: **Rincian Pendapatan** & **Rincian Pengambilan Gaji**

### Perubahan di `WorkerSalaryBalancePage.tsx`

**1. Title** → ubah dari "Sisa Gaji Worker" jadi **"Rekap Gaji Worker"**, hapus subtitle.

**2. Filter Card** (samakan dengan foto)
- Header kecil dengan ikon funnel + teks "Filter Data"
- Grid 2 kolom (Pilih Worker, Pilih Bulan) + tombol hijau di kanan
- Dropdown worker: placeholder "Pilih worker..." (default unselected, **bukan** "Semua Worker")
- Sumber dropdown worker: worker yang punya pendapatan di bulan terpilih
- Tombol "+ Tambah Pengambilan Gaji" disabled jika belum pilih worker

**3. Summary Cards** (3 kartu solid color seperti foto)
- Total Pendapatan: bg `bg-emerald-50`, text `text-emerald-700`, ikon TrendingUp
- Total Pengambilan: bg `bg-blue-50`, text `text-blue-700`, ikon ClipboardList
- Sisa Saldo: bg `bg-emerald-50`, text `text-emerald-700`, ikon Calculator
- Hilangkan border-l accent, ganti ke full background tint
- Hanya tampil jika worker sudah dipilih (atau tampil dengan nilai 0 sebelum pilih)

**4. Dua Tabel Side-by-side** (grid `md:grid-cols-2 gap-4`)
- **Rincian Pendapatan**: Tanggal, Kode (badge), Jobdesk, Fee — read-only. Header kanan: badge kecil "X data"
- **Rincian Pengambilan Gaji**: Tanggal, Jumlah, Catatan, Aksi (Edit/Delete icon buttons)
- Hilangkan tombol "+ Tambah Pengambilan" yang ada di header panel detail
- Empty state ramah jika belum pilih worker / tidak ada data

**5. Hapus Fitur Tabel Agregat & Expandable Row**
- Hapus tabel "Sisa Gaji per Worker"
- Hapus state `expandedKey`
- Hapus tombol Tambah per row (memang tidak ada di refactor terakhir, dipastikan)

**6. Validasi: Tidak Bisa Withdraw Jika Saldo = 0**
Tambah cek di `handleSubmit` dan `openCreateDialog`:
- Jika `getSisaForWorker(workerName) <= 0` (dan bukan editing) → toast error "Worker ini tidak punya saldo tersisa di bulan ini" + return
- Tombol "+ Tambah Pengambilan Gaji" disable juga ketika worker terpilih tapi `sisaSaldo <= 0`

**7. Dialog Tambah/Edit**
- Dropdown worker tetap (auto-fill ke worker yang sedang dipilih, masih bisa diganti dari list)
- Validasi sisa tetap; tambahan: blok jika sisa untuk worker terpilih = 0

### File yang Diubah
| File | Aksi |
|---|---|
| `src/pages/WorkerSalaryBalancePage.tsx` | Refactor besar: balik ke single-worker view sesuai screenshot, hapus tabel agregat & expandable row, samakan styling summary cards, tambah blok withdraw saat saldo 0 |

### Catatan Teknis
- Worker dropdown source = `useMemo` dari worker yang punya pendapatan di bulan terpilih (exact match per nama ter-normalize).
- Reset `selectedWorker` ke `''` saat ganti bulan jika worker tidak ada di bulan baru.
- Realtime, RLS, normalisasi Title Case — tetap.

