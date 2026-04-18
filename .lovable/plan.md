

## Rencana: Tombol "Tambah Pengambilan Gaji" Selalu Aktif

### Pemahaman
Saat ini tombol "+ Tambah Pengambilan Gaji" disabled jika belum pilih worker. User ingin tombol selalu bisa di-klik. Worker dipilih di dalam dialog (dropdown sudah ada di form, sesuai foto).

### Perubahan di `WorkerSalaryBalancePage.tsx`

**1. Aktifkan Tombol Global**
- Hapus kondisi `addDisabled` yang bergantung pada `selectedWorker`.
- Tombol hanya disabled saat dialog terbuka (default behavior) — kalau tidak, selalu enabled.
- Hapus tooltip/hint "pilih worker dulu".

**2. Dialog Buka Tanpa Pre-Selected Worker**
- Saat tombol di-klik tanpa `selectedWorker`, dialog terbuka dengan field Worker kosong (placeholder "Pilih worker...").
- Saat ada `selectedWorker`, auto-fill ke worker tsb (tetap bisa diganti).
- Tanggal default = hari ini (atau tanggal 1 bulan terpilih) — tetap.

**3. Validasi Saldo Pindah ke Submit**
Karena worker baru ditentukan di dalam dialog:
- Cek `getSisaForWorker(workerName) <= 0` saat **submit**, bukan saat buka dialog.
- Jika worker yang dipilih di dialog punya sisa 0/negatif → toast error "Worker ini tidak punya saldo tersisa di bulan ini" + return (jangan close).
- Validasi `projectedSisa < 0` (jumlah melebihi sisa) tetap.

**4. Sumber Dropdown Worker di Dialog**
- Tetap pakai worker yang punya pendapatan di bulan terpilih.
- Jika kosong (tidak ada worker dengan pendapatan bulan tsb) → tampilkan empty state di dropdown "Belum ada worker dengan pendapatan di bulan ini".

**5. UX Tambahan**
- Tombol Simpan di dialog disabled jika field Worker / Jumlah / Tanggal kosong (sesuai foto: tombol biru muda saat belum lengkap).

### File yang Diubah
| File | Aksi |
|---|---|
| `src/pages/WorkerSalaryBalancePage.tsx` | Hapus disable button berbasis selectedWorker, pindah validasi saldo ke submit, dialog buka tanpa worker pre-selected |

### Catatan Teknis
- `openCreateDialog()` tidak lagi cek `sisaSaldo`. Reset form: `worker = selectedWorker || ''`, `tanggal = today`, `jumlah = ''`, `catatan = ''`.
- `handleSubmit` tambah guard awal: jika `!form.worker_name` → toast "Pilih worker dulu" + return.
- Bulan terpilih di dialog mengikuti `selectedMonth` filter (validasi sisa berbasis bulan tsb).

