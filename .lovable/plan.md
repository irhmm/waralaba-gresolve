

## Rencana: Menambahkan Card "Laba Bersih" untuk Pemilik Franchise

### Tujuan
Menambahkan card baru pada Dashboard untuk role `franchise` yang menampilkan **Laba Bersih** dengan perhitungan:

```
Laba Bersih = Total Pendapatan Admin - Pengeluaran - Bagi Hasil Owner
```

---

### Analisis Data yang Tersedia

Data yang dibutuhkan sudah tersedia di state `stats`:

| Data | Variable | Sumber |
|------|----------|--------|
| Total Pendapatan Admin (Bulan Ini) | `stats.thisMonthAdminIncome` | Query ke `admin_income` |
| Pengeluaran (Bulan Ini) | `stats.thisMonthExpenses` | Query ke `expenses` |
| Bagi Hasil Owner | `stats.adminProfitShare` | Calculated dari `revenue * admin_percentage` |

---

### Perubahan yang Diperlukan

#### **File: `src/pages/Dashboard.tsx`**

**1. Tambahkan Card Laba Bersih di Section Franchise Cards (sekitar line 891-906)**

Tambahkan card baru tepat setelah card "Bagi Hasil Owner" untuk role `franchise`:

```tsx
{userRole?.role === 'franchise' && (
  <>
    {/* Card Bagi Hasil Owner yang sudah ada */}
    <Card className="card-hover bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
      ...
    </Card>

    {/* NEW: Card Laba Bersih */}
    <Card className="card-hover bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-teal-800">Laba Bersih</CardTitle>
        <div className="p-2 bg-teal-500 text-white rounded-full">
          <BarChart3 className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-teal-900">
          {formatCurrency(
            (stats.thisMonthAdminIncome || 0) - 
            (stats.thisMonthExpenses || 0) - 
            (stats.adminProfitShare || 0)
          )}
        </div>
        <p className="text-xs text-teal-600">
          Pendapatan Admin - Pengeluaran - Bagi Hasil ({stats.profitSharingPercentage || 20}%)
        </p>
      </CardContent>
    </Card>
  </>
)}
```

**2. Update Grid Layout (line 748)**

Ubah dari `lg:grid-cols-3` menjadi `lg:grid-cols-4` agar card baru bisa muat dengan baik untuk franchise owner yang akan memiliki 5 card:

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
```

---

### Hasil Akhir

#### Dashboard untuk Role `franchise` akan menampilkan:

| No | Card | Nilai |
|----|------|-------|
| 1 | Pendapatan Worker | Bulan ini + Total akumulasi |
| 2 | Pendapatan Admin | Bulan ini + Total akumulasi |
| 3 | Pengeluaran | Bulan ini + Total akumulasi |
| 4 | Bagi Hasil Owner | Persentase dari pendapatan |
| 5 | **Laba Bersih (BARU)** | Admin - Expenses - Bagi Hasil |

---

### Contoh Perhitungan

Jika dalam bulan ini:
- Pendapatan Admin: Rp 10.000.000
- Pengeluaran: Rp 2.000.000
- Bagi Hasil Owner (20%): Rp 2.000.000

Maka:
- **Laba Bersih = 10.000.000 - 2.000.000 - 2.000.000 = Rp 6.000.000**

---

### Catatan Penting

Card akan menggunakan warna **teal** untuk membedakannya dari card lainnya dan memberikan kesan positif untuk informasi profit/laba.

