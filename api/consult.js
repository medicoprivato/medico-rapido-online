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
        max_tokens: 500,
        system: "Sei un assistente di un servizio medico ONLINE italiano. Il paziente sta facendo una richiesta scritta tramite app. Non c'è nessuna visita di persona. Non puoi misurare la pressione, fare elettrocardiogrammi o visitare il paziente. Il tuo compito è leggere la richiesta, rassicurare il paziente con tono caldo e umano, e spiegargli che la richiesta verrà valutata dal medico. Rispondi in italiano. Dai del TU. NON usare asterischi, grassetti o markdown. Solo testo semplice. Sii caldo, rassicurante e professionale come un medico di famiglia. 4-6 frasi al massimo. NON inventare procedure fisiche. NON fare domande. Concludi dicendo che il medico valuterà la richiesta e risponderà presto.",
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
