import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

// Genera PDF prescrizione medica
function generaPDF(patientName, tipo, risposta) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const oggi = new Date().toLocaleDateString('it-IT', {day:'2-digit',month:'long',year:'numeric'});
    const ora = new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'});

    // Intestazione medico
    doc.fontSize(13).font('Helvetica-Bold').text('Dott.ssa Anna Maria Ferri');
    doc.fontSize(10).font('Helvetica')
       .text('Medico Chirurgo - Specialista in Ginecologia e Ostetricia')
       .text('Ordine dei Medici di Frosinone n. 3363')
       .text('P.IVA IT17215181003')
       .text('Via Gaetano Marzotto 16 Int.3, 00133 Roma')
       .text('medicoora.com');

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1e3a8a').lineWidth(1.5).stroke();
    doc.moveDown(0.5);

    // Tipo documento
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e3a8a')
       .text((tipo||'DOCUMENTO MEDICO PRIVATO').toUpperCase(), { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveDown(0.5);

    // Corpo documento
    doc.fontSize(10).font('Helvetica').text(risposta, { lineGap: 3 });

    doc.moveDown(1.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1e3a8a').lineWidth(1).stroke();
    doc.moveDown(0.5);

    // Firma e timbro
    doc.fontSize(11).font('Helvetica-Bold').text('TIMBRO E FIRMA DIGITALE DEL MEDICO');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica')
       .text('Dott.ssa Anna Maria Ferri')
       .text('Medico Chirurgo - Specialista in Ginecologia e Ostetricia')
       .text('Ordine dei Medici di Frosinone n. 3363 - P.IVA IT17215181003')
       .moveDown(0.3)
       .text('Firmato digitalmente ai sensi del D.Lgs. 82/2005 (CAD)')
       .text('e Linee Guida Telemedicina Min. Salute 2022');

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#666666')
       .text('Documento emesso tramite piattaforma di telemedicina medicoora.com', { align: 'center' })
       .text('Non sostituisce la visita medica in presenza. In emergenza chiamare il 118.', { align: 'center' });

    doc.end();
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DOC_PASSWORD = process.env.DOC_PASSWORD || "medico2025";
const FALLBACK_PWD = "medico2025";

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
    if (!ALLOWED_TYPES.includes(f.type)) return { ok: false, error: `Tipo non consentito: ${f.type}` };
    if (f.data && f.data.length > MAX_FILE_SIZE * 1.4) return { ok: false, error: `File troppo grande: ${f.name}` };
  }
  return { ok: true };
}

async function sendEmail(to, subject, html, attachments) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    const mailOpts = { 
      from: `Medico Subito <${process.env.GMAIL_USER}>`, 
      to, subject, html 
    };
    if(attachments) mailOpts.attachments = attachments;
    await transporter.sendMail(mailOpts);
    return true;
  } catch (e) { console.error("Email error:", e.message); return false; }
}

function emailMedico(patientName, tipo, email, phone, dateOfBirth, patientText, clinicalData, codiceFiscale) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px}.card{background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0}.header{background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px}.field{margin-bottom:12px}.label{font-size:11px;font-weight:700;color:#1e40af;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}.value{font-size:14px;color:#0f172a;line-height:1.6}.problema{background:#f8fafc;border-left:3px solid #1e40af;padding:12px;border-radius:0 8px 8px 0;margin:16px 0}.btn{display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:16px}</style></head><body><div class="card"><div class="header"><h2 style="margin:0">🩺 Nuova richiesta medica</h2></div><div class="field"><div class="label">Paziente</div><div class="value"><strong>${patientName}</strong></div></div><div class="field"><div class="label">Codice Fiscale</div><div class="value">${codiceFiscale||'—'}</div></div><div class="field"><div class="label">Data di nascita</div><div class="value">${dateOfBirth||'—'}</div></div><div class="field"><div class="label">Email</div><div class="value">${email}</div></div><div class="field"><div class="label">Telefono</div><div class="value">${phone||'—'}</div></div><div class="field"><div class="label">Tipo</div><div class="value">${tipo||'—'}</div></div><div class="field"><div class="label">Dati clinici</div><div class="value">${clinicalData||'—'}</div></div><div class="field"><div class="label">Descrizione</div><div class="problema" style="white-space:pre-wrap">${patientText}</div></div><a class="btn" href="https://www.medicoora.com/#s-doc-login">Accedi alla dashboard →</a><p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:20px">Medico Subito · info@medicoora.com</p></div></body></html>`;
}

