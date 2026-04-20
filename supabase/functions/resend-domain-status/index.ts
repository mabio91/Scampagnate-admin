import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function findDomain(resendApiKey: string) {
  const listResponse = await fetch("https://api.resend.com/domains", {
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
    },
  });

  if (!listResponse.ok) {
    const errorData = await listResponse.json();
    throw new Error(errorData.message || "Failed to fetch domains");
  }

  const { data: domains } = await listResponse.json();
  return domains.find((domain: any) => domain.name === "scampagnate.com") || domains[0] || null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      throw new Error("Not authenticated");
    }

    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");

    if (!roleCheck?.length) {
      throw new Error("Not authorized");
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body?.action || "status";

    const domain = await findDomain(resendApiKey);
    if (!domain) {
      return new Response(
        JSON.stringify({
          status: "not_found",
          message: "No domain found in Resend account.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "verify") {
      const verifyResponse = await fetch(`https://api.resend.com/domains/${domain.id}/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
        },
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.message || "Failed to trigger domain verification");
      }
    }

    const detailResponse = await fetch(`https://api.resend.com/domains/${domain.id}`, {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
      },
    });

    if (!detailResponse.ok) {
      const errorData = await detailResponse.json();
      throw new Error(errorData.message || "Failed to fetch domain details");
    }

    const domainDetails = await detailResponse.json();

    return new Response(
      JSON.stringify({
        ...domainDetails,
        verification_requested: action === "verify",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error fetching domain status:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
