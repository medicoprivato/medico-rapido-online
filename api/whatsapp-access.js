// Reveal WhatsApp contact details only after a verified paid consultation.
// Registration alone never grants WhatsApp access.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const norm = value => String(value || "").trim().toLowerCase();
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const checkoutIdPattern = /^cs_(test_|live_)[a-zA-Z0-9]+$/;
const rateMap = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const old = rateMap.get(ip);
  const item = (!old || now - old.start > 60000) ? { start: now, count: 0 } : old;
  item.count += 1;
  rateMap.set(ip, item);
  return item.count > 20;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0];
  if (rateLimited(ip)) return res.status(429).json({ error: "Troppe richieste" });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Verifica temporaneamente non disponibile" });

  const sessionId = String(req.body?.paymentSessionId || "").trim();
  const bearer = String(req.headers.authorization || "");
  const authToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  let paid = false;
  let reference = "";

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // Single €30 purchase: Stripe, not localStorage or user input, is the authority.
    if (checkoutIdPattern.test(sessionId)) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const email = norm(session.customer_details?.email || session.customer_email);
        paid = session.id === sessionId &&
          session.mode === "payment" &&
          session.payment_status === "paid" &&
          session.amount_total === 3000 &&
          session.currency === "eur" &&
          session.metadata?.servizio === "consulto_singolo_30" &&
          isEmail(email) &&
          norm(session.metadata?.email_paziente) === email;
        if (paid) reference = sessionId.slice(-10);
      } catch (error) {
        // Invalid/unknown Checkout Sessions must never unlock the contact.
        paid = false;
      }
    }

    // Existing annual customers: require authenticated account AND an active,
    // previously paid subscription. Merely entering an email is not enough.
    if (!paid && authToken && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data, error } = await supabase.auth.getUser(authToken);
      const email = norm(data?.user?.email);
      if (!error && isEmail(email)) {
        const customers = await stripe.customers.list({ email, limit: 10 });
        for (const customer of customers.data) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id, status: "active", limit: 10
          });
          for (const sub of subscriptions.data) {
            if (!sub.latest_invoice) continue;
            const invoice = typeof sub.latest_invoice === "string"
              ? await stripe.invoices.retrieve(sub.latest_invoice)
              : sub.latest_invoice;
            if (invoice.status === "paid" && invoice.amount_paid > 0) {
              paid = true;
              reference = "abbonamento attivo";
              break;
            }
          }
          if (paid) break;
        }
      }
    }

    if (!paid) return res.status(403).json({ allowed: false, error: "WhatsApp disponibile solo dopo il pagamento del consulto." });

    const phone = "393403882191";
    const message = "Buongiorno, ho acquistato un consulto su MedicoOra.com. Riferimento pagamento: " +
      reference + ". Desidero comunicare in merito al consulto acquistato (una richiesta per pagamento).";
    return res.status(200).json({
      allowed: true,
      url: "https://wa.me/" + phone + "?text=" + encodeURIComponent(message)
    });
  } catch (error) {
    console.error("WhatsApp access verification error:", error.message);
    return res.status(503).json({ allowed: false, error: "Verifica temporaneamente non disponibile" });
  }
}
