-- A1: Ensure enum app_role exists and has required values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM (
      'super_admin','franchise','admin_keuangan','admin_marketing','user'
    );
  END IF;
END $$;

-- A1b: Add enum values safely if any are missing
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.app_role ADD VALUE 'franchise';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.app_role ADD VALUE 'admin_keuangan';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.app_role ADD VALUE 'admin_marketing';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.app_role ADD VALUE 'user';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- A2: Ensure user_roles table exists with required columns
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  franchise_id uuid,
  created_at timestamptz DEFAULT now()
);

-- A2b: Add missing columns if table already existed (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='id'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN user_id uuid NOT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='role'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN role public.app_role NOT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='franchise_id'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN franchise_id uuid;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='user_roles' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- A3: Unique constraint model: 1 user = 1 role (default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_unique' 
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- A4: Trigger to sync user_roles -> profiles.role (only if profiles table exists and has role column)
CREATE OR REPLACE FUNCTION public.sync_user_role_to_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='profiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='profiles' AND column_name='role'
  ) THEN
    UPDATE public.profiles
    SET role = NEW.role
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='profiles'
  ) THEN
    DROP TRIGGER IF EXISTS trg_sync_role_on_user_roles ON public.user_roles;
    CREATE TRIGGER trg_sync_role_on_user_roles
    AFTER INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_profiles();
  END IF;
END $$;

-- D2: Audit table role_changes (optional but useful)
CREATE TABLE IF NOT EXISTS public.role_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  old_role public.app_role,
  new_role public.app_role NOT NULL,
  franchise_id uuid,
  created_at timestamptz DEFAULT now()
);
