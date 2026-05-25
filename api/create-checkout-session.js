export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email non valida" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID || 'price_1Tb465L97xjKYys51Ri4Cu6B';

  if (!secretKey) {
    return res.status(500).json({ error: "Stripe non configurato" });
  }
  if (!priceId) {
    return res.status(500).json({ error: "Price ID non configurato" });
  }

  try {
    const params = new URLSearchParams({
      "payment_method_types[0]": "card",
      "mode": "subscription",
      "customer_email": email,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "success_url": `https://www.medicoora.com/?pagamento=ok&email=${encodeURIComponent(email)}`,
      "cancel_url": "https://www.medicoora.com/?pagamento=annullato",
      "locale": "it",
      "metadata[servizio]": "Abbonamento Medico Subito",
      "metadata[email_paziente]": email,
      "tax_id_collection[enabled]": "true",
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: session.error?.message || "Errore Stripe" });
    }

    return res.status(200).json({ url: session.url });

  } catch (error) {
    return res.status(500).json({ error: "Errore interno: " + error.message });
  }
}
