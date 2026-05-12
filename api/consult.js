export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
              "Sei un medico virtuale prudente. Non fare diagnosi definitive. Consiglia sempre valutazione medica reale in caso di dubbi o urgenze.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.4,
      }),
    });

    const data = await response.json();

    const reply =
      data.choices?.[0]?.message?.content ||
      "Nessuna risposta disponibile.";

    return res.status(200).json({
      reply,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
}
