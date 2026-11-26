import fs from 'node:fs';
import path from 'node:path';

// Normalize service promises only, never general clinical timings or advice.
// The sitemap is the authoritative set of public landing pages and guides.
const root=process.cwd();
const site='https://www.medicosubitoitalia.com';
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const urls=[...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]))];
let checked=0,changed=0,notices=0;
const unresolved=[],missing=[];
function normalize(html,lang){
  const original=html;
  if(lang==='it'){
    const replacements=[
      [/((?:risposta|risponde|risponderà|valutazione|parere)(?:\s+(?:medic[ao]|individuale|scritt[ao]|firmat[ao]|per iscritto|via email)){0,4})\s*,?\s*(?:(?:normalmente|di solito|generalmente)\s+)?entro 24 ore(?!\s+(?:dalla|dal|dall['’]|su 24))/gi,'$1 entro 24 ore dalla ricezione della richiesta completa'],
      [/((?:risposta|risponde|risponderà|valutazione|parere)(?:\s+(?:medic[ao]|individuale|scritt[ao]|firmat[ao]|per iscritto|via email)){0,4})\s+(?:normalmente\s+)?entro 24 ore\s+(?:dal pagamento|dall['’]acquisto|dall['’]invio della richiesta|dalla data del pagamento)/gi,'$1 entro 24 ore dalla ricezione della richiesta completa'],
      [/risposta\s+normalmente\s+entro 24 ore/gi,'Risposta entro 24 ore dalla ricezione della richiesta completa'],
      [/Su richiesta, è possibile anche un breve teleconsulto telefonico \(max 15 minuti\), incluso nel prezzo/gi,'Il servizio è esclusivamente scritto, senza telefonate o videochiamate.'],
      [/Niente prenotazione fissa, teleconsulto al bisogno/gi,'Nessuna prenotazione, consulto esclusivamente scritto'],
      [/Il medico valuta online e prescrive lo sciroppo o la terapia adatta in 24 ore/gi,'Il medico valuta la richiesta entro 24 ore dalla ricezione della richiesta completa e, se clinicamente appropriato, indica la terapia'],
      [/il medico valuta i sintomi e indica la terapia più adatta in 24 ore/gi,'il medico valuta i sintomi entro 24 ore dalla ricezione della richiesta completa e indica la terapia se clinicamente appropriata'],
      [/ricevi una prescrizione entro 24 ore/gi,'ricevi la valutazione entro 24 ore dalla ricezione della richiesta completa, con eventuale prescrizione se clinicamente appropriata'],
      [/ricevi una ricetta privata firmata entro 24 ore/gi,'ricevi una valutazione entro 24 ore dalla ricezione della richiesta completa, con eventuale prescrizione privata'],
      [/ti manda la prescrizione in PDF entro 24 ore/gi,'risponde entro 24 ore dalla ricezione della richiesta completa e rilascia la prescrizione in PDF solo se clinicamente appropriata'],
      [/la ricevi in PDF entro 24 ore/gi,'ricevi una valutazione entro 24 ore dalla ricezione della richiesta completa e l’eventuale documento in PDF'],
      [/Ricetta bianca online in 24 ore con teleconsulto al bisogno/gi,'Ricetta bianca online: valutazione medica scritta'],
      [/Ricetta bianca online in 24 ore/gi,'Ricetta bianca online: valutazione medica scritta'],
      [/Certificato medico online privato in 24 ore/gi,'Certificato medico online privato: valutazione medica'],
      [/con prescrizione scritta entro 24 ore/gi,'con valutazione scritta entro 24 ore dalla ricezione della richiesta completa'],
      [/((?:prescrizione|ricetta)\s+(?:è\s+)?garantita)(?=[<.,;!?]|$)/gi,(m)=>m]
    ];
    // Keep clinical statements and negations intact. Exact obsolete marketing phrases
    // are replaced wherever present in visible copy, metadata, or FAQ structured data.
    for(const [pattern,replacement] of replacements)html=html.replace(pattern,replacement);
  }else if(lang==='en'){
    html=html.replace(/((?:written (?:response|assessment|consultation)|(?:doctor|physician) (?:responds|replies))(?:\s*,)?)\s*(?:normally\s+|usually\s+)?within 24 hours(?!\s+of)/gi,'$1 within 24 hours of receiving the complete request');
  }else if(lang==='es'){
    html=html.replace(/((?:respuesta|valoración|consulta)(?:\s+(?:médica|escrita|por escrito)){0,3})\s*,?\s*(?:normalmente\s+)?en 24 horas(?!\s+(?:desde|tras|siguientes))/gi,'$1 en las 24 horas siguientes a la recepción de la solicitud completa');
  }
  return {html,changed:original!==html};
}
const copy={
 it:'<strong>Condizioni del consulto medico:</strong> 30 € per richiesta. Risposta entro 24 ore dalla ricezione della richiesta completa, anche nei festivi. Il pagamento riguarda la valutazione professionale, non l’acquisto di una ricetta. Prescrizioni e certificati vengono rilasciati solo se clinicamente appropriati. Servizio esclusivamente scritto, senza telefonate o videochiamate. <a href="/#s-termini" style="color:#0D4F5C;text-decoration:underline;font-weight:700">Condizioni del servizio e rimborsi</a>.',
 en:'<strong>Consultation terms:</strong> €30 per request. Written response within 24 hours of receiving the complete request, including holidays. Payment covers the medical assessment, not the purchase of a prescription. Prescriptions and certificates are issued only when clinically appropriate. No telephone or video calls. <a href="/#s-termini" style="color:#0D4F5C;text-decoration:underline;font-weight:700">Service and refund terms (Italian)</a>.',
 es:'<strong>Condiciones de la consulta:</strong> 30 € por solicitud. Respuesta escrita en las 24 horas siguientes a la recepción de la solicitud completa, incluidos festivos. El pago corresponde a la valoración médica, no a la compra de una receta. Solo se emiten recetas y certificados cuando son clínicamente apropiados. Sin llamadas ni videollamadas. <a href="/#s-termini" style="color:#0D4F5C;text-decoration:underline;font-weight:700">Condiciones del servicio y reembolsos (italiano)</a>.'
};
for(const url of urls){
  const u=new URL(url);
  if(u.origin!==site)continue;
  const slug=u.pathname.replace(/^\/|\/$/g,'');
  if(!slug)continue; // Main app and checkout remain unchanged.
  if(!/^[a-zA-Z0-9/_-]+$/.test(slug))continue;
  const candidates=[path.join(root,slug,'index.html'),path.join(root,slug+'.html')];
  const file=candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  if(!file){missing.push(slug);continue;}
  const before=fs.readFileSync(file,'utf8');
  const lang=(before.match(/<html\b[^>]*\blang=["'](it|en|es)(?:-[a-z]+)?["']/i)?.[1]||'it').toLowerCase();
  let {html}=normalize(before,lang);
  checked++;
  // Add one consistent explanation before the footer on every guide/landing page.
  if(!html.includes('id="ms-consult-conditions"')&&/<\/body>/i.test(html)){
    const notice='<aside id="ms-consult-conditions" style="box-sizing:border-box;max-width:850px;margin:18px auto;padding:14px 18px;border:1px solid #B2E0DC;border-radius:12px;background:#f0faf8;color:#123b46;font:14px/1.6 system-ui,sans-serif">'+copy[lang]+'</aside>';
    if(/<footer\b/i.test(html))html=html.replace(/<footer\b/i,notice+'<footer');
    else if(/<div\b[^>]*class=["']footer["']/i.test(html))html=html.replace(/<div\b[^>]*class=["']footer["']/i,m=>notice+m);
    else html=html.replace(/<\/body>/i,notice+'</body>');
    notices++;
  }
  // Flag remaining suspicious copy for manual review rather than rewriting clinical text.
  const flags=[];
  for(const match of html.matchAll(/[^<>"\n]{0,65}(?:normalmente\s+entro 24 ore|di solito\s+entro 24 ore|24 ore\s+dal pagamento|24 ore\s+dall['’]acquisto|teleconsulto telefonico|15 minuti|ricetta garantita|prescrizione garantita|non rimborsabile)[^<>"\n]{0,65}/gi)){
    const snippet=match[0].trim();
    if(!/(?:non (?:è |sono )?garantit|nessuna|senza telefonate|non è possibile|non prevede)/i.test(snippet))flags.push(snippet);
  }
  if(flags.length)unresolved.push({page:slug,flags:[...new Set(flags)].slice(0,5)});
  if(html!==before){fs.writeFileSync(file,html);changed++;}
}
console.log('MEDICO_SUBITO_COPY_AUDIT '+JSON.stringify({sitemap:urls.length,checked,changed,notices,missing,review:unresolved}));
