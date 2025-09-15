// D1. SYNC & RECOVERY: Sync roles -> profiles
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Sync-roles function called');
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role
    const supabaseServiceRole = createClient(supabaseUrl, serviceRoleKey);
    
    // Get auth token from request to verify caller
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user token to verify caller identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify caller is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Invalid user token:', userError);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Caller verified:', user.id);

    // Verify caller is super_admin using service role client
    const { data: callerRoles, error: roleError } = await supabaseServiceRole
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin');

    if (roleError || !callerRoles || callerRoles.length === 0) {
      console.error('Caller is not super_admin:', roleError);
      return new Response(JSON.stringify({ error: 'Access denied: super_admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Super admin access verified, starting sync process');

    // Check if profiles table exists and has role column
    const { data: tablesCheck } = await supabaseServiceRole
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'profiles');

    const { data: columnsCheck } = await supabaseServiceRole
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'profiles')
      .eq('column_name', 'role');

    if (!tablesCheck || tablesCheck.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No profiles table found - sync not needed',
        synced_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!columnsCheck || columnsCheck.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Profiles table has no role column - sync not needed',
        synced_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Profiles table with role column found, proceeding with sync');

    // Get all user roles
    const { data: userRoles, error: userRolesError } = await supabaseServiceRole
      .from('user_roles')
      .select('user_id, role');

    if (userRolesError) {
      console.error('Error fetching user roles:', userRolesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user roles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${userRoles?.length || 0} user roles to sync`);

    // D1: Sync each role to profiles table
    let syncedCount = 0;
    let errors = [];

    if (userRoles && userRoles.length > 0) {
      for (const userRole of userRoles) {
        try {
          const { error: updateError } = await supabaseServiceRole
            .from('profiles')
            .update({ role: userRole.role })
            .eq('id', userRole.user_id);

          if (updateError) {
            console.error(`Failed to sync role for user ${userRole.user_id}:`, updateError);
            errors.push(`User ${userRole.user_id}: ${updateError.message}`);
          } else {
            syncedCount++;
            console.log(`Synced role ${userRole.role} for user ${userRole.user_id}`);
          }
        } catch (error) {
          console.error(`Exception syncing user ${userRole.user_id}:`, error);
          errors.push(`User ${userRole.user_id}: ${error.message}`);
        }
      }
    }

    console.log(`Sync completed: ${syncedCount} successful, ${errors.length} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Role sync completed: ${syncedCount} users synced`,
      synced_count: syncedCount,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-roles function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});