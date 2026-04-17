import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // You might need a way to find the domain ID. 
    // For now, we'll list domains and take the first one, 
    // or the one matching scampagnate.com
    const listResponse = await fetch("https://api.resend.com/domains", {
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
      },
    });

    if (!listResponse.ok) {
      const errorData = await listResponse.json();
      throw new Error(errorData.message || "Failed to fetch domains");
    }

    const { data: domains } = await listResponse.json();
    
    // Find the relevant domain
    const domain = domains.find((d: any) => d.name === "scampagnate.com") || domains[0];

    if (!domain) {
      return new Response(JSON.stringify({ 
        status: "not_found", 
        message: "No domain found in Resend account." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get detailed info for the domain
    const detailResponse = await fetch(`https://api.resend.com/domains/${domain.id}`, {
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
      },
    });

    if (!detailResponse.ok) {
      const errorData = await detailResponse.json();
      throw new Error(errorData.message || "Failed to fetch domain details");
    }

    const domainDetails = await detailResponse.json();

    return new Response(JSON.stringify(domainDetails), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error fetching domain status:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
