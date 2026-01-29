

## Rencana: Menyederhanakan Card Total Bulanan

### Tujuan
Mengubah tampilan card total bulanan di halaman **Pengeluaran**, **Pendapatan Admin**, dan **Pendapatan Worker** dari menampilkan 6 card menjadi **1 card saja** yang menunjukkan **Total Bulan Ini** (otomatis berubah setiap ganti bulan).

---

### Perubahan yang Diperlukan

#### **1. File: `src/pages/ExpensesPage.tsx`**

**Sebelum (Line 268-290):**
```tsx
{Object.keys(groupedData).length > 0 && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Object.entries(groupedData)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([month, data]) => (
      <Card key={month} ...>
        ...
      </Card>
    ))}
  </div>
)}
```

**Sesudah:**
```tsx
{/* Card Total Bulan Ini */}
{(() => {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthLabel = format(new Date(), 'MMMM yyyy', { locale: id });
  const currentMonthData = groupedData[currentMonth];
  
  return (
    <Card className="bg-gradient-to-r from-red-50 to-white border-red-200 max-w-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">
              Total Pengeluaran - {currentMonthLabel}
            </p>
            <p className="text-2xl font-bold text-red-900">
              Rp {(currentMonthData?.total || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-red-500">
              {currentMonthData?.items?.length || 0} transaksi bulan ini
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
})()}
```

#### **2. File: `src/pages/AdminIncomePage.tsx`**

**Sebelum (Line 306-328):**
Menampilkan 6 card bulanan

**Sesudah:**
```tsx
{/* Card Total Bulan Ini */}
{(() => {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthLabel = format(new Date(), 'MMMM yyyy', { locale: id });
  const currentMonthData = groupedData[currentMonth];
  
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-white border-blue-200 max-w-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Total Pendapatan Admin - {currentMonthLabel}
            </p>
            <p className="text-2xl font-bold text-blue-900">
              Rp {(currentMonthData?.total || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-blue-500">
              {currentMonthData?.items?.length || 0} transaksi bulan ini
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
})()}
```

#### **3. File: `src/pages/WorkerIncomePage.tsx`**

**Sebelum (Line 416-443):**
Menampilkan 6 card bulanan dengan kondisi kompleks

**Sesudah:**
```tsx
{/* Card Total Bulan Ini */}
{(() => {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthLabel = format(new Date(), 'MMMM yyyy', { locale: id });
  const currentMonthData = groupedData[currentMonth];
  
  return (
    <Card className="bg-gradient-to-r from-green-50 to-white border-green-200 max-w-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600">
              Total Pendapatan Worker - {currentMonthLabel}
            </p>
            <p className="text-2xl font-bold text-green-900">
              Rp {(currentMonthData?.total || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-green-500">
              {currentMonthData?.items?.length || 0} transaksi bulan ini
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
})()}
```

---

### Import yang Diperlukan

Tambahkan `id` locale dari `date-fns` di setiap file:

```tsx
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
```

---

### Hasil Akhir

| Halaman | Sebelum | Sesudah |
|---------|---------|---------|
| Pengeluaran | 6 card (6 bulan terakhir) | 1 card (bulan ini) |
| Pendapatan Admin | 6 card (6 bulan terakhir) | 1 card (bulan ini) |
| Pendapatan Worker | 6 card (6 bulan terakhir) | 1 card (bulan ini) |

### Fitur Otomatis Update

Card akan **otomatis menampilkan bulan yang sedang berjalan**:
- Januari 2026 akan menampilkan "Total Pendapatan - Januari 2026"
- Ketika masuk Februari 2026, card akan otomatis berubah menjadi "Total Pendapatan - Februari 2026"

---

### Warna per Halaman

| Halaman | Warna |
|---------|-------|
| Pengeluaran | Merah (red) |
| Pendapatan Admin | Biru (blue) |
| Pendapatan Worker | Hijau (green) |

