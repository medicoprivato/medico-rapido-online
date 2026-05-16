export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { text, isFirst } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Descrizione del problema mancante" });
    }

    const systemPrompt = `Sei un assistente medico che aiuta una dottoressa italiana a preparare risposte per i suoi pazienti.
Parla in italiano, in modo empatico e semplice.
Dai del TU al paziente.
NON fare diagnosi certe. NON essere freddo o automatico.
Rispondi SOLO al problema specifico scritto.
La risposta deve: riconoscere il disagio, spiegare cosa potrebbe significare, dire cosa fare, indicare segnali di allarme.
Usa frasi brevi e naturali. Mantieni la risposta concisa ma utile.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: `Problema del paziente:\n\n${text}` }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data?.error?.message || "Errore AI" });
    }

    const answer = data?.content?.[0]?.text || "Nessuna risposta generata.";
    return res.status(200).json({ answer });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Errore interno" });
  }
}
