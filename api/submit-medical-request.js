import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo non consentito"
    });
  }

  try {
    const {
      patientText,
      aiResponse,
      patientName,
      dateOfBirth,
      email,
      phone,
      clinicalData
    } = req.body;

    const { error } = await supabase
      .from("consults")
      .insert({
        patient_text: patientText,
        ai_response: aiResponse,
        patient_name: patientName,
        date_of_birth: dateOfBirth,
        email: email,
        phone: phone,
        clinical_data: clinicalData,
        status: "doctor_review_requested"
      });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      ok: true
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Errore salvataggio richiesta"
    });
  }
}
