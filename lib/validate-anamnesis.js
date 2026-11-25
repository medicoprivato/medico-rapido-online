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
  for(const [key,label] of [["allergies","allergie"],["medications","farmaci"],["conditions","patologie"]]){
    const a=body?.anamnesis?.[key];if(!a||!["yes","no"].includes(a.answer)||(a.answer==="yes"&&!String(a.detail||"").trim()))return "Completa la domanda su "+label+".";
  }
  return null;
}
