

## Rencana: Sinkronkan Card dengan Filter Aktif di Semua Halaman

### Tujuan
Setiap **card ringkasan/total** harus mencerminkan filter yang aktif (bulan, search, kode, worker, franchise, dll). Saat **tidak ada filter aktif** (semua bulan, search kosong), card menampilkan **total bulan ini** sebagai default — sesuai perilaku saat ini.

---

### Logika Umum (diterapkan di semua halaman)

```ts
const isFilterActive =
  searchTerm.trim() !== '' ||
  (selectedMonth && selectedMonth !== 'all') ||
  /* filter lain spesifik halaman */;

const cardData = isFilterActive
  ? filteredData                               // ikut filter
  : filteredData.filter(item =>
      format(new Date(item.tanggal), 'yyyy-MM') === format(new Date(), 'yyyy-MM')
    );                                         // default: bulan ini

const cardLabel = isFilterActive
  ? (selectedMonth !== 'all'
      ? format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: id })
      : 'Hasil Filter')
  : format(new Date(), 'MMMM yyyy', { locale: id });
```

Card menampilkan: **judul + label periode/filter**, **total nominal**, dan **jumlah transaksi** sesuai `cardData`.

---

### Halaman yang Diperbaiki

| # | Halaman | Filter yang dipertimbangkan | Catatan perubahan |
|---|---------|------------------------------|-------------------|
| 1 | `ExpensesPage.tsx` | search, month | Card merah ikut `filteredData` |
| 2 | `AdminIncomePage.tsx` | search, month, code | Card biru ikut `filteredData` |
| 3 | `WorkerIncomePage.tsx` | search, month, worker | Card hijau ikut `filteredData`; hapus kondisi role yang menyembunyikan card |
| 4 | `admin/AdminRekapPage.tsx` | search, month | Card "Total Pendapatan" di header & card summary keduanya pakai `filteredData`; "Total Franchise" hitung dari `filteredData` |
| 5 | `admin/WorkerRekapPage.tsx` | search, month | `summaryData` pakai `filteredData` (saat ini abaikan search) |
| 6 | `admin/FranchiseNetIncomePage.tsx` | search, month | "Total Laba Bersih" & "Jumlah Franchise" sudah pakai `filteredData` ✓ — tambahkan label periode (mis. "Februari 2026" / "Bulan Ini") agar konsisten |

**Tidak perlu diubah**: `FinancialReportPage` (sudah berbasis bulan terpilih), `ProfitSharingPage` (form, bukan card ringkasan), `Dashboard` (tidak ada filter UI), `FranchisesPage`/`WorkersPage` (tidak ada card total).

---

### Perubahan Spesifik Singkat

**ExpensesPage / AdminIncomePage / WorkerIncomePage**
- Ganti blok IIFE card yang baca `groupedData[currentMonth]` → baca `cardData` (helper di atas).
- Update label dari hardcoded `currentMonthLabel` → `cardLabel` dinamis.

**AdminRekapPage**
- Ubah `summaryData` agar pakai `filteredData` (sekarang langsung dari `data`, abaikan search).
- Card "Total Pendapatan" header: nilainya `filteredData.reduce(...)` (sudah benar) — tambah sublabel periode aktif.
- "Total Franchise" hitung unik dari `filteredData`, bukan `data`.

**WorkerRekapPage**
- `summaryData` saat ini hanya cek `selectedMonth`, abaikan `searchTerm` → ubah agar reduce dari `filteredData`.

**FranchiseNetIncomePage**
- Tambah label periode kecil di bawah angka, mis. *"Periode: Februari 2026"* atau *"Periode: Semua Bulan (filter aktif)"*.

---

### Hasil Akhir
Saat user mengetik di search atau memilih bulan lain, **card di atas tabel langsung memperbarui** total dan jumlah transaksi sesuai data yang difilter. Saat filter dikosongkan, card kembali menampilkan **total bulan berjalan**.

