import { timingSafeEqual, createHash } from "node:crypto";
const attempts = new Map();
export default function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).end();}
  const secret=process.env.DOC_PASSWORD;
  if(!secret)return res.status(503).end();
  const now=Date.now(),ip=String(req.headers["x-forwarded-for"]||"unknown").split(",")[0].trim();
  for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
  const entry=attempts.get(ip)||{count:0,until:now+60000};
  if(entry.count>=10)return res.status(429).end();
  const auth=String(req.headers.authorization||"");
  const expected="Bearer "+secret;
  const hash=s=>createHash("sha256").update(s).digest();
  if(!timingSafeEqual(hash(auth),hash(expected))){
    if(attempts.size<10000||attempts.has(ip)){entry.count++;attempts.set(ip,entry);}
    return res.status(401).end();
  }
  attempts.delete(ip);
  return res.status(204).end();
}
