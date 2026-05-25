// /api/send-ricevuta.js
// Invia ricevuta fiscale via Gmail/Nodemailer

import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { to, subject, html, numeroRicevuta, importo, token } = req.body;

  // Sicurezza: verifica token
  if (token !== process.env.DOC_PWD) {
    return res.status(401).json({ error: "Non autorizzato" });
  }

  if (!to || !html) {
    return res.status(400).json({ error: "Parametri mancanti" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Medico Subito" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: `Gentile paziente, in allegato la ricevuta fiscale n. ${numeroRicevuta} per € ${importo}. Valida per detrazione IRPEF 19% (art. 15 TUIR). Info: info@medicoora.com`,
      attachments: [
        {
          filename: `Ricevuta_MedicoSubito_${numeroRicevuta}.html`,
          content: html,
          contentType: "text/html",
        },
      ],
    });

    console.log("Ricevuta inviata a:", to);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Errore nodemailer:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
