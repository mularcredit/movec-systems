-- Fix infinite recursion in profiles RLS policy
-- Drop ALL existing policies on profiles that cause the loop
DO $$ 
DECLARE r RECORD; 
BEGIN 
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP 
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP; 
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Simple, non-recursive policy: each user can only see/update their own row
-- auth.uid() is a function, NOT a subquery on profiles — so no recursion
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow service role (backend) to insert profiles without RLS blocking
CREATE POLICY "profiles_service_role_all"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Also fix RLS on services and persons tables so authenticated users can read them
-- Drop existing policies first
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename IN ('services', 'persons') AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, (SELECT tablename FROM pg_policies WHERE policyname = r.policyname AND schemaname = 'public' LIMIT 1));
  END LOOP;
END $$;

-- Services: authenticated users can read all services (tenant filter happens in middleware)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_authenticated_read"
  ON public.services FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "services_authenticated_write"
  ON public.services FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Persons: authenticated users can read
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "persons_authenticated_read"
  ON public.persons FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "persons_authenticated_write"
  ON public.persons FOR ALL
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
