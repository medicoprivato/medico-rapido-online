export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { text, allegati } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Testo mancante" });
    }

    // Costruisci il contenuto del messaggio
    const messageContent = [];

    // Aggiungi il testo principale
    messageContent.push({ type: "text", text });

    // Aggiungi immagini e PDF allegati se presenti
    if (allegati && Array.isArray(allegati) && allegati.length > 0) {
      for (const allegato of allegati) {
        if (!allegato.data || !allegato.type) continue;

        // Immagini supportate da Claude vision
        if (allegato.type.startsWith("image/")) {
          messageContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: allegato.type,
              data: allegato.data.replace(/^data:[^;]+;base64,/, "")
            }
          });
          messageContent.push({
            type: "text",
            text: `[Allegato immagine: ${allegato.name || "referto"}]`
          });
        }

        // PDF - Claude può analizzare PDF come documento
        if (allegato.type === "application/pdf") {
          messageContent.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: allegato.data.replace(/^data:[^;]+;base64,/, "")
            }
          });
          messageContent.push({
            type: "text",
            text: `[Allegato PDF: ${allegato.name || "documento"}]`
          });
        }
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5-20251101",
        max_tokens: 1500,
        system: `Sei un assistente medico online italiano. Analizzi la richiesta del paziente e tutti gli allegati forniti (immagini, referti, esami).

REGOLA ASSOLUTA E NON NEGOZIABILE: non inventare MAI valori di esami, dati clinici o risultati che il paziente non ha esplicitamente fornito. Se un dato utile manca, scrivilo esplicitamente invece di inventarlo.

La tua risposta deve avere DUE sezioni:

---ANALISI MEDICA (RISERVATA AL MEDICO)---
[3-5 frasi: valutazione clinica del caso, analisi degli allegati se presenti, note per il medico. Stile clinico professionale.]

---DOCUMENTO PER IL PAZIENTE---
[Il documento medico completo nel formato professionale richiesto: prescrizione, richiesta esami, certificato o consulto. 
Intestazione con dati medico, dati paziente, corpo del documento, timbro e firma digitale in fondo.]

Analizza SEMPRE gli allegati se presenti — sono referti, esami o immagini cliniche rilevanti per la diagnosi.
NON usare markdown. Solo testo pulito.`,
        messages: [{ role: "user", content: messageContent }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Claude API error:", data);
      return res.status(500).json({ error: data?.error?.message || "Errore AI" });
    }

    const answer = data?.content?.[0]?.text || "Nessuna risposta.";
    return res.status(200).json({ answer });

  } catch (error) {
    console.error("Consult error:", error.message);
    return res.status(500).json({ error: error.message || "Errore interno" });
  }
}
