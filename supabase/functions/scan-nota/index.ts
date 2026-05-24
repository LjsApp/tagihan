// Edge function: scan-nota
// Uses Google Gemini API directly (OpenAI-compatible endpoint) to OCR & parse receipt images.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

declare const Deno: any;

const SYSTEM_PROMPT = `You are an expert at reading Indonesian sales receipts (nota penjualan).
Extract structured data from the receipt image. Return ONLY valid JSON via the tool call.

Rules:
- Numbers must be plain numeric (no thousands separator, no currency symbol).
- Dates in ISO format YYYY-MM-DD. If only dd-mm-yyyy or dd/mm/yy is visible, convert it.
- "kode_nota" is usually a short uppercase prefix (e.g. BLG, INV, SJ).
- "no_nota" is the numeric portion of the receipt number.
- "full_no" combines them like "BLG-000919".
- "nama_customer" = the buyer/customer name (after "Nama" / "Kepada" / "Pelanggan").
- "total" = subtotal/total before discount. "netto" = total after discount.
- "diskon_nota.persen" = percent (0-100). "diskon_nota.nominal" = rupiah amount of discount.
- If a value is not visible, use null (for strings/dates) or 0 (for numbers).
- For items, extract every line item visible. "subtotal" = qty * harga (or as printed).
- Be tolerant of handwriting, smudges, and unusual layouts. Use your best inference.`;

const TOOL = {
  type: "function",
  function: {
    name: "extract_nota",
    description: "Extract structured data from an Indonesian sales receipt",
    parameters: {
      type: "OBJECT",
      properties: {
        kode_nota: { type: "STRING" },
        no_nota: { type: "STRING" },
        full_no: { type: "STRING" },
        tanggal: { type: "STRING", description: "ISO date YYYY-MM-DD" },
        nama_customer: { type: "STRING" },
        total: { type: "NUMBER" },
        netto: { type: "NUMBER" },
        diskon_nota: {
          type: "OBJECT",
          properties: {
            persen: { type: "NUMBER" },
            nominal: { type: "NUMBER" },
          },
          required: ["persen", "nominal"],
        },
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              kode: { type: "STRING" },
              nama: { type: "STRING" },
              qty: { type: "NUMBER" },
              satuan: { type: "STRING" },
              harga: { type: "NUMBER" },
              subtotal: { type: "NUMBER" },
            },
            required: ["nama", "qty", "harga", "subtotal"],
          },
        },
        raw_text: { type: "STRING", description: "Plain transcription of the receipt for backup" },
      },
      required: ["total", "netto", "diskon_nota", "items", "raw_text"],
    },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi di Supabase Secrets");
    }

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Native Google Gemini API
    const base64Clean = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents: [
            {
              parts: [
                { text: "Extract the receipt data. Always use the extract_nota function tool." },
                {
                  inlineData: {
                    mimeType: mimeType || "image/jpeg",
                    data: base64Clean
                  }
                }
              ]
            }
          ],
          tools: [{ functionDeclarations: [TOOL.function] }],
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: ["extract_nota"]
            }
          }
        }),
      },
    );

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(
        JSON.stringify({ error: `Gemini API Error ${aiRes.status}: ${txt}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiRes.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const functionCall = parts.find((p: any) => p.functionCall)?.functionCall;
    
    if (!functionCall || functionCall.name !== "extract_nota") {
      throw new Error("AI tidak mengembalikan struktur data yang benar");
    }
    
    const parsed = functionCall.args;

    // Normalize
    if (parsed.kode_nota && parsed.no_nota && !parsed.full_no) {
      parsed.full_no = `${parsed.kode_nota}-${parsed.no_nota}`;
    }
    if (!parsed.diskon_nota) parsed.diskon_nota = { persen: 0, nominal: 0 };
    if (!Array.isArray(parsed.items)) parsed.items = [];
    if (!parsed.netto && parsed.total) parsed.netto = parsed.total - (parsed.diskon_nota.nominal || 0);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("scan-nota error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export {};
