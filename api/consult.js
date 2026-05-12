export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Testo mancante" });
    }

    const prompt = `
Sei un medico esperto in telemedicina.

Rispondi SOLO al problema scritto qui sotto.
NON inventare diagnosi assurde.
NON mescolare richieste precedenti.
NON aggiungere sintomi non presenti.
NON parlare di altri distretti corporei non citati.

Fornisci:
- ipotesi più probabili
- segnali di allarme
- cosa fare nell'immediato
- quando consultare urgentemente un medico

Risposta breve, chiara, professionale, rassicurante.

Problema paziente:
${text}
`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content:
                "Sei un medico esperto in telemedicina. Rispondi in italiano in modo clinicamente prudente."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || "Errore OpenAI"
      });
    }

    const answer =
      data.choices?.[0]?.message?.content ||
      "Nessuna risposta disponibile.";

    return res.status(200).json({ answer });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Errore server"
    });
  }
}
