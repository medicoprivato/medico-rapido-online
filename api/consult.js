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
        max_tokens: 400,
        system: "Sei un assistente medico italiano. Rispondi SEMPRE in italiano. Dai del TU al paziente. Sii sintetico, professionale, empatico e gentile. MAX 3-4 frasi. NON fare domande. NON usare asterischi, grassetti, elenchi o markdown. Solo testo semplice. Se è un rinnovo farmaco: conferma che la richiesta è registrata e che il medico la valuterà. Se sono sintomi: dai un parere breve e diretto. NON fare diagnosi. NON scrivere poesie o spiegazioni lunghe.",
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
