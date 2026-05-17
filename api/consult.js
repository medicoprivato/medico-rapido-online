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
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: "Sei un assistente medico italiano. Rispondi in italiano, in modo empatico e chiaro. Dai del TU al paziente. NON fare diagnosi certe. Rispondi SOLO al problema specifico. Sii conciso e utile.",
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
