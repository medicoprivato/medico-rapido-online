import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DOC_PASSWORD = process.env.DOC_PASSWORD || "medico2025";
const FALLBACK_PWD = "medico2025";

const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > 60000) { rateMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= 10) return true;
  entry.count++; rateMap.set(ip, entry); return false;
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
}

async function sendEmail(to, subject, html, attachments) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    const mail = { from: `Medico Subito <${process.env.GMAIL_USER}>`, to, subject, html };
    if (attachments) mail.attachments = attachments;
    await transporter.sendMail(mail);
    return true;
  } catch (e) { console.error("Email error:", e.message); return false; }
}

function emailMedico(patientName, tipo, email, phone, dateOfBirth, patientText, clinicalData, codiceFiscale) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px"><div style="background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto"><div style="background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px"><h2 style="margin:0">🩺 Nuova richiesta: ${tipo||"consulto"}</h2></div><p><strong>Paziente:</strong> ${patientName}</p><p><strong>CF:</strong> ${codiceFiscale||"—"}</p><p><strong>Nato/a:</strong> ${dateOfBirth||"—"}</p><p><strong>Email:</strong> ${email}</p><p><strong>Tel:</strong> ${phone||"—"}</p><p><strong>Dati clinici:</strong> ${clinicalData||"—"}</p><p><strong>Richiesta:</strong><br>${patientText}</p><a href="https://www.medicoora.com/#s-doc-login" style="display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">Apri dashboard →</a></div></body></html>`;
}

