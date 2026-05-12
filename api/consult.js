export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Testo mancante" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Rispondi come medico per primo orientamento clinico. Italiano semplice. Dai subito un parere utile, concreto, con ipotesi più probabili e segnali di allarme. Non dire frasi vuote."
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || "Errore OpenAI"
      });
    }

    const answer = data.choices[0].message.content;

    return res.status(200).json({ answer });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
