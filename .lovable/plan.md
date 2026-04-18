

## Rencana: Redesign Page Sisa Gaji Worker

### Tujuan
Tampilkan **semua worker** yang punya pendapatan di bulan terpilih dalam satu tabel ringkas & elegan, dengan filter worker opsional dan rincian on-demand.

### Layout Baru

**1. Header Page** — judul + deskripsi singkat (tetap).

**2. Card Filter (compact, 1 baris)**
- `MonthSelector` (Pilih Bulan, default bulan ini)
- `Select` Pilih Worker (opsional, default "Semua Worker")
- Tombol hijau **+ Tambah Pengambilan Gaji** (global, dialog berisi dropdown worker)

**3. Tiga Summary Cards** (agregat sesuai filter aktif: semua worker atau 1 worker)
- Total Pendapatan • Total Pengambilan • Sisa Saldo
- Style minimal: border-l accent, ikon kecil, angka tebal — sama seperti sekarang tapi padding sedikit dikurangi untuk feel lebih elegan.

**4. Tabel Utama "Sisa Gaji per Worker"** (default view)

| Worker | Total Pendapatan | Total Pengambilan | Sisa Saldo | Aksi |
|---|---|---|---|---|
| Adit | Rp 1.000.000 | Rp 500.000 | Rp 500.000 (badge hijau) | [Lihat Detail] |
| Bila | Rp 800.000 | Rp 0 | Rp 800.000 | [Lihat Detail] |

- Badge warna sisa: hijau (≥0), merah (<0).
- Sortable (default by Sisa Saldo desc).
- Klik **Lihat Detail** → expand row inline atau buka panel detail (lihat #5).
- Jika filter worker aktif → tabel auto-filter ke 1 worker saja.
- Empty state ramah jika tidak ada data bulan tsb.

**5. Detail Panel (Expandable Row)**
Saat user klik "Lihat Detail":
- Row expand menampilkan **2 sub-tabel side-by-side** (stack di mobile):
  - Rincian Pendapatan (Tanggal, Kode, Jobdesk, Fee)
  - Rincian Pengambilan Gaji (Tanggal, Jumlah, Catatan, Aksi Edit/Delete)
- Tombol kecil **+ Tambah Pengambilan** di header panel (auto-fill worker tsb).
- Hanya 1 row bisa expand sekaligus (clean).

**6. Dialog Tambah/Edit Pengambilan Gaji**
- Tambah field **Pilih Worker** (dropdown, sumber: worker yang punya pendapatan di bulan terpilih) — karena tombol sekarang global.
- Field lain tetap: Tanggal, Jumlah, Catatan.
- Validasi sisa saldo dihitung per worker yang dipilih.

### Sentuhan Elegan
- Tipografi: judul `text-2xl font-semibold tracking-tight`, sub-label `text-xs uppercase tracking-wide text-muted-foreground`.
- Spacing konsisten `gap-4`, card `rounded-xl` ringan.
- Hover row halus, transition smooth.
- Icon kecil di header tabel (Wallet, TrendingUp).
- Hilangkan border tebal yang berlebihan.

### File yang Diubah
| File | Aksi |
|---|---|
| `src/pages/WorkerSalaryBalancePage.tsx` | Refactor besar: hapus pembagian wajib pilih worker, tambah agregasi per worker, expandable row, update dialog dengan dropdown worker |

### Catatan Teknis
- Agregasi per worker pakai `useMemo`: group `incomes` by normalized `worker_name` di bulan terpilih, hitung total fee. Lalu join dengan agregasi `withdrawals` (group sama).
- Worker list = union dari worker yang punya pendapatan ATAU pengambilan di bulan tsb (supaya kalau ada pengambilan tanpa pendapatan tetap muncul, sisa = negatif).
- Expand state: `const [expandedWorker, setExpandedWorker] = useState<string | null>(null)`.
- Dropdown worker di dialog: sumber sama dengan filter (worker yang punya pendapatan bulan tsb).
- Realtime, RLS, validasi sisa saldo, normalisasi Title Case — tetap.

