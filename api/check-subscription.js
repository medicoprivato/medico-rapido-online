// Payment status is checked by the server. Verification errors must block access.
import { verifyConsultAccess } from "./_verify-consult-access.js";

const limit = new Map();
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0];
  const now = Date.now(), prior = limit.get(ip);
  const entry = !prior || now - prior.start > 60000 ? { start: now, requests: 0 } : prior;
  entry.requests += 1;
  limit.set(ip, entry);
  if (entry.requests > 30) return res.status(429).json({ subscribed: false, error: "Troppe richieste" });

  try {
    const result = await verifyConsultAccess({
      email: req.body?.email,
      paymentSessionId: String(req.body?.paymentSessionId || ""),
      bearer: req.headers.authorization || "",
      unusedOnly: true
    });
    return res.status(200).json({
      subscribed: result.allowed === true,
      access: result.allowed ? result.access : undefined,
      error: result.allowed ? undefined : result.reason
    });
  } catch (error) {
    console.error("Payment verification unavailable:", error.message);
    return res.status(503).json({ subscribed: false, error: "Verifica del pagamento temporaneamente non disponibile" });
  }
}
