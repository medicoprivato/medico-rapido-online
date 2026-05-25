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

function emailPaziente(patientName, tipo, risposta, medico) {
  const oggi = new Date().toLocaleDateString('it-IT', {day:'2-digit',month:'long',year:'numeric'});
  const ora = new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'});
  // Formatta il testo risposta in HTML
  const rispostaHtml = risposta.split('\n').map(r=>r.trim()).filter(r=>r).map(r=>{
    if(r.startsWith('DATI DEL')||r.startsWith('PRESTAZIONE')||r.startsWith('QUESITO')||r.startsWith('DATI CLINICI')||r.startsWith('URGENZA')||r.startsWith('Firma')||r.startsWith('Timbro')){
      return `<div style="font-weight:700;color:#1e3a8a;margin-top:12px;font-size:13px;letter-spacing:.5px">${r}</div>`;
    }
    return `<div style="font-size:14px;color:#0f172a;padding:2px 0;line-height:1.6">${r}</div>`;
  }).join('');
  
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px}
  .doc{background:white;max-width:680px;margin:0 auto;border:2px solid #1e3a8a;border-radius:4px}
  .header{background:#1e3a8a;color:white;padding:20px 28px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-size:20px;font-weight:800;letter-spacing:-.3px}
  .logo span{color:#facc15}
  .header-right{text-align:right;font-size:11px;opacity:.85}
  .body{padding:28px}
  .section{border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-bottom:16px;background:#f8fafc}
  .section-title{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e3a8a;margin-bottom:10px;border-bottom:1px solid #dbeafe;padding-bottom:6px}
  .field{display:flex;gap:8px;margin-bottom:6px;font-size:13px}
  .field-label{color:#64748b;width:140px;flex-shrink:0;font-weight:600}
  .field-value{color:#0f172a;font-weight:500}
  .document-body{background:white;border:2px solid #1e3a8a;border-radius:6px;padding:20px;margin-bottom:20px;font-family:'Courier New',monospace;font-size:13px;line-height:1.8;white-space:pre-wrap;color:#0f172a}
  .firma-box{display:flex;gap:30px;margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0}
  .firma-item{flex:1;text-align:center}
  .firma-line{border-bottom:1px solid #0f172a;height:40px;margin-bottom:6px}
  .firma-label{font-size:10px;color:#64748b;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
  .disclaimer{background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px;font-size:11px;color:#7f1d1d;margin-top:16px}
  .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;font-size:11px;color:#94a3b8}
  @media print{body{background:white;padding:0}.doc{border:none;border-radius:0}.header{background:#1e3a8a!important;-webkit-print-color-adjust:exact}}
</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <div>
      <div class="logo">Medico <span>Subito</span></div>
      <div style="font-size:11px;opacity:.8;margin-top:3px">Piattaforma di Telemedicina · medicoora.com</div>
    </div>
    <div class="header-right">
      Data: ${oggi}<br>Ora: ${ora}<br>Documento ufficiale
    </div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Medico responsabile</div>
      <div class="field"><span class="field-label">Nome</span><span class="field-value">Dott.ssa Anna Maria Ferri</span></div>
      <div class="field"><span class="field-label">Specializzazione</span><span class="field-value">Medico Chirurgo · Ginecologia e Ostetricia</span></div>
      <div class="field"><span class="field-label">Ordine</span><span class="field-value">Ordine Medici Frosinone n. 3363</span></div>
      <div class="field"><span class="field-label">P.IVA</span><span class="field-value">IT17215181003</span></div>
      <div class="field"><span class="field-label">Tipo richiesta</span><span class="field-value">${tipo||'Consulto medico'}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Paziente</div>
      <div class="field"><span class="field-label">Nome</span><span class="field-value">${patientName}</span></div>
    </div>
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e3a8a;margin-bottom:8px">Documento medico</div>
    <div class="document-body">${risposta}</div>
    <div class="firma-box">
      <div class="firma-item"><div class="firma-line"></div><div class="firma-label">Firma del medico</div></div>
      <div class="firma-item"><div class="firma-line"></div><div class="firma-label">Timbro</div></div>
    </div>
    <div class="disclaimer">⚠️ Questo documento è stato generato tramite piattaforma di telemedicina ai sensi delle Linee Guida Min. Salute 2022. Non sostituisce la visita medica in presenza. In emergenza chiamare il 118.</div>
  </div>
  <div class="footer">Medico Subito · medicoora.com · info@medicoora.com · © ${new Date().getFullYear()} · Conforme GDPR e FNOMCeO<br>Stampare questo documento per utilizzarlo come documento medico ufficiale.</div>
</div>
</body></html>`;
}


