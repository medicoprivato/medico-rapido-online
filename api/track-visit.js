import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");

  if (req.method === "POST") {
    try {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
      const page = req.body?.page || "/";
      await supabase.from("page_views").insert({ page, ip_address: ip });
      return res.status(200).json({ ok: true });
    } catch (e) {
      // Non blocca mai l'esperienza utente in caso di errore
      return res.status(200).json({ ok: false });
    }
  }

  if (req.method === "GET") {
    const auth = req.headers.authorization;
    const DOC_PASSWORD = process.env.DOC_PASSWORD || "Msub!2026#Frn3363Xq";
    const isPublic = req.query.public === "1";

    if (!isPublic && auth !== `Bearer ${DOC_PASSWORD}`) {
      return res.status(401).json({ error: "Non autorizzato" });
    }
    try {
      const { count, error } = await supabase
        .from("page_views")
        .select("*", { count: "exact", head: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ totalViews: count || 0 });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
