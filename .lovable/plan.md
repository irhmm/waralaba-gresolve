

## Rencana: Kategorisasi Sidebar

### Pemahaman
Sidebar saat ini flat (semua menu sejajar). User ingin grouping per kategori untuk role **franchise** & **admin_keuangan**, dan grouping serupa untuk **super_admin**.

### Struktur Baru

**Role: `franchise` & `admin_keuangan`**
- **Keuangan**: Dashboard, Pengeluaran
- **Admin**: Pendapatan Admin
- **Worker**: Pendapatan Worker, Sisa Gaji Worker*, Data Worker

*Catatan: "Sisa Gaji Worker" hanya ada untuk role `franchise` (sesuai memory `worker-salary-balance`). Untuk `admin_keuangan` tidak ada item ini di kategori Worker.

**Role: `super_admin`** (kategorisasi yang masuk akal sesuai menu yang ada)
- **Keuangan**: Dashboard, Laba Bersih Franchise, Pengaturan Profit, Data Bagi Hasil Franchise
- **Franchise**: List Franchise, Add Franchise
- **Admin**: Rekap Admin Wara
- **Worker**: Rekap Worker Wara, Data Worker

**Role lain** (tetap)
- `admin_marketing`: tidak diubah (tetap flat: Pendapatan Admin, Pendapatan Worker)
- `user`: tetap flat (Pendapatan Worker)

### Perubahan Teknis di `src/components/layout/AppSidebar.tsx`

**1. Ubah Struktur Data `menuItems`**
Dari `Record<role, Item[]>` menjadi `Record<role, Group[]>`, di mana setiap Group `{ label: string, items: Item[] }`.

```ts
type MenuGroup = { label: string; items: { title; url; icon }[] };
const menuItems: Record<RoleKey, MenuGroup[]> = { ... }
```

**2. Render Multiple `SidebarGroup`**
Loop tiap group → render `SidebarGroup` dengan `SidebarGroupLabel` = nama kategori (Keuangan / Admin / Worker / Franchise) + `SidebarGroupContent` berisi menu items.

**3. Tetap Pertahankan**
- Group "Keluar" (signOut) di bawah (`mt-auto`).
- Active state via NavLink.
- `collapsible="icon"` (mini mode tetap jalan, label group tetap muncul saat expanded).
- Untuk role `admin_marketing` & `user` tetap pakai 1 group "Menu Utama" agar tidak over-engineered.

### File yang Diubah
| File | Aksi |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Refactor `menuItems` ke struktur grouped, render multiple `SidebarGroup` per kategori |

### Catatan
- Tidak ada perubahan routing.
- Tidak ada perubahan behavior login/role.
- Urutan group: Keuangan → Franchise (super admin only) → Admin → Worker.

