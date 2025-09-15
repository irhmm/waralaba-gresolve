# Role Management System - Setup & Testing Guide

## H. Dokumentasi Singkat

Sistem manajemen role telah berhasil diimplementasikan dengan komponen berikut:

### Komponen yang Dibuat

1. **Database Migration** - Memastikan enum `app_role`, tabel `user_roles`, constraint, dan trigger sinkronisasi
2. **Edge Functions** (Server-side dengan Service Role Key):
   - `assign-role`: Menetapkan role kepada user berdasarkan email
   - `sync-roles`: Sinkronisasi user_roles → profiles.role 
3. **UI Components**:
   - `AssignRoleModal`: Modal untuk assign role oleh super_admin
   - `SyncRolesButton`: Tombol untuk sinkronisasi roles
4. **AppLayout Fix**: Mengatasi masalah "Akun Belum Disetup" dengan pesan yang informatif

### Role System Architecture

- **1 User = 1 Role** (dengan unique constraint)
- **Roles Available**: super_admin, franchise, admin_keuangan, admin_marketing, user
- **Franchise Scope**: Role franchise/admin_keuangan/admin_marketing membutuhkan franchise_id
- **Audit Trail**: Semua perubahan role dicatat di tabel `role_changes`

---

## G. Tests & Validation - Step by Step

### Test 1: Super Admin Assign Role

**Prerequisites:**
- User sudah login sebagai super_admin
- Target user sudah sign up/register di aplikasi

**Steps:**
1. Login sebagai user yang sudah memiliki role super_admin
2. Navigasi ke `/admin/franchises` 
3. Klik tombol **"Assign Role"** di bagian kanan atas
4. Isi form:
   - **Email**: masukkan email user yang sudah terdaftar
   - **Role**: pilih salah satu (super_admin, franchise, admin_keuangan, admin_marketing, user)
   - **Franchise**: pilih franchise jika role membutuhkan scope (franchise/admin_keuangan/admin_marketing)
5. Klik **"Assign Role"**
6. Verifikasi toast success muncul dengan pesan role berhasil ditetapkan

**Expected Result:**
- Toast success: "Role [role] berhasil ditetapkan untuk [email]. User harus login ulang agar role aktif."
- Data tersimpan di tabel `user_roles`
- Audit log tersimpan di tabel `role_changes`

### Test 2: Verifikasi Role Assignment

**Steps:**
1. Cek database `user_roles` table:
   ```sql
   SELECT * FROM public.user_roles WHERE user_id = '[target_user_id]';
   ```
2. Target user logout dan login kembali
3. Target user seharusnya bisa mengakses halaman sesuai role-nya

**Expected Result:**
- User tidak lagi melihat "Akun Belum Disetup"
- Menu sidebar muncul sesuai dengan role yang ditetapkan
- User dapat mengakses fitur sesuai permissions role-nya

### Test 3: Sync Roles

**Steps:**
1. Login sebagai super_admin
2. Navigasi ke `/admin/franchises`
3. Klik tombol **"Sync Roles"**
4. Verifikasi toast muncul dengan informasi jumlah user yang di-sync

**Expected Result:**
- Toast: "Sinkronisasi berhasil: [N] user diperbarui"
- Jika tabel `profiles` ada dan memiliki kolom `role`, data akan ter-sync
- Jika tidak ada tabel profiles, pesan "No profiles table found - sync not needed"

### Test 4: Edge Function Error Handling

**Test Invalid User:**
1. Coba assign role dengan email yang tidak terdaftar
2. Expected: Error "User not found"

**Test Non-Super Admin Access:**
1. Login sebagai user dengan role selain super_admin
2. Coba akses Edge Functions secara langsung
3. Expected: Error "Access denied: super_admin role required"

**Test Missing Fields:**
1. Coba assign role tanpa mengisi email atau role
2. Expected: Error "Email and role are required"

---

## Environment Variables Required

Edge Functions membutuhkan environment variables berikut di Supabase:

```bash
SUPABASE_URL=https://lpmwayktddwhnkegvffk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=[secret-service-role-key]
```

**CRITICAL SECURITY NOTE:**
- `SUPABASE_SERVICE_ROLE_KEY` TIDAK BOLEH diexpose ke client-side code
- Edge Functions berjalan server-side sehingga aman menggunakan Service Role Key
- Client hanya memanggil Edge Functions melalui `supabase.functions.invoke()`

---

## Manual SQL Migration (jika diperlukan)

Jika migration tidak berjalan otomatis, jalankan SQL berikut di Supabase SQL Editor:

