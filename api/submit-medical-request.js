import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendEmail(to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: "MedicoOra <onboarding@resend.dev>",
      to: [to],
      subject: subject,
      html: html
    })
  });
  return res.ok;
}

export default async function handler(req, res) {

  if (req.method === "GET") {
    const auth = req.headers.authorization;
    if (auth !== "Bearer medico2025") {
      return res.status(401).json({ error: "Non autorizzato" });
    }
    const { data, error } = await supabase
      .from("consults")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { tipo, patientText, patientName, dateOfBirth, email, phone, clinicalData, aiResponse, conversazione } = req.body;
    if (!patientName || !email) {
      return res.status(400).json({ error: "Nome e email obbligatori" });
    }
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
      stato: "in_attesa"
    });
    if (error) return res.status(500).json({ error: error.message });

    // Notifica a te — il medico
    await sendEmail(
      "ferriam78@gmail.com",
      "Nuova richiesta medica — " + patientName,
      `<h2>Nuova richiesta da ${patientName}</h2>
      <p><strong>Tipo:</strong> ${tipo}</p>
      <p><strong>Email paziente:</strong> ${email}</p>
      <p><strong>Telefono:</strong> ${phone||'—'}</p>
      <p><strong>Data nascita:</strong> ${dateOfBirth||'—'}</p>
      <p><strong>Problema:</strong></p>
      <p style="white-space:pre-wrap">${patientText}</p>
      <p><strong>Dati clinici:</strong> ${clinicalData||'—'}</p>
      <hr>
      <p>Vai su <a href="https://medico-rapido-online.vercel.app/#medico">medico-rapido-online.vercel.app/#medico</a> per rispondere.</p>`
    );

    return res.status(200).json({ ok: true });
  }

  if (req.method === "PUT") {
    const auth = req.headers.authorization;
    if (auth !== "Bearer medico2025") {
      return res.status(401).json({ error: "Non autorizzato" });
    }
    const { id, risposta_medico, stato } = req.body;

    const { data: consult } = await supabase
      .from("consults")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("consults")
      .update({ risposta_medico, stato })
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });

    // Email di risposta sempre a ferriam78@gmail.com per ora
    await sendEmail(
      "ferriam78@gmail.com",
      "Risposta firmata per " + (consult?.patient_name||'paziente'),
      `<h2>Hai firmato la risposta per ${consult?.patient_name||'il paziente'}</h2>
      <p><strong>Email paziente:</strong> ${consult?.email||'—'}</p>
      <p><strong>La tua risposta:</strong></p>
      <p style="white-space:pre-wrap">${risposta_medico}</p>
      <hr>
      <p><em>Quando configurerai il dominio email, questa risposta verrà inviata automaticamente al paziente.</em></p>`
    );

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
