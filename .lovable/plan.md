

## Rencana: Page "Sisa Gaji Worker"

### Tujuan
Page baru untuk tracking sisa gaji setiap worker per bulan: **Sisa = Total Pendapatan Worker (bulan X) − Total Pengambilan Gaji (bulan X)**. Reset tiap bulan, no carry-over.

### Akses
- Hanya role **`franchise`** (sesuai jawaban user).
- Sidebar: tambah menu hanya di array `franchise` di `AppSidebar.tsx`.
- Route: `/worker-salary-balance` dengan `RouteGuard`.

---

### 1. Database — Table baru `worker_salary_withdrawals`

Migration:
```sql
CREATE TABLE public.worker_salary_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL,
  worker_name text NOT NULL,           -- plain text, konsisten dgn worker_income
  jumlah numeric NOT NULL CHECK (jumlah > 0),
  catatan text,
  tanggal timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.worker_salary_withdrawals ENABLE ROW LEVEL SECURITY;
```

**RLS policies** (mirror pola `worker_income`, tapi terbatas role `franchise` + super_admin):
- `SELECT`: super_admin OR (franchise_id = get_user_franchise_id())
- `INSERT/UPDATE/DELETE`: super_admin OR (franchise_id = get_user_franchise_id() AND user role = `franchise` AND created_by = auth.uid())

Realtime enabled untuk auto-refresh.

---

### 2. Halaman `src/pages/WorkerSalaryBalancePage.tsx`

**Layout** (sesuai screenshot referensi):

**a. Card Filter Data**
- Dropdown **Pilih Worker** (wajib pilih, default placeholder "Pilih worker..."). Sumber: `worker_income.worker_name` distinct yang punya transaksi di bulan terpilih (pakai pola dropdown dinamis yang sudah ada).
- **MonthSelector** Pilih Bulan (default: bulan ini).
- Tombol hijau **+ Tambah Pengambilan Gaji** → buka Dialog form.

**b. Tiga Summary Cards** (tampil setelah worker dipilih):
- 🟢 **Total Pendapatan** — sum `fee` dari `worker_income` (worker terpilih, bulan terpilih)
- 🔵 **Total Pengambilan** — sum `jumlah` dari `worker_salary_withdrawals`
- 🟢 **Sisa Saldo** — `Total Pendapatan − Total Pengambilan`

**c. Dua Table side-by-side** (stack di mobile):
- **Rincian Pendapatan** — kolom: Tanggal, Kode (badge), Jobdesk, Fee — read-only
- **Rincian Pengambilan Gaji** — kolom: Tanggal, Jumlah, Catatan, Aksi (Edit/Delete) — dengan pagination

**d. Dialog Form Pengambilan Gaji** — fields:
- Tanggal (date picker, default today)
- Worker (auto-fill dari worker yang sedang dipilih, read-only)
- Jumlah (number, min 1, validasi tidak boleh > Sisa Saldo dengan toast warning)
- Catatan (textarea, optional, max 500 char)
- Validasi pakai **zod schema**

---

### 3. Filter Worker dropdown — exact match
Mengikuti pola yang sudah diterapkan: pakai `useMemo` derive dari `worker_income` filtered by `selectedMonth`, exact match `worker_name.trim().toLowerCase()`.

---

### 4. File yang Diubah/Dibuat

| File | Aksi |
|---|---|
| `supabase/migrations/...` | Buat table + RLS + realtime |
| `src/pages/WorkerSalaryBalancePage.tsx` | **BARU** |
| `src/App.tsx` | Tambah route `/worker-salary-balance` |
| `src/components/layout/AppSidebar.tsx` | Tambah menu di array `franchise` saja |

### Catatan Teknis
- Pakai `useRealtimeData` untuk subscribe `worker_salary_withdrawals` & `worker_income`.
- Format mata uang pakai helper existing `formatCurrency`.
- Pagination pakai `DataTablePagination`.
- Worker name normalize ke Title Case saat insert (konsisten memori `case-insensitive-worker-names`).
- Setelah delete/edit pengambilan, summary cards auto-update via realtime.

