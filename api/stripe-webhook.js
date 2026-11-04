// Stripe webhook: confirm paid checkouts and email a payment receipt.
// The original Stripe event must be verified before any receipt is generated.
import Stripe from "stripe";
import nodemailer from "nodemailer";

const escapeHtml = value => String(value || "").replace(/[&<>"']/g, ch =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !signingSecret) {
    console.error("Stripe webhook missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return res.status(503).json({ error: "Webhook non configurato" });
  }

  let event;
  try {
    const stripe = new Stripe(secretKey);
    event = stripe.webhooks.constructEvent(await readRawBody(req), req.headers["stripe-signature"], signingSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).json({ error: "Firma Stripe non valida" });
  }

  if (event.type !== "checkout.session.completed") return res.status(200).json({ received: true });
  const session = event.data.object;
  // Never send a receipt for an unpaid or unverified checkout.
  if (session.payment_status !== "paid" || !Number.isInteger(session.amount_total) ||
      !session.currency || !session.id) {
    return res.status(200).json({ received: true, skipped: "not_paid" });
  }

  const isSingle = session.mode === "payment" &&
    session.metadata?.servizio === "consulto_singolo_30" &&
    session.currency.toLowerCase() === "eur" && session.amount_total === 3000;
  const isLegacy = session.mode === "subscription";
  if (!isSingle && !isLegacy) return res.status(200).json({ received: true, skipped: "unknown_product" });

  const email = String(session.customer_details?.email || session.customer_email ||
    session.metadata?.email_paziente || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Stripe webhook: no customer email on paid session", session.id);
    return res.status(500).json({ error: "Email non disponibile" });
  }

  const amount = (session.amount_total / 100).toFixed(2).replace(".", ",");
  const currency = session.currency.toUpperCase();
  const purchaseType = isSingle ? "Consulto medico scritto (una richiesta)" : "Abbonamento preesistente";
  const receiptNumber = "MS-" + session.id.replace(/[^a-zA-Z0-9]/g, "").slice(-16).toUpperCase();
  const receiptDate = new Date((event.created || Math.floor(Date.now()/1000)) * 1000).toLocaleDateString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome"
  });
  const safeEmail = escapeHtml(email);
  const receiptHtml = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><title>Ricevuta ${receiptNumber}</title>
<style>body{font-family:Arial,sans-serif;color:#172334;max-width:720px;margin:36px auto;line-height:1.6}
h1{color:#0D4F5C}table{width:100%;border-collapse:collapse;margin:22px 0}
th,td{border-bottom:1px solid #ddd;text-align:left;padding:10px}.total{font-size:20px;font-weight:bold}
.small{font-size:12px;color:#596576}</style></head><body>
<h1>Medico Subito</h1><h2>Ricevuta di pagamento</h2>
<p>Numero: <strong>${receiptNumber}</strong><br>Data: ${receiptDate}</p>
<p><strong>Professionista:</strong> Dott.ssa Anna Maria Ferri<br>
Medico Chirurgo, specialista in Ginecologia e Ostetricia<br>
P. IVA IT17215181003 · Ordine dei Medici di Frosinone n. 3363<br>
Via Gaetano Marzotto 16 int. 3, 00133 Roma (RM)</p>
<p><strong>Email del pagante:</strong> ${safeEmail}</p>
<table><tr><th>Descrizione</th><th>Importo</th></tr>
<tr><td>${purchaseType}</td><td>${amount} ${currency}</td></tr></table>
<p class="total">Totale pagato: ${amount} ${currency}</p>
<p class="small">Pagamento tracciato con Stripe. Operazione senza IVA nel regime forfettario, ove applicabile.
La documentazione fiscale definitiva e l'eventuale detraibilità dipendono dai dati del paziente e dalla normativa vigente.
Questo documento non garantisce l'emissione di ricette o certificati.</p>
<p class="small">Assistenza: supportomedicosubito@gmail.com · www.medicoora.com</p>
</body></html>`;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("Receipt email SMTP not configured");
    return res.status(503).json({ error: "Invio ricevuta non configurato" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    await transporter.sendMail({
      from: `"Medico Subito" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Medico Subito - ricevuta pagamento n. ${receiptNumber}`,
      text: `Gentile paziente, il pagamento ${purchaseType} di ${amount} ${currency} è stato ricevuto. In allegato la ricevuta n. ${receiptNumber}. Per assistenza: supportomedicosubito@gmail.com`,
      html: `<p>Gentile paziente,</p><p>abbiamo ricevuto il pagamento per <strong>${purchaseType}</strong> di <strong>${amount} ${currency}</strong>.</p><p>In allegato la ricevuta di pagamento n. ${receiptNumber}.</p><p>Per assistenza: supportomedicosubito@gmail.com</p>`,
      attachments: [{ filename: `Ricevuta_${receiptNumber}.html`, content: receiptHtml, contentType: "text/html" }]
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook: receipt delivery failed:", error.message);
    // Let Stripe retry if the receipt could not be sent.
    return res.status(500).json({ error: "Invio ricevuta non riuscito" });
  }
}

export const config = { api: { bodyParser: false } };
