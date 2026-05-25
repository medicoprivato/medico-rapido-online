import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DOC_PASSWORD = process.env.DOC_PASSWORD || "medico2025";

const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 10;
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) { rateMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= max) return true;
  entry.count++; rateMap.set(ip, entry); return false;
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}

const ALLOWED_TYPES = ["image/jpeg","image/png","image/webp","image/gif","application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

function validateAllegati(allegati) {
  if (!allegati || !Array.isArray(allegati)) return { ok: true };
  if (allegati.length > MAX_FILES) return { ok: false, error: `Massimo ${MAX_FILES} allegati` };
  for (const f of allegati) {
    if (!ALLOWED_TYPES.includes(f.type)) return { ok: false, error: `Tipo file non consentito: ${f.type}` };
    if (f.data && f.data.length > MAX_FILE_SIZE * 1.4) return { ok: false, error: `File troppo grande: ${f.name}` };
  }
  return { ok: true };
}

async function sendEmail(to, subject, html) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    await transporter.sendMail({ from: `Medico Subito <${process.env.GMAIL_USER}>`, to, subject, html });
    return true;
  } catch (e) { console.error("Email error:", e.message); return false; }
}

function emailMedico(patientName, tipo, email, phone, dateOfBirth, patientText, clinicalData, codiceFiscale) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px}.card{background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0}.header{background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px}.field{margin-bottom:12px}.label{font-size:11px;font-weight:700;color:#1e40af;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}.value{font-size:14px;color:#0f172a;line-height:1.6}.problema{background:#f8fafc;border-left:3px solid #1e40af;padding:12px;border-radius:0 8px 8px 0;margin:16px 0}.btn{display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:16px}</style></head><body><div class="card"><div class="header"><h2 style="margin:0">🩺 Nuova richiesta medica</h2></div><div class="field"><div class="label">Paziente</div><div class="value"><strong>${patientName}</strong></div></div><div class="field"><div class="label">Codice Fiscale</div><div class="value">${codiceFiscale||'—'}</div></div><div class="field"><div class="label">Data di nascita</div><div class="value">${dateOfBirth||'—'}</div></div><div class="field"><div class="label">Email</div><div class="value">${email}</div></div><div class="field"><div class="label">Telefono</div><div class="value">${phone||'—'}</div></div><div class="field"><div class="label">Tipo</div><div class="value">${tipo||'—'}</div></div><div class="field"><div class="label">Dati clinici</div><div class="value">${clinicalData||'—'}</div></div><div class="field"><div class="label">Descrizione</div><div class="problema" style="white-space:pre-wrap">${patientText}</div></div><a class="btn" href="https://www.medicoora.com/#medico">Accedi alla dashboard →</a><p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:20px">Medico Subito · info@medicoora.com</p></div></body></html>`;
}

function emailPaziente(patientName, tipo, risposta) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px}.card{background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0}.header{background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px}.risposta{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;font-size:14px;line-height:1.8;white-space:pre-wrap;color:#0f172a}</style></head><body><div class="card"><div class="header"><h2 style="margin:0">🩺 Risposta medica</h2><p style="margin:4px 0 0;font-size:13px;opacity:.8">${tipo||'consulto'}</p></div><p style="font-size:14px;color:#374151;margin-bottom:16px">Gentile <strong>${patientName}</strong>,</p><div class="risposta">${risposta}</div><div style="background:#f8fafc;border-radius:10px;padding:14px;margin-top:20px;font-size:13px;color:#475569"><strong>Dott.ssa Anna Maria Ferri</strong><br>Medico Chirurgo · Specialista in Ginecologia e Ostetricia<br>Ordine dei Medici Chirurghi di Frosinone · N. 3363</div><p style="font-size:11px;color:#94a3b8;margin-top:16px">⚠️ Non sostituisce la visita medica. In emergenza chiama il 118.</p></div></body></html>`;
}

