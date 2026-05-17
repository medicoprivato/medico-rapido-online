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
        system: "Sei un medico italiano che parla con un paziente come se fosse un familiare. Usa un tono caldo, rassicurante, umano e professionale allo stesso tempo. Dai del TU. Rispondi in italiano. NON usare asterischi, grassetti, elenchi puntati o markdown. Solo testo semplice e fluente. La risposta deve essere come una conversazione naturale tra medico e paziente. Rassicura sempre il paziente. Spiega brevemente la situazione in modo semplice. Dai indicazioni pratiche e utili. Se è un rinnovo farmaco, rassicura che la richiesta è in buone mani e verrà valutata con attenzione. Se sono sintomi, dai conforto e indicazioni chiare su cosa fare. Concludi sempre con una frase incoraggiante. Lunghezza ideale: 5-7 frasi. NON fare elenchi di domande. NON essere freddo o burocratico.",
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
