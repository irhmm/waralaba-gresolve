

## Rencana: Halaman Pendapatan Bersih Franchise per Bulan

### Tujuan
Membuat halaman baru yang menampilkan **pendapatan bersih (laba bersih)** setiap franchise per bulan untuk role `super_admin`.

**Rumus:** `Laba Bersih = Pendapatan Admin - Pengeluaran - Bagi Hasil Owner`

---

### Perubahan yang Diperlukan

#### 1. File Baru: `src/pages/admin/FranchiseNetIncomePage.tsx`

Halaman ini akan mengikuti pola yang sama seperti `AdminRekapPage.tsx`, dengan fitur:

- **Summary Cards**: Total laba bersih seluruh franchise (bulan yang dipilih), jumlah franchise
- **Filter**: Search franchise + MonthSelector  
- **Tabel**: Menampilkan per franchise per bulan:

| Kolom | Keterangan |
|-------|-----------|
| Franchise | Nama + kode franchise |
| Bulan | Label bulan (misal "Februari 2026") |
| Pendapatan Admin | Total admin_income bulan itu |
| Pengeluaran | Total expenses bulan itu |
| Bagi Hasil Owner | Dari franchise_profit_sharing (share_nominal) |
| Laba Bersih | Admin - Expenses - Bagi Hasil |

- **Mobile View**: Card layout untuk layar kecil
- **Export Excel**: Tombol export data
- **Pagination**: DataTablePagination
- **Realtime**: useRealtimeData untuk update otomatis

**Sumber Data:**
- `admin_income` - join `franchises` untuk nama franchise
- `expenses` - per franchise per bulan
- `franchise_profit_sharing` - data bagi hasil per franchise per bulan

#### 2. Update: `src/App.tsx`

Tambahkan route baru:
```
/admin/franchise-net-income -> FranchiseNetIncomePage
```

#### 3. Update: `src/components/layout/AppSidebar.tsx`

Tambahkan menu baru di section `super_admin` setelah "Data Bagi Hasil Franchise":
```
{
  title: 'Laba Bersih Franchise',
  url: '/admin/franchise-net-income',
  icon: BarChart3,
}
```

---

### Detail Teknis

**Logika Pengambilan Data:**

1. Fetch semua `admin_income` dengan join ke `franchises` 
2. Fetch semua `expenses` dengan join ke `franchises`
3. Fetch semua `franchise_profit_sharing` 
4. Group by `franchise_id` + `month_year`
5. Hitung: `labaBersih = adminIncome - expenses - shareNominal`

**Warna Laba Bersih:**
- Hijau jika positif (untung)
- Merah jika negatif (rugi)

**Akses:** Hanya `super_admin` yang bisa mengakses halaman ini (sesuai RLS policy pada tabel terkait).

