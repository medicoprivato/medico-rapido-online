/**
 * One-time migration: old €15/month and €150/year promotional copy
 * to €30 for one written medical consultation.
 * Deliberately excludes separate B2B business/pharmacy packages.
 * Does not touch Stripe subscription records for existing customers.
 */
import fs from "node:fs";
import cp from "node:child_process";

const all=cp.execFileSync("git",["ls-files"],{encoding:"utf8"}).trim().split("\n").filter(p=>p.endsWith(".html"));
let changed=0;
for(const path of all){
 if(path==="aziende/index.html"||path==="per-farmacie-partner/index.html")continue;
 const before=fs.readFileSync(path,"utf8");
 let t=before;
 t=t.replace(/For the annual plan at €150,\s*the deduction adds to any other healthcare expenses incurred during the year/gi,"For each individual medical consultation at €30, possible tax deductions depend on applicable Italian tax rules and documentation")
 .replace(/If the subscription were the only medical expense of the year/gi,"If the consultation were the only potentially deductible healthcare expense of the year")
 .replace(/receipt is generated electronically at the time of subscription/gi,"payment confirmation is provided after the consultation purchase, while any tax documentation follows applicable requirements")
 .replace(/at the time of subscription/gi,"after payment")
 .replace(/Abbonati a €\s*15\s*\/\s*mese/gi,"Acquista un consulto a €30")
 .replace(/Un prezzo fisso e trasparente:\s*€15\s+al mese(?: a persona)?,\s*senza costi nascosti,\s*senza pagare ogni singola visita\./gi,"Un prezzo chiaro: €30 per singolo consulto scritto, senza abbonamento o rinnovo automatico.")
 .replace(/€\s*150\s*\/\s*anno/gi,"€30 per consulto")
 .replace(/€\s*15\s*\/\s*mese/gi,"€30 per consulto")
 .replace(/€\s*15\s*\/\s*month/gi,"€30 per consultation")
 .replace(/€\s*15\s+al mese\b/gi,"€30 per consulto")
 .replace(/€\s*15\s+per month\b/gi,"€30 per consultation")
 .replace(/€\s*150\b/g,"€30")
 .replace(/€\s*15(?!\d)\b/g,"€30")
 .replace(/\b150\s*€\s*\/\s*anno/gi,"€30 per consulto")
 .replace(/\b15\s*€\s*\/\s*mese/gi,"€30 per consulto")
 .replace(/\b15\s*euro\s+al mese/gi,"30 euro per consulto")
 .replace(/al mese,\s*più richieste per te nell'ambito di un utilizzo normale\s*\(fair use\)\./gi,"per singolo consulto medico scritto. Una richiesta per pagamento, senza abbonamento né rinnovo automatico.")
 .replace(/più richieste per te nell'ambito di un utilizzo normale\s*\(fair use\)/gi,"una sola richiesta medica scritta per pagamento")
 .replace(/per month,\s*unlimited requests/gi,"per consultation, one written medical request. No subscription or automatic renewal")
 .replace(/per month\s*\/\s*al mese/gi,"per consultation / per consulto")
 .replace(/per month\s*·\s*al mese/gi,"per consultation · per consulto")
 .replace(/per month\s*\/\s*per mese/gi,"per consultation / per consulto")
 .replace(/per month\b/gi,"per consultation")
 .replace(/al mese,\s*valutazioni illimitate solo per te\./gi,"per consulto medico scritto, una richiesta per pagamento.")
 .replace(/Personal subscription, strictly for individual use\s*·\s*Abbonamento personale, uso strettamente individuale/gi,"One consultation per payment · Un consulto per pagamento")
 .replace(/unlimited requests/gi,"one medical request per payment")
 .replace(/abbonamento personale a testa/gi,"pagamento individuale per ogni consulto")
 .replace(/proprio abbonamento personale/gi,"proprio consulto individuale")
 .replace(/tuo abbonamento personale/gi,"tuo consulto acquistato")
 .replace(/un abbonamento personale per ogni adulto/gi,"un consulto pagato per ogni richiesta di ciascun adulto")
 .replace(/abbonamento a prezzo fisso/gi,"consulto a prezzo fisso")
 .replace(/abbonamento mensile di €30/gi,"pagamento di €30 per singolo consulto")
 .replace(/finché resta abbonato/gi,"secondo le condizioni dell'accordo di collaborazione")
 .replace(/all'anno\s*·\s*piano annuale Medico Subito/gi,"per singolo consulto medico scritto, senza rinnovo")
 .replace(/piano annuale Medico Subito/gi,"consulto singolo Medico Subito")
 .replace(/Detraibile al 19%\./gi,"Detraibilità fiscale subordinata ai requisiti di legge.")
 .replace(/Detraibile al 19%/gi,"Detraibilità fiscale da verificare secondo legge")
 .replace(/a soli &euro;\s*15 al mese/gi,"a €30 per singolo consulto scritto")
 .replace(/&euro;\s*15\s*al mese/gi,"€30 per singolo consulto scritto")
 .replace(/&euro;\s*15(?!\d)/gi,"€30")
 .replace(/&euro;\s*150(?!\d)/gi,"€30");
 if(path==="blog-detrazione-fiscale-730/index.html"){
  t=t.replace(/Per chi sceglie il piano annuale a centocinquanta euro,[\s\S]*?Non è una cifra enorme, ma è un dettaglio che molti dimenticano quando calcolano il costo reale di un servizio medico\./i,"Per ogni consulto medico scritto acquistato al prezzo di 30 euro, l'eventuale detrazione fiscale dipende dalla natura della prestazione, dalla documentazione rilasciata e dai requisiti previsti dalla normativa italiana. Se la spesa è effettivamente detraibile e la franchigia sanitaria è già superata, il 19% di 30 euro corrisponde a 5,70 euro.")
  .replace(/piano annuale a centocinquanta euro/gi,"consulto singolo da 30 euro")
  .replace(/Se l'abbonamento fosse l'unica spesa medica dell'anno/gi,"Se il consulto fosse l'unica spesa medica detraibile dell'anno")
  .replace(/fino a circa ventotto euro/gi,"fino a 5,70 euro per consulto, se detraibile");
 }
 if(path==="blog-tax-deduction-medical-expenses-english/index.html"){
  t=t.replace(/saving up to about €28/gi,"up to €5.70 on a €30 consultation, if legally deductible")
   .replace(/the deduction applies to the full amount/gi,"the deduction may apply to eligible expenses");
 }
 if(path==="blog-telemedicina-scritta/index.html")
  t=t.replace(/Con l'abbonamento annuale di centocinquanta euro, scrivi fino a tre richieste al mese per dodici mesi\./gi,"Con Medico Subito paghi 30 euro per un singolo consulto medico scritto, senza abbonamento né rinnovo automatico. Per ogni nuova richiesta distinta effettui un nuovo pagamento.");
 if(path==="blog-written-telemedicine-english/index.html")
  t=t.replace(/With the monthly subscription of €30, you can write as many requests as you need, every month, for your own personal use\./gi,"Medico Subito charges €30 for one written medical consultation, with no monthly subscription or automatic renewal. Each additional medical request requires a separate payment.");
 if(path==="how-to-get-medical-prescription-online-2026/index.html")
  t=t.replace(/Rather than paying per single request, services like Medico Subito offer an annual subscription that includes multiple requests per consultation, so you can build a relationship with the same doctor over time instead of starting from scratch with someone new every time\./gi,"Medico Subito offers one written medical consultation for €30, paid once. There is no annual subscription or automatic renewal; each new request is paid separately.");
 if(path==="italians-abroad-talk-italian-doctor-24-hours/index.html")
  t=t.replace(/The real advantage over a one-off consultation is continuity\. With an annual subscription, you can write to the same doctor multiple times throughout the year, building a relationship with someone who already understands your medical history, rather than starting over each time with someone new\./gi,"Medico Subito offers a written medical consultation for €30 per request, without a subscription. If you need another consultation later, you can submit a new paid request.");
 if(path==="medico-online-per-famiglie-numerose-online/index.html")
  t=t.replace(/Ogni membro della famiglia maggiorenne necessita di un proprio abbonamento\./gi,"Ogni richiesta per una persona adulta richiede un proprio consulto individuale a pagamento.");
 if(path==="medico-online-redditi-bassi-online/index.html"||path==="medico-online-senza-assicurazione-sanitaria-online/index.html")
  t=t.replace(/Un abbonamento annuale a prezzo fisso rende l'assistenza medica più prevedibile\./gi,"Un consulto scritto costa 30 euro, senza abbonamento né rinnovo automatico.")
   .replace(/Un abbonamento annuale a prezzo fisso, senza bisogno di coperture assicurative\./gi,"Un consulto scritto a 30 euro, senza abbonamento né coperture assicurative obbligatorie.");
 if(path==="medico-online-whatsapp/index.html")
  t=t.replace(/Attivi l'abbonamento e scrivi il tuo caso/gi,"Paghi 30 euro per un consulto scritto e descrivi il tuo caso");
 if(path==="medico-online/index.html")
  t=t.replace(/Con Medico Subito il modello è un abbonamento mensile a consulti multipli, pensato per chi ha bisogno di continuità nel tempo, non solo di una risposta isolata\./gi,"Con Medico Subito paghi 30 euro per una richiesta medica scritta, senza abbonamento e senza rinnovo automatico.");
 if(path==="per-agenzie-partner/index.html")
  t=t.replace(/del valore di ogni abbonamento/gi,"del valore di ogni consulto acquistato")
   .replace(/Su un pagamento di €30 per singolo consulto, corrispondono a €4,50 al mese per ogni assistito che si iscrive tramite la vostra segnalazione, secondo le condizioni dell'accordo di collaborazione\./gi,"Su un consulto pagato 30 euro, il 30% corrisponde a 9 euro di commissione per ogni acquisto attribuito alla vostra segnalazione, secondo il contratto di partnership.")
   .replace(/Vi riconosciamo il 30% di commissione ogni mese, finché l'assistito resta abbonato\./gi,"Vi riconosciamo il 30% di commissione sui consulti effettivamente acquistati tramite la vostra segnalazione, secondo l'accordo.")
   .replace(/La commissione del 30% si applica ogni mese, finché l'assistito segnalato da voi resta abbonato attivamente al servizio\./gi,"La commissione del 30% si riferisce ai singoli consulti acquistati e attribuiti alla vostra segnalazione, secondo il contratto di partnership.")
   .replace(/€4,50\s+al mese/gi,"€9 per consulto");
 if(path==="index.html")
  t=t.replace(/Non sei ancora abbonato\?/gi,"Devi ancora acquistare il consulto?")
   .replace(/Confronto tra pagamento a consulto singolo e abbonamento annuale\./gi,"Come funziona il consulto singolo: 30 euro senza abbonamento.")
   .replace(/Tempi di risposta e vantaggi dell'abbonamento annuale\./gi,"Tempi di risposta e vantaggi del consulto scritto individuale.")
   .replace(/Quanto costano davvero visite, consulti singoli e abbonamenti a confronto\./gi,"Quanto costano davvero visite e consulti singoli a confronto.")
   .replace(/Come recuperare il 19% del costo dell'abbonamento nella dichiarazione dei redditi\./gi,"Quando e come possono essere detratte le spese per un consulto medico scritto.")
   .replace(/<!-- ABBONAMENTO -->/g,"<!-- CONSULTAZIONE A PAGAMENTO SINGOLO -->");
 if(t!==before){fs.writeFileSync(path,t);changed++;}
}
const stale=[];
for(const path of all){
 if(path==="aziende/index.html"||path==="per-farmacie-partner/index.html")continue;
 const s=fs.readFileSync(path,"utf8");
 if(/€\s*(?:15|150)\b|&euro;\s*(?:15|150)\b|centocinquanta euro|quindici euro|più richieste per te|per month,\s*unlimited requests/i.test(s))stale.push(path);
}
console.log(JSON.stringify({htmlFiles:all.length,updated:changed,stale}));
if(stale.length)process.exitCode=1;
