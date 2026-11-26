export function validateAnamnesis(body) {
  const name=String(body?.patientName||"").trim();
  if(name.split(/\s+/).length<2)return "Nome e cognome obbligatori.";
  if(!String(body?.patientText||"").trim())return "Descrivi la richiesta clinica.";
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(body?.dateOfBirth||""));
  if(!match)return "Data di nascita obbligatoria.";
  const y=+match[1],m=+match[2],d=+match[3],b=new Date(Date.UTC(y,m-1,d)),now=new Date();
  if(b.getUTCFullYear()!==y||b.getUTCMonth()!==m-1||b.getUTCDate()!==d||b>now)return "Data di nascita non valida.";
  let age=now.getUTCFullYear()-y;if(now.getUTCMonth()<m-1||(now.getUTCMonth()===m-1&&now.getUTCDate()<d))age--;
  if(age<18||age>125)return "Il servizio è riservato agli adulti.";
  if(body?.adultDeclaration!==true)return "Dichiarazione di maggiore età e veridicità obbligatoria.";
  if(typeof body?.noItalianCF!=="boolean")return "Indica se possiedi un codice fiscale italiano.";
  const cf=String(body?.codiceFiscale||"").trim().toUpperCase().replace(/\s+/g,"");
  const country=String(body?.birthCountry||"").trim();
  if(body.noItalianCF){if(cf||!country||country.length>100)return "Indica il Paese di nascita in assenza di codice fiscale italiano.";}
  else if(!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf))return "Codice fiscale non valido.";
  for(const [key,label] of [["allergies","allergie"],["medications","farmaci"],["conditions","patologie"]]){
    const a=body?.anamnesis?.[key];if(!a||!["yes","no"].includes(a.answer)||(a.answer==="yes"&&!String(a.detail||"").trim()))return "Completa la domanda su "+label+".";
  }
  const reproductive=body?.anamnesis?.reproductiveStatus;
  const allowed=["no","pregnancy","breastfeeding","not_applicable","unknown"];
  if(!Array.isArray(reproductive)||reproductive.some(x=>!allowed.includes(x))||new Set(reproductive).size!==reproductive.length||(reproductive.length>1&&reproductive.some(x=>!["pregnancy","breastfeeding"].includes(x))))return "Risposta gravidanza/allattamento non valida.";
  return null;
}

export function identityDeclarationNotes(body) {
  const country=String(body.birthCountry||"").trim().replace(/[\r\n|<>]/g," ");
  return [body.noItalianCF?"Codice fiscale italiano non posseduto; Paese di nascita: "+country:"Codice fiscale italiano dichiarato", "Dichiarazione di maggiore età e veridicità dei dati: confermata il "+new Date().toISOString()].join(" | ");
}
