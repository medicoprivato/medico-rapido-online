// Create an individual, non-recurring €30 medical-consultation checkout.
export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Email non valida" });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(503).json({ error: "Stripe non configurato" });

  try {
    const params = new URLSearchParams({
      "payment_method_types[0]": "card",
      "mode": "payment",
      "customer_creation": "always",
      "customer_email": email,
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": "3000",
      "line_items[0][price_data][product_data][name]": "Medico Subito - consulto medico scritto",
      "line_items[0][price_data][product_data][description]": "Una valutazione medica scritta individuale, senza abbonamento.",
      "line_items[0][quantity]": "1",
      "success_url": "https://www.medicoora.com/?pagamento=ok&session_id={CHECKOUT_SESSION_ID}",
      "cancel_url": "https://www.medicoora.com/?pagamento=annullato",
      "locale": "it",
      "metadata[servizio]": "consulto_singolo_30",
      "metadata[email_paziente]": email,
      "tax_id_collection[enabled]": "true"
    });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const session = await response.json();
    if (!response.ok || !session.url) {
      console.error("Stripe checkout:", session.error?.message || response.status);
      return res.status(502).json({ error: "Pagamento non disponibile, riprova." });
    }
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout:", error.message);
    return res.status(500).json({ error: "Errore del sistema di pagamento." });
  }
}