export default async function handler(req, res) {
  setSecurityHeaders(res);
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Troppe richieste." });

  if (req.method === "GET") {
    const auth = req.headers.authorization;
    const tokenParam = req.query.token;
    const pazToken = req.query.paztoken || req.headers["x-paz-token"];
    const emailFilter = req.query.email;

    const isDocAuth = auth === `Bearer ${DOC_PASSWORD}` || tokenParam === DOC_PASSWORD ||
                      auth === `Bearer ${FALLBACK_PWD}` || tokenParam === FALLBACK_PWD;

    let isPazAuth = false;
    if (!isDocAuth && pazToken && emailFilter) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(pazToken);
        if (!error && user && user.email.toLowerCase() === emailFilter.toLowerCase()) isPazAuth = true;
      } catch(e) {}
    }

    if (!isDocAuth && !isPazAuth) return res.status(401).json({ error: "Non autorizzato" });

    let query = supabase.from("consults").select("*").order("created_at", { ascending: false });
    if (emailFilter) query = query.ilike("email", emailFilter.trim());
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const { tipo, patientText, patientName, dateOfBirth, email, phone, clinicalData,
            aiResponse, conversazione, allegati, consenso, codiceFiscale } = req.body;

    if (!patientName || !email) return res.status(400).json({ error: "Nome e email obbligatori" });
    if (!consenso) return res.status(400).json({ error: "Consenso obbligatorio" });

    // Verifica abbonamento Stripe attivo
    const emailNormCheck = email.trim().toLowerCase();
    const bypassEmails = ['ferriam78@gmail.com', 'info@medicoora.com', 'contatti@medicoora.com'];
    if (!bypassEmails.includes(emailNormCheck)) {
      try {
        const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
        const customers = await stripe.customers.list({ email: emailNormCheck, limit: 1 });
        let hasActiveSub = false;
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: 'active', limit: 1 });
          hasActiveSub = subs.data.length > 0;
        }
        if (!hasActiveSub) {
          return res.status(402).json({ error: "Abbonamento non attivo. Abbonati su medicoora.com per ricevere la risposta medica." });
        }
      } catch(stripeErr) {
        console.error('Stripe check error:', stripeErr.message);
      }
    }

        // Verifica limite 5 richieste al mese per CF
    const emailNorm = email.trim().toLowerCase();
    if (codiceFiscale) {
      const inizioMese = new Date();
      inizioMese.setDate(1); inizioMese.setHours(0,0,0,0);
      const { count } = await supabase.from("consults")
        .select("*", { count: "exact", head: true })
        .eq("codice_fiscale", codiceFiscale.toUpperCase())
        .gte("created_at", inizioMese.toISOString());
      if (count >= 5) {
        return res.status(429).json({ error: "Hai raggiunto il limite di 5 richieste mensili per questo codice fiscale. Il limite si rinnova il primo del mese." });
      }
    }
    const { error } = await supabase.from("consults").insert({
      tipo, patient_text: patientText, patient_name: patientName, date_of_birth: dateOfBirth,
      email: emailNorm, phone, clinical_data: clinicalData, ai_response: aiResponse,
      conversazione, allegati: allegati || [], consenso: true, codice_fiscale: codiceFiscale,
      stato: "in_attesa", ip_address: ip
    });
    if (error) return res.status(500).json({ error: error.message });

    await sendEmail("ferriam78@gmail.com",
      `🩺 Nuova richiesta: ${tipo||"consulto"} — ${patientName}`,
      emailMedico(patientName, tipo, emailNorm, phone, dateOfBirth, patientText, clinicalData, codiceFiscale));

    await sendEmail(emailNorm, "Medico Subito — Richiesta ricevuta",
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px"><div style="background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto"><div style="background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:16px"><h2 style="margin:0">🩺 Richiesta ricevuta</h2></div><p>Gentile <strong>${patientName}</strong>, la tua richiesta è stata ricevuta. Il medico risponderà il prima possibile, 7 giorni su 7.</p><p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:13px">⚠️ In urgenza chiama il <strong>118</strong>.</p></div></body></html>`);

    return res.status(200).json({ ok: true });
  }

  if (req.method === "PUT") {
    const auth = req.headers.authorization;
    const isDocAuth = auth === `Bearer ${DOC_PASSWORD}` || auth === `Bearer ${FALLBACK_PWD}`;
    if (!isDocAuth) return res.status(401).json({ error: "Non autorizzato" });

    const { id, risposta_medico, stato, pdfBase64, nomeFile } = req.body;
    if (!id || !risposta_medico) return res.status(400).json({ error: "ID e risposta obbligatori" });

    const { data: consult } = await supabase.from("consults").select("*").eq("id", id).single();
    const { error } = await supabase.from("consults").update({
      risposta_medico, stato: stato || "risposto", risposto_at: new Date().toISOString()
    }).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });

    if (consult?.email) {
      const oggi = new Date().toLocaleDateString("it-IT", {day:"2-digit",month:"2-digit",year:"numeric"}).replace(/\//g,"-");
      const nomeFile = `Prescrizione_MedicoSubito_${(consult.patient_name||"paziente").replace(/\s+/g,"_")}_${oggi}.pdf`;

      const corpoEmail = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px"><div style="background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0"><div style="background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px"><h2 style="margin:0">🩺 Risposta medica — Medico Subito</h2></div><p>Gentile <strong>${consult.patient_name}</strong>,</p><p>Il medico ha risposto alla tua richiesta di <strong>${consult.tipo||"consulto"}</strong>.</p><p style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px">📎 <strong>In allegato</strong> trovi il documento medico in formato <strong>PDF</strong>.<br>Aprilo e salvalo sul tuo dispositivo.</p><p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:13px">⚠️ Non sostituisce la visita medica. In emergenza chiama il <strong>118</strong>.</p><p style="font-size:12px;color:#94a3b8">Medico Subito · medicoora.com</p></div></body></html>`;

      const attachments = pdfBase64 ? [{ filename: nomeFile, content: Buffer.from(pdfBase64, 'base64'), contentType: "application/pdf" }] : null;
      await sendEmail(
        consult.email,
        `🩺 Medico Subito — Documento medico: ${consult.tipo||"consulto"}`,
        corpoEmail,
        attachments
      );
    }

    await sendEmail("ferriam78@gmail.com",
      `✅ Risposta inviata a ${consult?.patient_name||"paziente"}`,
      `<div style="font-family:Arial,sans-serif;padding:20px"><h3>Risposta inviata</h3><p><strong>Paziente:</strong> ${consult?.patient_name||"—"}</p><p style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px;font-size:13px">${risposta_medico}</p></div>`);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
