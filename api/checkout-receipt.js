// Send a payment receipt after Stripe redirects the buyer back to Medico Subito.
// Verify the paid Checkout Session server-side; never trust query-string payment claims.
import Stripe from "stripe";
import nodemailer from "nodemailer";

const norm = v => String(v || "").trim().toLowerCase();
const esc = v => String(v || "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);

const rateMap = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const item = rateMap.get(ip) || { n: 0, t: now };
  if (now - item.t > 60000) { rateMap.set(ip, { n: 1, t: now }); return false; }
  item.n++; rateMap.set(ip, item);
  return item.n > 15;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "Troppe richieste" });

  const sid = String(req.body?.sessionId || "");
  if (!/^cs_(live_|test_)[a-zA-Z0-9]+$/.test(sid)) {
    return res.status(400).json({ error: "Sessione di pagamento non valida" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Stripe non configurato" });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sid);
    const correctPayment = session.id === sid && session.mode === "payment" &&
      session.payment_status === "paid" && session.amount_total === 3000 &&
      session.currency === "eur" && session.metadata?.servizio === "consulto_singolo_30";
    if (!correctPayment) return res.status(402).json({ paid: false, error: "Pagamento non confermato" });

    const email = norm(session.customer_details?.email || session.customer_email ||
      session.metadata?.email_paziente);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email !== norm(session.metadata?.email_paziente)) {
      return res.status(422).json({ paid: true, receiptSent: false, error: "Email da verificare" });
    }

    if (session.metadata?.receipt_sent === "yes") {
      return res.status(200).json({ paid: true, receiptSent: true, alreadySent: true });
    }

    const receiptNumber = "MS-" + sid.replace(/[^a-zA-Z0-9]/g, "").slice(-16).toUpperCase();
    const receiptDate = new Date(session.created * 1000).toLocaleDateString("it-IT", {
      day:"2-digit", month:"2-digit", year:"numeric", timeZone:"Europe/Rome"
    });
    const receiptHtml = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>Ricevuta ${receiptNumber}</title></head>
<body style="font-family:Arial,sans-serif;color:#122c35;line-height:1.65;max-width:680px;margin:30px auto">
<h1>Medico Subito</h1><h2>Ricevuta di pagamento</h2>
<p><strong>Numero:</strong> ${receiptNumber}<br><strong>Data:</strong> ${receiptDate}</p>
<p><strong>Professionista:</strong> Dott.ssa Anna Maria Ferri<br>
Medico Chirurgo, specialista in Ginecologia e Ostetricia<br>
P.IVA IT17215181003 · Ordine dei Medici di Frosinone n. 3363<br>
Via Gaetano Marzotto 16 int. 3, 00133 Roma (RM)</p>
<p><strong>Email del pagante:</strong> ${esc(email)}</p>
<table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left;border-bottom:1px solid #ddd">Prestazione</th>
<th style="text-align:right;border-bottom:1px solid #ddd">Importo</th></tr>
<tr><td>Consulto medico scritto online (1 richiesta)</td><td style="text-align:right">30,00 €</td></tr></table>
<p style="font-size:20px"><strong>Totale pagato: 30,00 €</strong></p>
<p style="font-size:12px;color:#607480">Pagamento elettronico con Stripe. Nessuna sottoscrizione e nessun rinnovo automatico.
L'eventuale detraibilità e la documentazione fiscale definitiva dipendono dai requisiti di legge e dai dati identificativi del paziente.
Questo documento attesta il pagamento e non garantisce il rilascio di ricette o certificati.</p>
<p style="font-size:12px;color:#607480">Assistenza: supportomedicosubito@gmail.com · www.medicoora.com</p>
</body></html>`;

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(200).json({ paid: true, receiptSent: false, error: "email_unavailable" });
    }
    try {
      const transporter = nodemailer.createTransport({
        service:"gmail", auth:{ user:process.env.GMAIL_USER, pass:process.env.GMAIL_APP_PASSWORD }
      });
      await transporter.sendMail({
        from: `"Medico Subito" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Medico Subito - ricevuta pagamento ${receiptNumber}`,
        text: `Gentile paziente, il pagamento del consulto da 30,00 € è stato confermato. In allegato la ricevuta n. ${receiptNumber}. Assistenza: supportomedicosubito@gmail.com`,
        html: `<p>Gentile paziente,</p><p>abbiamo ricevuto il pagamento di <strong>30,00 €</strong> per un consulto medico scritto.</p><p>In allegato la ricevuta di pagamento n. ${receiptNumber}.</p>`,
        attachments: [{ filename:`Ricevuta_${receiptNumber}.html`, content:receiptHtml, contentType:"text/html" }]
      });
    } catch (error) {
      console.error("Checkout receipt email delivery:", error.message);
      return res.status(200).json({ paid: true, receiptSent: false, error: "email_delivery_failed" });
    }

    try {
      await stripe.checkout.sessions.update(sid, {
        metadata: { ...session.metadata, receipt_sent: "yes", receipt_sent_at: new Date().toISOString() }
      });
    } catch (error) {
      console.error("Receipt idempotency marker update failed:", error.message);
    }
    return res.status(200).json({ paid: true, receiptSent: true });
  } catch (error) {
    console.error("Checkout receipt verification:", error.message);
    return res.status(503).json({ paid: false, error: "Verifica del pagamento temporaneamente non disponibile" });
  }
}
