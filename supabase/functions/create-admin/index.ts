import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const encoder = new TextEncoder();
const data = encoder.encode('');

async function hashPassword(password: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password + 'quiz-salt-2024'));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const passwordHash = await hashPassword('admin123');

    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'admin@quiz.ua')
      .single();

    if (existingAdmin) {
      return new Response(JSON.stringify({
        message: 'Admin already exists',
        admin: {
          email: 'admin@quiz.ua',
          surname: 'Адміністратор',
          name: 'Головний',
          patronymic: 'Системи',
          role: 'admin'
        },
        password: 'admin123'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const { error } = await supabase
      .from('users')
      .insert({
        surname: 'Адміністратор',
        name: 'Головний',
        patronymic: 'Системи',
        email: 'admin@quiz.ua',
        password_hash: passwordHash,
        role: 'admin'
      });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      message: 'Admin created successfully',
      admin: {
        email: 'admin@quiz.ua',
        surname: 'Адміністратор',
        name: 'Головний',
        patronymic: 'Системи',
        role: 'admin'
      },
      password: 'admin123'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
