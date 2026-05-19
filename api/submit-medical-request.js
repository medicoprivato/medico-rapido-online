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

    // Email di conferma al paziente
    await sendEmail(
      email,
      "Richiesta ricevuta — MedicoOra",
      `<p>Gentile ${patientName},</p>
      <p>La tua richiesta medica è stata ricevuta correttamente.</p>
      <p>Il medico la valuterà e riceverai una risposta entro 24 ore a questo indirizzo email.</p>
      <p>Tipo richiesta: <strong>${tipo}</strong></p>
      <br><p>MedicoOra</p>`
    );

    return res.status(200).json({ ok: true });
  }

  if (req.method === "PUT") {
    const auth = req.headers.authorization;
    if (auth !== "Bearer medico2025") {
      return res.status(401).json({ error: "Non autorizzato" });
    }
    const { id, risposta_medico, stato } = req.body;

    // Leggi i dati del paziente
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

    // Email con risposta al paziente
    if (consult?.email) {
      await sendEmail(
        consult.email,
        "Risposta medica — MedicoOra",
        `<p>Gentile ${consult.patient_name},</p>
        <p>Il medico ha valutato la tua richiesta. Ecco la risposta:</p>
        <hr>
        <p style="white-space:pre-wrap">${risposta_medico}</p>
        <hr>
        <p><em>MedicoOra — Questo documento è stato redatto e firmato dal medico.</em></p>`
      );
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
