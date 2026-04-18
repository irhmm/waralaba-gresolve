

## Masalah

Saat user mencari/select worker bernama "Bila", nama "Nabila" ikut muncul dan terhitung karena filter saat ini pakai `.includes()` (substring match) — bukan exact match.

## Investigasi yang Diperlukan

Cek halaman yang punya filter/search worker name:
- `WorkerIncomePage.tsx` — search & worker filter
- `admin/WorkerRekapPage.tsx` — search & worker filter
- `admin/AllWorkersPage.tsx` — search global

## Perbaikan

**Aturan**:
- **Search bar (text input)**: tetap pakai `includes()` — wajar untuk pencarian bebas (contoh: ketik "bil" muncul "Bila" & "Nabila"). Ini behavior search yang benar.
- **Worker name filter (combobox/select)**: ubah jadi **exact match** (`===`) — saat user pilih "Bila" dari dropdown, hanya transaksi worker bernama "Bila" yang tampil & terhitung di card.

**Normalisasi**: bandingkan setelah `.trim().toLowerCase()` agar konsisten dengan `toTitleCase` (kasus "Bila" vs "bila " tetap match).

### File yang Diubah

1. **`src/pages/WorkerIncomePage.tsx`**
   - Pada `filteredData`: ubah filter worker selection dari `includes` → exact match (`item.worker_name?.trim().toLowerCase() === selectedWorker.trim().toLowerCase()`).
   - Pastikan dropdown options unik berdasarkan nama exact (sudah Title Case).

2. **`src/pages/admin/WorkerRekapPage.tsx`**
   - Sama: filter worker selection pakai exact match.

3. **`src/pages/admin/AllWorkersPage.tsx`**
   - Search bar tetap `includes` (search bebas) — **tidak diubah**.
   - Tapi tambahkan opsi: jika nantinya ada worker filter dropdown, pakai exact.

### Hasil
- Pilih "Bila" di dropdown → hanya "Bila" yang tampil & terhitung di card total.
- Ketik "bil" di search box → tetap menampilkan "Bila" & "Nabila" (search behavior normal).

