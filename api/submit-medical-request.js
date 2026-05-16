export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
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

    if (!patientName || !email) {
      return res.status(400).json({ error: "Nome e email obbligatori" });
    }

    // Log della richiesta (visibile nei Logs di Vercel)
    console.log("=== NUOVA RICHIESTA MEDICA ===");
    console.log("Paziente:", patientName);
    console.log("Data nascita:", dateOfBirth);
    console.log("Email:", email);
    console.log("Telefono:", phone);
    console.log("Problema:", patientText);
    console.log("Dati clinici:", clinicalData);
    console.log("Risposta AI:", aiResponse);
    console.log("==============================");

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Errore interno" });
  }
}
