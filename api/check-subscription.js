// Checks access before asking the patient to complete the medical questionnaire.
// New payments: one paid Stripe Checkout Session grants exactly one consultation.
// Historical annual subscribers retain access under their existing agreement.
import { createClient } from "@supabase/supabase-js";

const bypassEmails = ['ferriam78@gmail.com', 'abolzon05@gmail.com', 'amprime888@gmail.com', 'bolzonaldo280@gmail.com', 'medicosubito2026@gmail.com', 'mia087595@gmail.com', 'mr0639442@gmail.com', 'prime01x2025@gmail.com', 'snoopymia570@gmail.com', 'supportomedicosubito@gmail.com', 'tittybaci744@gmail.com'];

const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > 60000) { rateMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= 30) return true;
  entry.count++; rateMap.set(ip, entry); return false;
}
const normal = s => String(s || "").trim().toLowerCase();

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Troppe richieste." });
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

  const email = normal(req.body?.email);
  const paymentSessionId = String(req.body?.paymentSessionId || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Email non valida" });
  if (bypassEmails.includes(email)) return res.status(200).json({ subscribed: true, access: "staff" });

  try {
    const stripe = (await import("stripe")).default(process.env.STRIPE_SECRET_KEY);
    // A paid session cannot be reused: look for the receipt marker in prior consults.
    if (/^cs_(test_|live_)[a-zA-Z0-9]+$/.test(paymentSessionId)) {
      const session = await stripe.checkout.sessions.retrieve(paymentSessionId);
      if (session.mode === "payment" && session.payment_status === "paid" &&
          session.amount_total === 3000 && session.currency === "eur" &&
          session.metadata?.servizio === "consulto_singolo_30" &&
          normal(session.metadata?.email_paziente) === email) {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { count, error } = await supabase.from("consults")
          .select("id", { count: "exact", head: true })
          .ilike("clinical_data", `%Pagamento Stripe: ${paymentSessionId}%`);
        if (error) throw error;
        if (!count) return res.status(200).json({ subscribed: true, access: "single" });
      }
    }
    // Existing annual subscriptions are honored until their own expiry.
    const customers = await stripe.customers.list({ email, limit: 10 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "active", limit: 1 });
      if (subs.data.length > 0) return res.status(200).json({ subscribed: true, access: "legacy_annual" });
    }
    return res.status(200).json({ subscribed: false });
  } catch (error) {
    console.error("Access check error:", error.message);
    return res.status(200).json({ subscribed: null, error: "check_unavailable" });
  }
}
