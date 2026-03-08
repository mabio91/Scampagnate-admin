import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const users = [
      { email: "john.anderson@techcorp.com", password: "Jx9#mK2pL!", first_name: "John", last_name: "Anderson" },
      { email: "sarah.mitchell@globalfinance.com", password: "Sm4$vN8qR@", first_name: "Sarah", last_name: "Mitchell" },
      { email: "david.chen@innovategroup.com", password: "Dc7&wP3tY#", first_name: "David", last_name: "Chen" },
      { email: "emily.roberts@nexusolutions.com", password: "Er2!bQ6uZ$", first_name: "Emily", last_name: "Roberts" },
      { email: "michael.torres@apexventures.com", password: "Mt5@cF1sW%", first_name: "Michael", last_name: "Torres" },
      { email: "lisa.nguyen@brightwave.com", password: "Ln8#dH4xA^", first_name: "Lisa", last_name: "Nguyen" },
      { email: "james.williams@corelogistics.com", password: "Jw3$eG9yB&", first_name: "James", last_name: "Williams" },
      { email: "amanda.foster@primetech.com", password: "Af6!fJ7zC*", first_name: "Amanda", last_name: "Foster" },
      { email: "robert.kim@strategyplus.com", password: "Rk1@gM5nD!", first_name: "Robert", last_name: "Kim" },
      { email: "jennifer.patel@horizondigital.com", password: "Jp4#hL2oE@", first_name: "Jennifer", last_name: "Patel" },
    ];

    const results = [];
    for (const u of users) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { first_name: u.first_name, last_name: u.last_name, phone: "" },
      });
      if (error) {
        results.push({ email: u.email, error: error.message });
      } else {
        results.push({ email: u.email, success: true, user_id: data.user.id });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