```sql
-- 1. Ensure enum app_role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'super_admin','franchise','admin_keuangan','admin_marketing','user'
    );
  END IF;
END $$;

-- 2. Ensure user_roles table exists
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  franchise_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 3. Add unique constraint
ALTER TABLE public.user_roles
  ADD CONSTRAINT IF NOT EXISTS user_roles_user_id_unique UNIQUE (user_id);

-- 4. Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies (if not exists)
-- [See migration file for complete RLS policies]

-- 6. Create audit table
CREATE TABLE IF NOT EXISTS public.role_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  old_role public.app_role,
  new_role public.app_role NOT NULL,
  franchise_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;
```

---

## Troubleshooting

### Issue: "Akun Belum Disetup" masih muncul setelah assign role

**Solution:**
1. User harus logout dan login kembali agar session di-refresh
2. Verifikasi role tersimpan di database:
   ```sql
   SELECT * FROM user_roles WHERE user_id = '[user_id]';
   ```
3. Pastikan `AuthContext.fetchUserRole()` dipanggil ulang setelah login
4. Coba klik tombol "Coba Ambil Ulang Role" di halaman "Akun Belum Disetup"

### Verifikasi Database Role Assignment

**Cek apakah user sudah ada di database:**
```sql
SELECT id, email, created_at FROM auth.users WHERE email = 'user@example.com';
```

**Cek apakah role sudah di-assign:**
```sql
SELECT ur.role, ur.franchise_id, ur.created_at
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'user@example.com';
```

**Cek semua user dan role mereka:**
```sql
SELECT 
  u.email,
  ur.role,
  ur.franchise_id,
  ur.created_at as role_assigned_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id  
ORDER BY u.created_at DESC;
```

### Manual Role Assignment untuk Super Admin Pertama

**Jika user ada tapi role belum ada, assign role:**
```sql
INSERT INTO user_roles (user_id, role) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'user@example.com'),
  'super_admin'
);
```

**Atau gunakan UPSERT untuk update jika sudah ada:**
```sql
INSERT INTO user_roles (user_id, role) 
VALUES (
  (SELECT id FROM auth.users WHERE email = 'your-admin@example.com'),
  'super_admin'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
```

**Test RPC function directly:**
```sql
SELECT * FROM get_user_role_rpc((SELECT id FROM auth.users WHERE email = 'user@example.com'));
```

### Issue: Edge Function timeout atau error 500

**Solution:**
1. Cek Edge Function logs di Supabase Dashboard → Functions → [function-name] → Logs
2. Pastikan `SUPABASE_SERVICE_ROLE_KEY` sudah dikonfigurasi
3. Verifikasi user yang memanggil memiliki role super_admin

### Issue: RLS Policy Error

**Solution:**
1. Pastikan user sudah login (tidak anonymous)
2. Verifikasi RLS policies sudah dibuat dengan benar
3. Test dengan Service Role Key jika diperlukan untuk debugging

---

## Security Considerations

1. **Service Role Key**: Hanya digunakan di server-side (Edge Functions)
2. **RLS Policies**: Menggunakan security definer functions untuk menghindari recursive policy
3. **Audit Trail**: Semua perubahan role dicatat untuk compliance
4. **Access Control**: Hanya super_admin yang bisa assign roles
5. **Session Management**: User harus re-login setelah role assignment

---

## Next Steps

1. **Password Protection**: Enable di Supabase Auth Settings (warning dari linter)
2. **Email Verification**: Configure jika diperlukan untuk production
3. **Bulk Role Assignment**: Implementasi untuk assign multiple users
4. **Role History**: UI untuk melihat riwayat perubahan role
5. **User Search**: Autocomplete search untuk email user yang sudah terdaftar

---

## API Documentation

### Edge Function: assign-role

**Endpoint:** `POST /functions/v1/assign-role`

**Headers:**
```
Authorization: Bearer [user-jwt-token]
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "role": "franchise",
  "franchise_id": "uuid-or-null"
}
```

**Response Success:**
```json
{
  "success": true,
  "message": "Role assigned successfully",
  "data": {
    "user_id": "uuid",
    "email": "user@example.com", 
    "role": "franchise",
    "franchise_id": "uuid-or-null"
  }
}
```

### Edge Function: sync-roles

**Endpoint:** `POST /functions/v1/sync-roles`

**Headers:**
```
Authorization: Bearer [user-jwt-token]
Content-Type: application/json
```

**Body:**
```json
{}
```

**Response Success:**
```json
{
  "success": true,
  "message": "Role sync completed: 5 users synced",
  "synced_count": 5,
  "errors": []
}
```

---

**End of Documentation**