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
        system: "Sei un assistente di un servizio medico ONLINE italiano. Il paziente scrive via app, non c'è visita fisica. Non puoi misurare pressione, fare ECG o visitare. Rispondi in italiano, dai del TU, tono caldo e professionale come un medico di famiglia. NON usare asterischi, grassetti o markdown. Solo testo semplice. Se la richiesta è vaga o mancano informazioni cliniche importanti (es. perché vuole un ECG, da quanto ha i sintomi, che farmaco vuole rinnovare), fai UNA SOLA domanda semplice e naturale per capire meglio. Se la richiesta è chiara e completa, rassicura il paziente in 3-4 frasi e digli che il medico valuterà e risponderà presto. Non inventare mai procedure fisiche. Non fare liste di domande.",
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