export default async function handler(req, res) {
  setSecurityHeaders(res);
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Troppe richieste. Riprova tra un minuto." });

  if (req.method === "GET") {
    const auth = req.headers.authorization;
    const tokenParam = req.query.token;
    const pazToken = req.query.paztoken || req.headers["x-paz-token"];
    const emailFilter = req.query.email;

    // Auth 1: DOC_PASSWORD (medico/admin)
    const isDocAuth = auth === `Bearer ${DOC_PASSWORD}` || tokenParam === DOC_PASSWORD;

    // Auth 2: Token paziente Supabase (paziente vede solo le sue richieste)
    let isPazAuth = false;
    if (!isDocAuth && pazToken && emailFilter) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(pazToken);
        if (!error && user && user.email.toLowerCase() === emailFilter.toLowerCase()) {
          isPazAuth = true;
        }
      } catch(e) { console.error("Paz auth error:", e.message); }
    }

    if (!isDocAuth && !isPazAuth) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    let query = supabase.from("consults").select("*").order("created_at", { ascending: false });
    if (emailFilter) query = query.ilike("email", emailFilter.trim());

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === "POST") {
    const { tipo, patientText, patientName, dateOfBirth, email, phone, clinicalData, aiResponse, conversazione, allegati, consenso, codiceFiscale, archivioReferti } = req.body;

    if (!patientName || !email) return res.status(400).json({ error: "Nome e email obbligatori" });
    if (!consenso) return res.status(400).json({ error: "Consenso obbligatorio" });

    const allegatCheck = validateAllegati(allegati);
    if (!allegatCheck.ok) return res.status(400).json({ error: allegatCheck.error });

    const emailNorm = email.trim().toLowerCase();

    const { error } = await supabase.from("consults").insert({
      tipo, patient_text: patientText, patient_name: patientName, date_of_birth: dateOfBirth,
      email: emailNorm, phone, clinical_data: clinicalData, ai_response: aiResponse,
      conversazione, allegati: allegati || [], consenso: true, codice_fiscale: codiceFiscale,
      archivio_referti: archivioReferti || false, stato: "in_attesa", ip_address: ip
    });

    if (error) return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });

    await sendEmail("ferriam78@gmail.com", `🩺 Nuova richiesta: ${tipo||'consulto'} — ${patientName}`,
      emailMedico(patientName, tipo, emailNorm, phone, dateOfBirth, patientText, clinicalData, codiceFiscale));

    await sendEmail(emailNorm, "Medico Subito — Richiesta ricevuta",
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px"><div style="background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto"><div style="background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px"><h2 style="margin:0">🩺 Richiesta ricevuta</h2></div><p>Gentile <strong>${patientName}</strong>,</p><p>La tua richiesta di <strong>${tipo||'consulto medico'}</strong> è stata ricevuta. Il medico risponderà il prima possibile. Servizio attivo <strong>7 giorni su 7</strong>.</p><p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:13px">⚠️ In caso di urgenza chiama il <strong>118</strong> o vai al Pronto Soccorso.</p><p style="font-size:12px;color:#94a3b8;margin-top:20px">Medico Subito · info@medicoora.com · © 2026</p></div></body></html>`);

    return res.status(200).json({ ok: true });
  }

  if (req.method === "PUT") {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${DOC_PASSWORD}`) return res.status(401).json({ error: "Non autorizzato" });

    const { id, risposta_medico, stato } = req.body;
    if (!id || !risposta_medico) return res.status(400).json({ error: "ID e risposta obbligatori" });

    const { data: consult } = await supabase.from("consults").select("*").eq("id", id).single();

    const { error } = await supabase.from("consults").update({
      risposta_medico, stato: stato || "risposto", risposto_at: new Date().toISOString()
    }).eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    if (consult?.email) {
      await sendEmail(consult.email, `🩺 Medico Subito — Risposta alla tua richiesta`,
        emailPaziente(consult.patient_name, consult.tipo, risposta_medico));
    }

    await sendEmail("ferriam78@gmail.com", `✅ Risposta inviata a ${consult?.patient_name||'paziente'}`,
      `<div style="font-family:Arial,sans-serif;padding:20px"><h3>Risposta inviata</h3><p><strong>Paziente:</strong> ${consult?.patient_name||'—'}</p><p><strong>Email:</strong> ${consult?.email||'—'}</p><p style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px">${risposta_medico}</p><p style="font-size:12px;color:#94a3b8">Inviato il ${new Date().toLocaleString('it-IT')}</p></div>`);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
