import { createHash, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { validateAnamnesis } from "../lib/validate-anamnesis.js";

const keyHash=Buffer.from("9f0718e43b32b34b2b881a57ad8d0cf77142876ebb013cdf6bd4f518be67b7c0","hex");
const recipient="abolzon05@gmail.com";
const recent=[];
let inFlight=false;
const clean=(value,limit=1000)=>String(value||"").trim().slice(0,limit);
const escapeHtml=value=>clean(value,8000).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
const answer=value=>value?.answer==="no"?"Nessuno/a":clean(value?.detail,1500);
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, private");
  if(req.method!=="POST")return res.status(405).json({error:"Metodo non consentito."});
  const body=req.body||{};
  const hash=createHash("sha256").update(clean(body.previewKey,200).toLowerCase()).digest();
  if(!timingSafeEqual(hash,keyHash))return res.status(401).json({error:"Accesso di prova non autorizzato."});
  const validation=validateAnamnesis(body);
  if(validation)return res.status(400).json({error:validation});
  if(body.consenso!==true||body.teleConsenso!==true||body.esecConsenso!==true)return res.status(400).json({error:"Completa i consensi."});
  const now=Date.now();
  while(recent.length&&recent[0]<now-3600000)recent.shift();
  if(inFlight||recent.length>=5)return res.status(429).json({error:"Limite temporaneo degli invii di prova raggiunto."});
  if(!process.env.GMAIL_USER||!process.env.GMAIL_APP_PASSWORD)return res.status(503).json({error:"Invio email non configurato."});
  recent.push(now);inFlight=true;
  try{
    const mail=nodemailer.createTransport({service:"gmail",auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD}});
    const from="Medico Subito <"+process.env.GMAIL_USER+">";
    const name=escapeHtml(body.patientName);
    await mail.sendMail({from,to:recipient,subject:"[TEST] Medico Subito - richiesta ricevuta",html:"<p>Gentile "+name+", la tua richiesta è stata ricevuta. Un medico la valuterà e risponderà entro 24 ore.</p><p>Per le emergenze chiama il 118.</p><hr><p><strong>Simulazione:</strong> nessuna prestazione sanitaria, nessun addebito.</p>"});
    let summarySent=false;
    try{
      const repro=(body.anamnesis.reproductiveStatus||[]).map(x=>({no:"No",pregnancy:"Gravidanza",breastfeeding:"Allattamento",not_applicable:"Non applicabile",unknown:"Non so / possibile gravidanza"})[x]).join(", ")||"Non indicato";
      const rows=[["Nome e cognome",body.patientName],["Data di nascita",body.dateOfBirth],["Codice fiscale",body.noItalianCF?"Non posseduto":body.codiceFiscale],["Paese di nascita",body.noItalianCF?body.birthCountry:"Non richiesto"],["Email di ricezione",recipient],["Telefono",body.phone],["Tipo di richiesta",body.tipo],["Motivo della richiesta",body.patientText],["Allergie",answer(body.anamnesis.allergies)],["Farmaci",answer(body.anamnesis.medications)],["Patologie",answer(body.anamnesis.conditions)],["Gravidanza/allattamento",repro],["Consensi e dichiarazione maggiore età","Confermati"],["Archivio digitale",body.archivioReferti===true?"Sì":"No"]];
      await mail.sendMail({from,to:recipient,subject:"[TEST] Medico Subito - riepilogo richiesta di prova",html:"<h2>Richiesta di prova, non clinica</h2><p>Nessun pagamento e nessun caso registrato. Solo dati fittizi inseriti durante la simulazione.</p>"+rows.map(([label,value])=>"<p><strong>"+escapeHtml(label)+":</strong> "+escapeHtml(value)+"</p>").join("")});
      summarySent=true;
    }catch(error){/* No clinical data or credentials in logs. */}
    return res.status(200).json({ok:true,summarySent});
  }catch(error){return res.status(503).json({error:"Non è stato possibile inviare la conferma di prova. Nessun addebito."});}
  finally{inFlight=false;}
}
