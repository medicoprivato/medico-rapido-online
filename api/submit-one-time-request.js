import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// A paid Stripe Checkout session is usable for exactly one medical request.
// No recurring subscription is created for a €30 consultation.
const normal = value => String(value || "").trim().toLowerCase();
const escapeHtml = value => String(value || "").replace(/[&<>"']/g, ch =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

  const { tipo, patientText, patientName, dateOfBirth, phone, clinicalData,
    aiResponse, conversazione, allegati, consenso, codiceFiscale, docType, docNumber } = req.body || {};
  const email = normal(req.body?.email);
  const paymentSessionId = String(req.body?.paymentSessionId || "");
  if (!patientName || !patientText || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !consenso) {
    return res.status(400).json({ error: "Nome, email, richiesta clinica e consenso sono obbligatori." });
  }
  if (!/^cs_(test_|live_)[a-zA-Z0-9]+$/.test(paymentSessionId)) {
    return res.status(402).json({ error: "Pagamento di €30 non trovato. Completa prima il pagamento." });
  }

  try {
    const stripe = (await import("stripe")).default(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(paymentSessionId);
    if (session.mode !== "payment" || session.payment_status !== "paid" ||
        session.amount_total !== 3000 || session.currency !== "eur" ||
        session.metadata?.servizio !== "consulto_singolo_30" ||
        normal(session.metadata?.email_paziente) !== email) {
      return res.status(402).json({ error: "Pagamento non confermato oppure email diversa da quella usata per pagare." });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // The receipt marker associates one paid Checkout Session with one recorded consultation.
    const { count, error: countError } = await supabase.from("consults")
      .select("id", { count: "exact", head: true })
      .ilike("clinical_data", `%Pagamento Stripe: ${paymentSessionId}%`);
    if (countError) throw countError;
    if (count) return res.status(402).json({ error: "Questo pagamento è già stato utilizzato. Per una nuova richiesta occorre un nuovo consulto da €30." });

    const cf = codiceFiscale ? String(codiceFiscale).trim().toUpperCase().replace(/\s+/g, "") : null;
    const clinicalNotes = [
      clinicalData,
      (!cf && docType && docNumber) ? `Documento identità: ${docType} ${String(docNumber).trim().toUpperCase()}` : "",
      `Pagamento Stripe: ${paymentSessionId}`
    ].filter(Boolean).join(" | ");
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
    const { error } = await supabase.from("consults").insert({
      tipo, patient_text: patientText, patient_name: patientName,
      date_of_birth: dateOfBirth, email, phone, clinical_data: clinicalNotes,
      ai_response: aiResponse, conversazione, allegati: allegati || [],
      consenso: true, codice_fiscale: cf, stato: "in_attesa", ip_address: ip
    });
    if (error) throw error;

    // Email delivery must not undo a successful paid consultation registration.
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
      });
      await transporter.sendMail({
        from: `Medico Subito <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: `Nuova richiesta pagata (€30): ${String(tipo || "consulto")}`,
        html: `<h2>Nuovo consulto da €30</h2><p>Paziente: ${escapeHtml(patientName)}</p><p>Email: ${escapeHtml(email)}</p><p>Tipo: ${escapeHtml(tipo)}</p><p>Richiesta: ${escapeHtml(patientText)}</p><p>Accedi alla dashboard Medico Subito per la valutazione.</p>`
      });
      await transporter.sendMail({
        from: `Medico Subito <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Medico Subito - richiesta ricevuta",
        html: `<p>Gentile ${escapeHtml(patientName)}, la tua richiesta è stata ricevuta. Un medico la valuterà e risponderà normalmente entro 24 ore.</p><p>Per le emergenze chiama il 118.</p>`
      });
    } catch (mailError) { console.error("Email delivery:", mailError.message); }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Consult payment verification or submission:", error.message);
    return res.status(503).json({ error: "Impossibile completare la richiesta ora. Il pagamento resta valido: riprova senza pagare nuovamente." });
  }
}
