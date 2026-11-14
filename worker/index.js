import {catalog,colors,languages} from '../public/catalog.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function validateRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Controleer je aanvraag.'};
 const data={};
 for(const [key,max] of Object.entries({request_id:36,naam:100,email:254,telefoon:30,contactvoorkeur:20,categorie:40,product:60,gelegenheid:40,kleuren:40,taal:30,datum:10,wensen:2500,website:200})){
  if(input[key]!=null&&typeof input[key]!=='string')return {error:'Controleer je ingevulde gegevens.'};
  data[key]=(input[key]||'').trim();if(data[key].length>max)return {error:'Een ingevuld veld is te lang.'};
 }
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.request_id))return {error:'Vernieuw de pagina en probeer het opnieuw.'};
 if(data.website)return {error:'Je aanvraag kon niet worden verstuurd.'};
 if(data.naam.length<2)return {error:'Vul je voor- en achternaam in.'};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return {error:'Vul een geldig e-mailadres in.'};
 if(!/^[+\d\s().-]+$/.test(data.telefoon)||data.telefoon.replace(/\D/g,'').length<7||data.telefoon.replace(/\D/g,'').length>15)return {error:'Vul een geldig telefoonnummer in.'};
 if(!['E-mail','Telefoon'].includes(data.contactvoorkeur))return {error:'Kies hoe ik contact met je mag opnemen.'};
 if(!Object.hasOwn(catalog,data.categorie)||!Object.hasOwn(catalog[data.categorie],data.product)||!catalog[data.categorie][data.product].includes(data.gelegenheid))return {error:'Deze combinatie van product en gelegenheid klopt niet. Controleer je keuze.'};
 data.aantal=Number(input.aantal);if(!Number.isInteger(data.aantal)||data.aantal<1||data.aantal>10000)return {error:'Vul een geldig aantal in.'};
 if(!colors.includes(data.kleuren)||!languages.includes(data.taal))return {error:'Controleer je kleuren en taal.'};
 if(data.datum){if(!/^\d{4}-\d{2}-\d{2}$/.test(data.datum))return {error:'Vul een geldige datum in.'};const date=new Date(data.datum+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==data.datum||data.datum<new Date(Date.now()-86400000).toISOString().slice(0,10))return {error:'Kies een geldige datum in de toekomst.'};}
 data.email=data.email.toLowerCase();return {data};
}
function isOwner(request,env){const email=request.headers.get('oai-authenticated-user-email');return !!env.ADMIN_EMAIL&&!!email&&email.trim().toLowerCase()===env.ADMIN_EMAIL.trim().toLowerCase();}
function asset(path,request,privatePage=false){const item=ASSETS[path];if(!item)return new Response('Niet gevonden',{status:404});const body=Uint8Array.from(atob(item.body),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':item.type,'Cache-Control':privatePage?'no-store':path.startsWith('/assets/')?'public, max-age=3600':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN'}});}
export default {async fetch(request,env){
 const url=new URL(request.url),p=url.pathname;
 if(p==='/api/aanvragen'){
  if(request.method!=='POST')return json({error:'Gebruik het aanvraagformulier.'},405);
  if(request.headers.get('Origin')!==url.origin)return json({error:'Open het formulier op de website.'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Ongeldig formulier.'},415);
  if(Number(request.headers.get('Content-Length')||0)>16000)return json({error:'Je aanvraag is te groot.'},413);
  let input;try{const raw=await request.text();if(raw.length>16000)return json({error:'Je aanvraag is te groot.'},413);input=JSON.parse(raw);}catch{return json({error:'Controleer je aanvraag en probeer opnieuw.'},400);}
  const validated=validateRequest(input);if(validated.error)return json({error:validated.error},400);const d=validated.data;
  if(!env.DB)return json({error:'Het versturen is tijdelijk niet beschikbaar. Probeer het later opnieuw.'},503);
  try{
   const previous=await env.DB.prepare('SELECT id FROM requests WHERE id = ?').bind(d.request_id).first();if(previous)return json({ok:true});
   const recent=await env.DB.prepare('SELECT COUNT(*) AS total FROM requests WHERE email = ? AND created_at > ?').bind(d.email,new Date(Date.now()-60000).toISOString()).first();if(Number(recent?.total)>4)return json({error:'Je hebt zojuist meerdere aanvragen verstuurd. Probeer het over een minuut opnieuw.'},429);
   await env.DB.prepare('INSERT OR IGNORE INTO requests (id, created_at, name, email, phone, contact_preference, category, product, occasion, quantity, colors, language, desired_date, wishes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(d.request_id,new Date().toISOString(),d.naam,d.email,d.telefoon,d.contactvoorkeur,d.categorie,d.product,d.gelegenheid,d.aantal,d.kleuren,d.taal,d.datum||null,d.wensen).run();
   return json({ok:true},201);
  }catch{return json({error:'Het opslaan is niet gelukt. Je gegevens blijven ingevuld. Probeer het opnieuw.'},503);}
 }
 if(p==='/api/admin/aanvragen'){
  if(!isOwner(request,env))return json({error:'Alleen toegankelijk voor Nasra.'},403);
  if(request.method!=='GET')return json({error:'Niet toegestaan.'},405);
  if(!env.DB)return json({error:'Aanvragen zijn tijdelijk niet beschikbaar.'},503);
  try{const before=url.searchParams.get('before'),limit=30;let result;if(before){if(!/^\d{4}-\d{2}-\d{2}T/.test(before)||before.length>30)return json({error:'Ongeldige paginering.'},400);result=await env.DB.prepare('SELECT * FROM requests WHERE created_at < ? ORDER BY created_at DESC LIMIT ?').bind(before,limit+1).all();}else result=await env.DB.prepare('SELECT * FROM requests ORDER BY created_at DESC LIMIT ?').bind(limit+1).all();const rows=result.results||[];return json({requests:rows.slice(0,limit),next:rows.length>limit?rows[limit-1].created_at:null});}catch{return json({error:'Aanvragen konden niet worden geladen.'},503);}
 }
 if(p==='/beheer'||p==='/beheer/'||p==='/beheer.html'){
  if(!isOwner(request,env)){if(!request.headers.get('oai-authenticated-user-email'))return Response.redirect(url.origin+'/signin-with-chatgpt?return_to=%2Fbeheer',302);return new Response('Dit overzicht is alleen toegankelijk voor Nasra.',{status:403,headers:{'Cache-Control':'no-store'}});}
  return asset('/beheer.html',request,true);
 }
 if(p.startsWith('/api/'))return json({error:'Niet gevonden.'},404);
 if(!['GET','HEAD'].includes(request.method))return new Response('Niet toegestaan',{status:405});
 return asset(p==='/'?'/index.html':p,request);
}};
