import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  // MEDICO: GET — legge le richieste
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

  // PAZIENTE: POST — salva richiesta
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
    return res.status(200).json({ ok: true });
  }

  // MEDICO: PUT — salva risposta
  if (req.method === "PUT") {
    const auth = req.headers.authorization;
    if (auth !== "Bearer medico2025") {
      return res.status(401).json({ error: "Non autorizzato" });
    }
    const { id, risposta_medico, stato } = req.body;
    const { error } = await supabase
      .from("consults")
      .update({ risposta_medico, stato })
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Metodo non consentito" });
}
