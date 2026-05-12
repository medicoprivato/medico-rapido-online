import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

    const { text } = req.body;

    if (!text || text.trim().length < 3) {
      return res.status(400).json({
        error: "Descrizione troppo breve"
      });
    }

    const response = await openai.responses.create({
      model: "gpt-5.5",
      input: [
        {
          role: "system",
          content:
            "Sei un assistente medico per primo orientamento clinico. Rispondi in italiano semplice, concreto, utile. Dai un'impressione clinica immediata basata sui sintomi forniti. Non essere vago. Dai ipotesi ragionate."
        },
        {
          role: "user",
          content:
            "Paziente: " + text
        }
      ]
    });

    const aiText = response.output_text;

    await supabase
      .from("consults")
      .insert({
        patient_text: text,
        ai_response: aiText
      });

    return res.status(200).json({
      answer: aiText
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Errore consulto AI"
    });
  }
}
