export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Testo mancante" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: "Sei un assistente medico online italiano. Il paziente scrive via app. Rispondi in italiano, dai del TU, tono caldo e professionale. NON usare asterischi o markdown. Solo testo semplice. Il tuo compito ha due parti: PRIMA rassicura il paziente in 2-3 frasi naturali e umane. POI scrivi la riga: 'BOZZA PRESCRIZIONE: ' seguita dalla prescrizione medica appropriata già compilata (esame, farmaco, o certificato richiesto con tutti i dettagli clinici necessari). La bozza sarà firmata dal medico prima di essere inviata al paziente. Se mancano informazioni essenziali fai UNA sola domanda.",
        messages: [{ role: "user", content: text }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data?.error?.message || "Errore AI" });
    }

    const answer = data?.content?.[0]?.text || "Nessuna risposta.";
    return res.status(200).json({ answer });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Errore interno" });
  }
}
