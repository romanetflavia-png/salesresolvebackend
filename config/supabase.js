/**
 * Supabase Configuration
 * Database connection and client setup
 * Temporarily disabled until environment variables are configured
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Check if Supabase is configured
if (!supabaseUrl || !supabaseServiceKey) {
  console.log('⚠️  Supabase not configured. Using mock data for now.');
  console.log('📝 To enable Supabase, configure: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  
  // Return mock clients
  module.exports = {
    supabase: {
      from: () => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null })
      })
    },
    supabaseAnon: null,
    supabaseUrl: null,
    supabaseAnonKey: null
  };
} else {
  console.log('✅ Supabase configured successfully');
  console.log('🔗 Supabase URL:', supabaseUrl);
  
  // Create Supabase client with service role key (for server-side operations)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Create Supabase client with anon key (for client-side operations)
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

  module.exports = {
    supabase,
    supabaseAnon,
    supabaseUrl,
    supabaseAnonKey
  };
}
