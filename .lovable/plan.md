

## Rencana: Tooltip Info Rumus di Dashboard (Super Admin & Franchise)

### Tujuan
Menambahkan **icon info (i)** dengan **tooltip rumus singkat** di setiap card statistik dan kolom tabel ringkasan bulanan di **Dashboard**, agar user paham asal-usul angka tanpa menutupi tampilan.

---

### Komponen Baru
**File**: `src/components/ui/info-tooltip.tsx`

Komponen kecil reusable: `<InfoTooltip text="..." />` — render `Info` icon dari lucide (size 14, `text-muted-foreground/70`) yang dibungkus shadcn `Tooltip`. Pada mobile, otomatis pakai click-to-open via `onClick` (Radix Tooltip handles touch).

```tsx
<TooltipProvider delayDuration={150}>
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="inline-flex">
        <Info className="h-3.5 w-3.5 opacity-70" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs">{text}</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

### Lokasi Penempatan di `src/pages/Dashboard.tsx`

#### A. Card Stats — Super Admin (6 card)
Tambah `<InfoTooltip>` di samping `CardTitle`:

| Card | Rumus tooltip |
|------|---------------|
| Total Franchise | "Jumlah franchise terdaftar di sistem" |
| Total Pendapatan Worker | "Σ fee semua transaksi worker_income (seluruh franchise, sepanjang waktu)" |
| Total Pendapatan Admin | "Σ nominal admin_income (seluruh franchise, sepanjang waktu)" |
| Total Worker | "Jumlah worker terdaftar (seluruh franchise)" |
| Total Bagi Hasil (Bulan Ini) | "Σ share_nominal franchise_profit_sharing untuk bulan berjalan" |
| Total Pengeluaran (Bulan Ini) | "Σ nominal expenses bulan berjalan (seluruh franchise)" |

#### B. Card Stats — Franchise / Admin Keuangan / Marketing
| Card | Rumus tooltip |
|------|---------------|
| Pendapatan Worker | "Σ fee worker_income franchise ini bulan berjalan" |
| Pendapatan Admin | "Σ nominal admin_income franchise ini bulan berjalan" |
| Pengeluaran | "Σ nominal expenses franchise ini bulan berjalan" |
| Bagi Hasil Owner | "Total Pendapatan (Admin + Worker) × % admin bagi hasil" |
| Laba Bersih | "Pendapatan Admin − Pengeluaran − Bagi Hasil Owner" |
| Total Worker (marketing) | "Jumlah worker aktif franchise ini" |

#### C. Tabel Ringkasan Bulanan — Header Kolom
Tambah `<InfoTooltip>` di sebelah teks kolom (inline, `ml-1`):

| Kolom | Tooltip |
|-------|---------|
| Pendapatan Admin | "Σ admin_income.nominal pada bulan tsb" |
| Pendapatan Worker | "Σ worker_income.fee pada bulan tsb" |
| Pengeluaran | "Σ expenses.nominal pada bulan tsb" |
| Total Bagi Hasil (super admin) | "Σ share_nominal seluruh franchise pada bulan tsb" |
| Bagi Hasil Owner (franchise) | "(Pendapatan Admin + Worker) × % admin" |
| Omset (franchise) | "(Pendapatan Admin + Worker − Pengeluaran) − Bagi Hasil" |
| Laba Bersih (franchise) | "Pendapatan Admin − Pengeluaran − Bagi Hasil" |

---

### Catatan Desain
- Icon: `Info` lucide, `h-3.5 w-3.5`, opacity 70%, warna `currentColor` agar menyatu dengan warna title card.
- Tooltip: max-width `xs` (320px), text-xs, posisi `top` (auto-flip Radix), delay 150ms.
- **Tidak menambah tinggi card** — icon inline di samping judul.
- Tooltip layer pakai z-index default Radix (di atas semua), tidak menutupi UI lain.
- Konten singkat (1 baris rumus, sesuai jawaban user "Hanya rumus singkat").

### File yang Diubah
1. **Buat**: `src/components/ui/info-tooltip.tsx`
2. **Edit**: `src/pages/Dashboard.tsx` — tambah `<InfoTooltip>` di 6 card super admin, 5–6 card franchise/marketing, dan 7 header kolom tabel.

