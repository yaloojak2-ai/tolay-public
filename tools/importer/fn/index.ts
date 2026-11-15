// Edge function "product-import": admin-only. Reads an official product page and copies approved images into storage.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { extract, importImages } from "./core.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: isAdmin, error: aerr } = await user.rpc("am_admin");
  if (aerr || isAdmin !== true) return out({ error: "للأدمن فقط" }, 403);
  // deno-lint-ignore no-explicit-any
  let body: any; try { body = await req.json(); } catch { return out({ error: "طلب غير صالح" }, 400); }
  try {
    if (body.action === "extract") return out(await extract(String(body.url || "")));
    if (body.action === "import") {
      const pid = Number(body.product_id); if (!Number.isInteger(pid) || pid <= 0) return out({ error: "رقم المنتج غلط" }, 400);
      const urls = [...new Set((body.urls || []).map(String))] as string[];
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      return out({ ok: true, results: await importImages(admin, `import/${pid}`, urls) });
    }
    return out({ error: "action غير معروف" }, 400);
  } catch (e) { return out({ ok: false, error: e instanceof Error ? e.message : String(e) }, 200); }
});
