import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── SICUREZZA: password da variabile d'ambiente ──────────────
const DOC_PASSWORD = process.env.DOC_PASSWORD || "medico2025";

// ── RATE LIMITING semplice in memoria ───────────────────────
const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const max = 10; // max 10 richieste al minuto per IP
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  rateMap.set(ip, entry);
  return false;
}

// ── SECURITY HEADERS ────────────────────────────────────────
function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.anthropic.com https://*.supabase.co https://api.resend.com https://api.stripe.com;"
  );
}

// ── VALIDAZIONE ALLEGATI ─────────────────────────────────────
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function validateAllegati(allegati) {
  if (!allegati || !Array.isArray(allegati)) return { ok: true };
  if (allegati.length > MAX_FILES) return { ok: false, error: `Massimo ${MAX_FILES} allegati` };
  for (const f of allegati) {
    if (!ALLOWED_TYPES.includes(f.type)) return { ok: false, error: `Tipo file non consentito: ${f.type}` };
    if (f.data && f.data.length > MAX_FILE_SIZE * 1.4) return { ok: false, error: `File troppo grande: ${f.name}` };
    if (f.name && /[<>:"/\\|?*]/.test(f.name)) return { ok: false, error: `Nome file non valido: ${f.name}` };
  }
  return { ok: true };
}

// ── EMAIL ────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  try {
    // Quando medicoora.com sarà verificato su Resend, cambia from con noreply@medicoora.com
    const fromAddress = process.env.RESEND_DOMAIN_VERIFIED === "true"
      ? "Medico Subito <noreply@medicoora.com>"
      : "Medico Subito <onboarding@resend.dev>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, html })
    });
    return res.ok;
  } catch (e) {
    console.error("Email error:", e.message);
    return false;
  }
}

function emailMedico(patientName, tipo, email, phone, dateOfBirth, patientText, clinicalData, codiceFiscale) {
  return `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><style>
body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px}
.card{background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0}
.header{background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px}
.header h2{margin:0;font-size:18px}
.header p{margin:4px 0 0;font-size:13px;opacity:.8}
.field{margin-bottom:12px}
.label{font-size:11px;font-weight:700;color:#1e40af;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
.value{font-size:14px;color:#0f172a;line-height:1.6}
.problema{background:#f8fafc;border-left:3px solid #1e40af;padding:12px;border-radius:0 8px 8px 0;margin:16px 0}
.btn{display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:16px}
.footer{font-size:11px;color:#94a3b8;text-align:center;margin-top:20px}
</style></head>
<body>
<div class="card">
  <div class="header">
    <h2>🩺 Nuova richiesta medica</h2>
    <p>Medico Subito — Area Riservata</p>
  </div>
  <div class="field"><div class="label">Paziente</div><div class="value"><strong>${patientName}</strong></div></div>
  <div class="field"><div class="label">Codice Fiscale</div><div class="value">${codiceFiscale||'—'}</div></div>
  <div class="field"><div class="label">Data di nascita</div><div class="value">${dateOfBirth||'—'}</div></div>
  <div class="field"><div class="label">Email paziente</div><div class="value">${email}</div></div>
  <div class="field"><div class="label">Telefono</div><div class="value">${phone||'—'}</div></div>
  <div class="field"><div class="label">Tipo richiesta</div><div class="value">${tipo||'—'}</div></div>
  <div class="field"><div class="label">Dati clinici</div><div class="value">${clinicalData||'—'}</div></div>
  <div class="field"><div class="label">Descrizione del paziente</div>
    <div class="problema" style="white-space:pre-wrap">${patientText}</div>
  </div>
  <a class="btn" href="https://medico-rapido-online.vercel.app/#medico">Accedi alla dashboard →</a>
  <div class="footer">Medico Subito · info@medicoora.com · 7 giorni su 7</div>
</div>
</body></html>`;
}

function emailPaziente(patientName, tipo, risposta) {
  return `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><style>
body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px}
.card{background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto;border:1px solid #e2e8f0}
.header{background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px}
.header h2{margin:0;font-size:18px}
.header p{margin:4px 0 0;font-size:13px;opacity:.8}
.risposta{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;font-size:14px;line-height:1.8;white-space:pre-wrap;color:#0f172a}
.medico{background:#f8fafc;border-radius:10px;padding:14px;margin-top:20px;font-size:13px;color:#475569}
.disclaimer{font-size:11px;color:#94a3b8;margin-top:16px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:14px}
.footer{font-size:11px;color:#94a3b8;text-align:center;margin-top:20px}
</style></head>
<body>
<div class="card">
  <div class="header">
    <h2>🩺 Risposta medica — Medico Subito</h2>
    <p>Risposta alla tua richiesta: ${tipo||'consulto medico'}</p>
  </div>
  <p style="font-size:14px;color:#374151;margin-bottom:16px">Gentile <strong>${patientName}</strong>,<br>il medico ha valutato la sua richiesta e le invia la seguente risposta:</p>
  <div class="risposta">${risposta}</div>
  <div class="medico">
    <strong>Dott.ssa Anna Maria Ferri</strong><br>
    Medico Chirurgo · Specialista in Ginecologia e Ostetricia<br>
    Ordine dei Medici Chirurghi di Frosinone · N. 3363
  </div>
  <div class="disclaimer">
    ⚠️ Questa risposta è valida solo per la situazione clinica descritta e non sostituisce la visita medica in presenza. 
    In caso di urgenza chiami il 118 o si rechi al Pronto Soccorso.<br><br>
    Per informazioni: info@medicoora.com
  </div>
  <div class="footer">Medico Subito · Servizio di telemedicina con valutazione medica professionale · © 2026</div>
</div>
</body></html>`;
}

