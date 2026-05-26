const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const appsScriptUrl = Deno.env.get("APPS_SCRIPT_WEB_APP_URL");
    const rootFolderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");

    if (!appsScriptUrl) throw new Error("APPS_SCRIPT_WEB_APP_URL belum dikonfigurasi");

    // Only pass rootFolderId for upload actions, not for check
    if (!body.action || body.action === "upload") {
      body.rootFolderId = rootFolderId;
    }

    // Forward the request to Google Apps Script
    const res = await fetch(appsScriptUrl, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "text/plain", // avoid CORS preflight in Apps Script
      },
    });

    // Apps Script redirects, fetch follows automatically.
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("drive-upload error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export {};
