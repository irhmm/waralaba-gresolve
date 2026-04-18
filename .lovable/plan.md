

## Masalah

Dropdown filter "Worker" (di `WorkerIncomePage`) dan "Code" (di `AdminIncomePage`) saat ini menampilkan **semua** nama/kode dari seluruh data — tidak peduli bulan yang dipilih. Akibatnya, user melihat nama worker / kode admin yang **tidak punya transaksi** di bulan terpilih, padahal hasilnya akan kosong saat dipilih.

## Perbaikan

Filter daftar opsi dropdown agar **hanya menampilkan nama worker / kode admin yang punya pendapatan** di bulan yang sedang dipilih. Jika `selectedMonth === 'all'`, tampilkan semua (perilaku saat ini).

### File 1: `src/pages/WorkerIncomePage.tsx`

Ubah `uniqueWorkerNames` (line 254–270) agar bersumber dari data yang sudah difilter berdasarkan bulan saja (bukan worker, bukan search — supaya user tetap bisa ganti pilihan worker tanpa list mengecil saat memilih satu worker):

```ts
const uniqueWorkerNames = useMemo(() => {
  const namesMap = new Map<string, string>();
  
  // Hanya pertimbangkan transaksi pada bulan yang dipilih
  const sourceData = (selectedMonth && selectedMonth !== 'all')
    ? workerIncomes.filter(item => 
        format(new Date(item.tanggal), 'yyyy-MM') === selectedMonth
      )
    : workerIncomes;
  
  sourceData
    .filter(item => item.worker_name)
    .forEach(item => {
      const normalizedName = item.worker_name.toLowerCase().trim();
      if (!namesMap.has(normalizedName)) {
        namesMap.set(normalizedName, item.worker_name.trim());
      }
    });
  
  return Array.from(namesMap.values()).sort((a, b) => 
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}, [workerIncomes, selectedMonth]);
```

**Bonus**: jika `selectedWorker` yang sedang aktif tidak ada dalam list baru (karena ganti bulan), reset `selectedWorker` ke `'all'` agar tidak ada filter "hantu":

```ts
useEffect(() => {
  if (selectedWorker !== 'all' && !uniqueWorkerNames.some(
    n => n.toLowerCase().trim() === selectedWorker.toLowerCase().trim()
  )) {
    setSelectedWorker('all');
  }
}, [uniqueWorkerNames, selectedWorker]);
```

### File 2: `src/pages/AdminIncomePage.tsx`

Ubah `availableCodes` (line 290–293) agar bersumber dari data yang difilter bulan:

```ts
const availableCodes = useMemo(() => {
  const sourceData = (selectedMonth && selectedMonth !== 'all')
    ? adminIncomes.filter(item => 
        format(new Date(item.tanggal), 'yyyy-MM') === selectedMonth
      )
    : adminIncomes;
  
  const codes = sourceData.map(item => item.code);
  return [...new Set(codes)].sort();
}, [adminIncomes, selectedMonth]);
```

Tambah auto-reset `codeFilter` jika kode terpilih tidak ada di list baru:

```ts
useEffect(() => {
  if (codeFilter !== 'all' && !availableCodes.includes(codeFilter)) {
    setCodeFilter('all');
  }
}, [availableCodes, codeFilter]);
```

## Hasil
- Pilih bulan **Januari** → dropdown worker/code hanya menampilkan worker/kode yang **punya transaksi di Januari**.
- Pilih **Semua Bulan** → dropdown menampilkan semua nama (perilaku lama).
- Jika pilihan worker/code aktif lalu user ganti bulan dan worker/code itu tidak ada di bulan baru → filter otomatis reset ke "Semua".

