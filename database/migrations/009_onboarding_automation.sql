-- =============================================================================
-- Migration 009: Onboarding Automation & Tenant Partitioning
-- This script ensures every new signup gets their own isolated organization
-- and "un-pools" existing users who are stuck in the default Base Tenant.
-- =============================================================================

-- 1. Create Onboarding Function
-- This function runs every time a new user is created in Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID;
    org_name TEXT;
BEGIN
    -- Resolve organization name from metadata (provided during Auth.tsx signup)
    org_name := COALESCE(new.raw_user_meta_data->>'full_name', 'ISP Organization');
    
    -- STEP A: Create a brand new, unique Tenant (Organization)
    INSERT INTO public.tenants (name, owner_user_id)
    VALUES (org_name || ' (Private Tenant)', new.id)
    RETURNING id INTO new_tenant_id;

    -- STEP B: Create the public Profile and link it to the NEW tenant
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'System Admin'),
        new_tenant_id,
        'super_admin' -- The first user of a tenant is the owner/admin
    );

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    -- Fallback: ensure the user creation doesn't fail, but log the error
    RAISE WARNING 'Onboarding failed for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_onboarding();

-- 3. Partition Existing Users (One-Time Cleanup)
-- This moves every existing user currently in the 'Base Tenant' 
-- into their own private, unique tenant.
DO $$
DECLARE
    row RECORD;
    new_tid UUID;
BEGIN
    -- Find profiles associated with the Base Tenant (id suffix ...001)
    FOR row IN 
        SELECT id, COALESCE(full_name, 'ISP User') as display_name FROM public.profiles 
        WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    LOOP
        -- Create a fresh unique tenant for this user
        INSERT INTO public.tenants (name, owner_user_id)
        VALUES (row.display_name || ' Organization', row.id)
        RETURNING id INTO new_tid;

        -- Update the user's profile to point to their NEW tenant
        UPDATE public.profiles SET tenant_id = new_tid WHERE id = row.id;

        -- MOVE ALL THEIR DATA (Optional / Safety First)
        -- We won't automatically move routers/customers in this script because 
        -- multiple users might be sharing the Base Tenant, and a bulk move 
        -- could result in one ISP "stealing" data from the other.
        --
        -- If you want to move specific routers, run: 
        -- UPDATE routers SET tenant_id = 'NEW_TID' WHERE name = 'ROUTER_NAME';
    END LOOP;
END $$;
