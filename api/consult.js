// External AI processing paused pending verification of clinical data processing arrangements.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });
  return res.status(503).json({ error: "Elaborazione AI temporaneamente non disponibile. La valutazione medica scritta resta disponibile." });
}