function emailPaziente(patientName, tipo, risposta) {
  const oggi = new Date().toLocaleDateString('it-IT', {day:'2-digit', month:'long', year:'numeric'});
  const ora = new Date().toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  const rispostaFormatted = risposta.replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px}
  .doc{background:white;max-width:680px;margin:0 auto;border:2px solid #1e3a8a;border-radius:4px}
  .header{background:#1e3a8a;color:white;padding:20px 28px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-size:20px;font-weight:800;letter-spacing:-.3px}
  .logo span{color:#facc15}
  .header-right{text-align:right;font-size:11px;opacity:.85;line-height:1.6}
  .body{padding:28px}
  .section{border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-bottom:14px;background:#f8fafc}
  .section-title{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e3a8a;margin-bottom:8px;border-bottom:1px solid #dbeafe;padding-bottom:5px}
  .field{display:flex;gap:8px;margin-bottom:5px;font-size:13px}
  .field-label{color:#64748b;width:130px;flex-shrink:0;font-weight:600}
  .field-value{color:#0f172a;font-weight:500}
  .document-body{border:2px solid #1e3a8a;border-radius:6px;padding:20px;margin:14px 0;font-size:13px;line-height:1.9;color:#0f172a;background:white}
  .firma-box{display:flex;gap:30px;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0}
  .firma-item{flex:1;text-align:center}
  .firma-line{border-bottom:1px solid #0f172a;height:44px;margin-bottom:5px}
  .firma-label{font-size:10px;color:#64748b;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
  .disclaimer{background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:11px;font-size:11px;color:#7f1d1d;margin-top:14px;line-height:1.6}
  .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 28px;text-align:center;font-size:10px;color:#94a3b8;line-height:1.7}
  @media print{body{background:white;padding:0}.doc{border:none}}
</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <div>
      <div class="logo">Medico <span>Subito</span></div>
      <div style="font-size:11px;opacity:.8;margin-top:3px">Piattaforma di Telemedicina · medicoora.com</div>
    </div>
    <div class="header-right">Data: ${oggi}<br>Ora: ${ora}<br>Documento privato</div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Medico responsabile</div>
      <div class="field"><span class="field-label">Nome</span><span class="field-value">Dott.ssa Anna Maria Ferri</span></div>
      <div class="field"><span class="field-label">Specializzazione</span><span class="field-value">Medico Chirurgo · Ginecologia e Ostetricia</span></div>
      <div class="field"><span class="field-label">Ordine</span><span class="field-value">Ordine Medici Frosinone n. 3363</span></div>
      <div class="field"><span class="field-label">P.IVA</span><span class="field-value">IT17215181003</span></div>
      <div class="field"><span class="field-label">Tipo documento</span><span class="field-value">${tipo||'Consulto medico privato'}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Paziente</div>
      <div class="field"><span class="field-label">Nome</span><span class="field-value">${patientName}</span></div>
    </div>
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e3a8a;margin-bottom:8px">Documento medico privato</div>
    <div class="document-body">${rispostaFormatted}</div>
    <div style="margin-top:28px;border-top:2px solid #1e3a8a;padding-top:20px">
      <div style="display:flex;gap:24px;align-items:flex-start">
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-bottom:10px">Firma digitale del medico prescrittore</div>
          <div style="font-family:'Times New Roman',serif;font-size:20px;color:#1e3a8a;font-style:italic;margin-bottom:8px;border-bottom:1px solid #cbd5e1;padding-bottom:8px">Dott.ssa Anna Maria Ferri</div>
          <div style="font-size:12px;color:#475569;line-height:1.7">
            <strong>Medico Chirurgo</strong><br>
            Specialista in Ginecologia e Ostetricia<br>
            Ordine dei Medici di Frosinone · N. 3363<br>
            P.IVA: IT17215181003
          </div>
        </div>
        <div style="width:180px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;flex-shrink:0">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-bottom:10px">Data e ora di emissione</div>
          <div style="font-size:16px;font-weight:800;color:#1e3a8a;margin-bottom:4px">${oggi}</div>
          <div style="font-size:14px;color:#475569;font-weight:600">ore ${ora}</div>
          <div style="margin-top:10px;font-size:10px;color:#94a3b8;line-height:1.5">Documento emesso tramite piattaforma di telemedicina certificata</div>
        </div>
      </div>
      <div style="margin-top:14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 12px;font-size:11px;color:#1e40af;text-align:center">
        🔏 Documento firmato digitalmente da Dott.ssa Anna Maria Ferri · ${oggi} ore ${ora} · medicoora.com
      </div>
    </div>
    <div class="disclaimer">⚠️ Documento emesso tramite telemedicina ai sensi delle Linee Guida Min. Salute 2022 e FNOMCeO. Prestazione medica privata — non sostituisce la visita in presenza. In emergenza chiamare il 118 o recarsi al Pronto Soccorso.</div>
  </div>
  <div class="footer">
    Medico Subito · medicoora.com · info@medicoora.com · © ${new Date().getFullYear()}<br>
    Conforme GDPR Reg. UE 2016/679 · Linee Guida Telemedicina Min. Salute 2022 · FNOMCeO<br>
    Stampare o salvare questo documento come PDF per conservarlo.
  </div>
</div>
</body></html>`;
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

    const isDocAuth = auth === `Bearer ${DOC_PASSWORD}` || tokenParam === DOC_PASSWORD || auth === `Bearer ${FALLBACK_PWD}` || tokenParam === FALLBACK_PWD;

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

    await sendEmail(
      "ferriam78@gmail.com",
      `🩺 Nuova richiesta: ${tipo||'consulto'} — ${patientName}`,
      emailMedico(patientName, tipo, emailNorm, phone, dateOfBirth, patientText, clinicalData, codiceFiscale)
    );

    await sendEmail(
      emailNorm,
      "Medico Subito — Richiesta ricevuta",
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px"><div style="background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto"><div style="background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px"><h2 style="margin:0">🩺 Richiesta ricevuta</h2></div><p>Gentile <strong>${patientName}</strong>,</p><p>La tua richiesta di <strong>${tipo||'consulto medico'}</strong> è stata ricevuta. Il medico risponderà il prima possibile, indicativamente entro 24-48 ore. Servizio attivo <strong>7 giorni su 7</strong>.</p><p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:13px">⚠️ In caso di urgenza chiama il <strong>118</strong> o vai al Pronto Soccorso.</p><p style="font-size:12px;color:#94a3b8;margin-top:20px">Medico Subito · info@medicoora.com · © 2026</p></div></body></html>`
    );

    return res.status(200).json({ ok: true });
  }

  if (req.method === "PUT") {
    const auth = req.headers.authorization;
    const isDocAuth = auth === `Bearer ${DOC_PASSWORD}` || auth === `Bearer ${FALLBACK_PWD}`;
    if (!isDocAuth) return res.status(401).json({ error: "Non autorizzato" });

    const { id, risposta_medico, stato } = req.body;
    if (!id || !risposta_medico) return res.status(400).json({ error: "ID e risposta obbligatori" });

    const { data: consult } = await supabase.from("consults").select("*").eq("id", id).single();

    const { error } = await supabase.from("consults").update({
      risposta_medico,
      stato: stato || "risposto",
      risposto_at: new Date().toISOString()
    }).eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    if (consult?.email) {
      const docHtml = emailPaziente(consult.patient_name, consult.tipo, risposta_medico);
      const oggi = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-');
      const nomeFile = `Documento_Medico_${(consult.patient_name||'paziente').replace(/\s+/g,'_')}_${oggi}.html`;
      
      // Corpo email semplice
      const corpoEmail = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px">
        <div style="background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0">
          <div style="background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px">
            <h2 style="margin:0">🩺 Risposta medica — Medico Subito</h2>
          </div>
          <p>Gentile <strong>${consult.patient_name}</strong>,</p>
          <p>Il medico ha valutato la tua richiesta di <strong>${consult.tipo||'consulto'}</strong>.</p>
          <p style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;font-size:14px">
            📎 <strong>In allegato</strong> trovi il documento medico ufficiale (<em>${nomeFile}</em>).<br>
            Aprilo e stampalo oppure salvalo come PDF dal menu di stampa del browser.
          </p>
          <p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:13px">
            ⚠️ Questo documento è una prestazione medica privata. Non sostituisce la visita in presenza.<br>
            In emergenza chiama il <strong>118</strong>.
          </p>
          <p style="font-size:12px;color:#94a3b8;margin-top:20px">
            Medico Subito · medicoora.com · info@medicoora.com
          </p>
        </div>
      </body></html>`;

      await sendEmail(
        consult.email,
        `🩺 Medico Subito — Documento medico: ${consult.tipo||'consulto'}`,
        corpoEmail,
        [{
          filename: nomeFile,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      );
    }

    await sendEmail(
      "ferriam78@gmail.com",
      `✅ Risposta inviata a ${consult?.patient_name||'paziente'}`,
      `<div style="font-family:Arial,sans-serif;padding:20px"><h3>Risposta inviata</h3><p><strong>Paziente:</strong> ${consult?.patient_name||'—'}</p><p><strong>Email:</strong> ${consult?.email||'—'}</p><p style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px;font-size:13px">${risposta_medico}</p><p style="font-size:12px;color:#94a3b8">Inviato il ${new Date().toLocaleString('it-IT')}</p></div>`
    );

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
