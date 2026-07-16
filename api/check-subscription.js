// Lightweight endpoint: checks Stripe subscription status by email only.
// Used to gate the health questionnaire BEFORE the patient fills in
// sensitive clinical data, instead of only failing at final submit time.

const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > 60000) { rateMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= 30) return true;
  entry.count++; rateMap.set(ip, entry); return false;
}

const bypassEmails = ['ferriam78@gmail.com', 'abolzon05@gmail.com', 'amprime888@gmail.com', 'bolzonaldo280@gmail.com', 'medicosubito2026@gmail.com', 'mia087595@gmail.com', 'mr0639442@gmail.com', 'prime01x2025@gmail.com', 'snoopymia570@gmail.com', 'supportomedicosubito@gmail.com', 'tittybaci744@gmail.com'];

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Troppe richieste." });

  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

  const { email } = req.body || {};
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Email non valida" });

  const emailNorm = email.trim().toLowerCase();

  if (bypassEmails.includes(emailNorm)) {
    return res.status(200).json({ subscribed: true });
  }

  try {
    const stripe = (await import("stripe")).default(process.env.STRIPE_SECRET_KEY);
    const customers = await stripe.customers.list({ email: emailNorm, limit: 1 });
    let hasActiveSub = false;
    if (customers.data.length > 0) {
      const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
      hasActiveSub = subs.data.length > 0;
    }
    return res.status(200).json({ subscribed: hasActiveSub });
  } catch (stripeErr) {
    console.error("Stripe check error:", stripeErr.message);
    // Fail open: if Stripe is unreachable, don't block the patient here —
    // the final submit endpoint still enforces the real check server-side.
    return res.status(200).json({ subscribed: null, error: "check_unavailable" });
  }
}