// ── HANDLER PRINCIPALE ───────────────────────────────────────
export default async function handler(req, res) {
  setSecurityHeaders(res);

  // Rate limiting
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Troppe richieste. Riprova tra un minuto." });
  }

  // ── GET — lista richieste per il medico ──────────────────
  if (req.method === "GET") {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${DOC_PASSWORD}`) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    // Filtro per email paziente (area paziente)
    const emailFilter = req.query.email;
    let query = supabase.from("consults").select("*").order("created_at", { ascending: false });
    if (emailFilter) query = query.eq("email", emailFilter);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── POST — nuova richiesta paziente ─────────────────────
  if (req.method === "POST") {
    const {
      tipo, patientText, patientName, dateOfBirth, email, phone,
      clinicalData, aiResponse, conversazione, allegati, consenso,
      codiceFiscale, archivioReferti
    } = req.body;

    if (!patientName || !email) {
      return res.status(400).json({ error: "Nome e email obbligatori" });
    }
    if (!consenso) {
      return res.status(400).json({ error: "Consenso obbligatorio" });
    }

    // Validazione allegati
    const allegatCheck = validateAllegati(allegati);
    if (!allegatCheck.ok) {
      return res.status(400).json({ error: allegatCheck.error });
    }

    // Salva su Supabase
    const { error } = await supabase.from("consults").insert({
      tipo,
      patient_text: patientText,
      patient_name: patientName,
      date_of_birth: dateOfBirth,
      email,
      phone,
      clinical_data: clinicalData,
      ai_response: aiResponse,
      conversazione,
      allegati: allegati || [],
      consenso: true,
      codice_fiscale: codiceFiscale,
      archivio_referti: archivioReferti || false,
      stato: "in_attesa",
      ip_address: ip,
      created_at: new Date().toISOString()
    });

    if (error) return res.status(500).json({ error: error.message });

    // Email al medico
    await sendEmail(
      "ferriam78@gmail.com",
      `🩺 Nuova richiesta: ${tipo||'consulto'} — ${patientName}`,
      emailMedico(patientName, tipo, email, phone, dateOfBirth, patientText, clinicalData, codiceFiscale)
    );

    // Email di conferma al paziente
    await sendEmail(
      email,
      "Medico Subito — Richiesta ricevuta",
      `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px">
      <div style="background:white;border-radius:12px;padding:24px;max-width:600px;margin:0 auto">
        <div style="background:#1e3a8a;color:white;border-radius:10px;padding:16px;margin-bottom:20px">
          <h2 style="margin:0">🩺 Richiesta ricevuta</h2>
        </div>
        <p>Gentile <strong>${patientName}</strong>,</p>
        <p>La sua richiesta di <strong>${tipo||'consulto medico'}</strong> è stata ricevuta correttamente.</p>
        <p>Il medico la valuterà il prima possibile e riceverà la risposta a questo indirizzo email. Servizio attivo <strong>7 giorni su 7</strong>.</p>
        <p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;font-size:13px">
          ⚠️ In caso di urgenza chiami il <strong>118</strong> o si rechi al Pronto Soccorso.
        </p>
        <p style="font-size:12px;color:#94a3b8;margin-top:20px">Medico Subito · info@medicoora.com · © 2026</p>
      </div></body></html>`
    );

    return res.status(200).json({ ok: true });
  }

  // ── PUT — risposta del medico ────────────────────────────
  if (req.method === "PUT") {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${DOC_PASSWORD}`) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const { id, risposta_medico, stato } = req.body;
    if (!id || !risposta_medico) {
      return res.status(400).json({ error: "ID e risposta obbligatori" });
    }

    // Recupera dati paziente
    const { data: consult } = await supabase
      .from("consults").select("*").eq("id", id).single();

    // Aggiorna Supabase
    const { error } = await supabase
      .from("consults")
      .update({
        risposta_medico,
        stato: stato || "risposto",
        risposto_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    // Email risposta AL PAZIENTE
    if (consult?.email) {
      await sendEmail(
        consult.email,
        `🩺 Medico Subito — Risposta alla sua richiesta`,
        emailPaziente(consult.patient_name, consult.tipo, risposta_medico)
      );
    }

    // Email copia al medico
    await sendEmail(
      "ferriam78@gmail.com",
      `✅ Risposta inviata a ${consult?.patient_name||'paziente'}`,
      `<div style="font-family:Arial,sans-serif;padding:20px">
        <h3>Risposta inviata con successo</h3>
        <p><strong>Paziente:</strong> ${consult?.patient_name||'—'}</p>
        <p><strong>Email:</strong> ${consult?.email||'—'}</p>
        <p><strong>Risposta:</strong></p>
        <p style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px">${risposta_medico}</p>
        <p style="font-size:12px;color:#94a3b8">Inviato il ${new Date().toLocaleString('it-IT')}</p>
      </div>`
    );

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
