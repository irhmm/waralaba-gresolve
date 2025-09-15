// B. SERVER-SIDE ENDPOINT: POST /api/admin/assign-role
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
    console.log('Assign-role function called');
    
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

    console.log('Super admin access verified');

    // Parse request body
    const { email, role, franchise_id } = await req.json();
    
    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'Email and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Assigning role:', { email, role, franchise_id });

    // Find target user by email using service role
    const { data: userData, error: findUserError } = await supabaseServiceRole.auth.admin.listUsers();
    
    if (findUserError) {
      console.error('Error listing users:', findUserError);
      return new Response(JSON.stringify({ error: 'Failed to find user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUser = userData.users.find(u => u.email === email);
    if (!targetUser) {
      console.error('Target user not found:', email);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Target user found:', targetUser.id);

    // Get current role for audit logging
    const { data: currentRoleData } = await supabaseServiceRole
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUser.id)
      .single();

    // Safe upsert using CTE pattern (A5 from requirements)
    const { data: upsertData, error: upsertError } = await supabaseServiceRole.rpc('exec_sql', {
      query: `
        WITH up AS (
          UPDATE public.user_roles
          SET role = $2, franchise_id = $3, created_at = NOW()
          WHERE user_id = $1
          RETURNING *
        )
        INSERT INTO public.user_roles (user_id, role, franchise_id, created_at)
        SELECT $1, $2, $3, NOW()
        WHERE NOT EXISTS (SELECT 1 FROM up)
        RETURNING *;
      `,
      params: [targetUser.id, role, franchise_id]
    });

    // Alternative direct approach since rpc might not be available
    const { data: roleData, error: roleUpsertError } = await supabaseServiceRole
      .from('user_roles')
      .upsert(
        {
          user_id: targetUser.id,
          role: role,
          franchise_id: franchise_id,
          created_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id',
          ignoreDuplicates: false
        }
      )
      .select()
      .single();

    if (roleUpsertError) {
      console.error('Error upserting role:', roleUpsertError);
      return new Response(JSON.stringify({ error: 'Failed to assign role', details: roleUpsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Role assigned successfully:', roleData);

    // D2: Log action to audit table
    const { error: auditError } = await supabaseServiceRole
      .from('role_changes')
      .insert({
        actor_id: user.id,
        target_user_id: targetUser.id,
        old_role: currentRoleData?.role || null,
        new_role: role,
        franchise_id: franchise_id
      });

    if (auditError) {
      console.warn('Failed to log audit trail:', auditError);
      // Don't fail the request for audit logging issues
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Role assigned successfully',
      data: {
        user_id: targetUser.id,
        email: email,
        role: role,
        franchise_id: franchise_id
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in assign-role function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});