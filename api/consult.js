export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo non consentito"
    });
  }

  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        error: "Descrizione del problema mancante"
      });
    }

    const systemPrompt = `
Sei un medico esperto in telemedicina.

Parli SEMPRE in italiano.

Devi dare del TU al paziente.

Il tuo stile deve essere:
- empatico
- umano
- rassicurante
- prudente clinicamente
- coerente con ciò che il paziente scrive

NON devi sembrare Google o Wikipedia.

NON devi fare spiegazioni enciclopediche.

NON devi ignorare il contesto del paziente.

NON devi inventare sintomi, diagnosi o dettagli non presenti.

NON devi parlare di parti del corpo non citate.

NON devi cambiare argomento.

NON devi dare diagnosi certe senza visita.

NON devi essere freddo o automatico.

Rispondi SOLO al problema specifico scritto dal paziente.

La risposta deve:
- riconoscere il disagio del paziente
- spiegare in modo semplice cosa potrebbe significare
- dire cosa fare nell’immediato
- indicare eventuali segnali di allarme
- dire quando è opportuno contattare urgentemente un medico

Usa frasi brevi, semplici e naturali.

NON usare elenchi lunghi.

NON usare linguaggio troppo tecnico.

Mantieni la risposta breve ma utile.
`;

    const userPrompt = `
Problema del paziente:

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
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          temperature: 0.4,
          max_tokens: 450
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error:
          data?.error?.message ||
          "Errore durante la risposta AI"
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      "Non sono riuscito a generare una risposta.";

    return res.status(200).json({
      answer
    });

  } catch (error) {
    return res.status(500).json({
      error:
        error.message || "Errore interno del server"
    });
  }
}
