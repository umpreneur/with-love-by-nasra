import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{validateRequest} from '../dist/server/index.js';
import {catalog} from '../public/catalog.js';
const origin='https://nasra.test';
const good=(overrides={})=>({request_id:crypto.randomUUID(),naam:'Test Klant',email:'test@example.test',telefoon:'+31 6 12345678',contactvoorkeur:'E-mail',categorie:'Kaarten',product:'Geboortekaart',gelegenheid:'Geboorte',aantal:'20',kleuren:'Crème & matgoud',taal:'Nederlands',datum:'',wensen:'Een kaart met een matte afwerking.',website:'',...overrides});
function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync('drizzle/0000_requests.sql','utf8'));
 return {
  sql,
  prepare(query){
   return {
    bind(...args){
     return {
      first:async()=>sql.prepare(query).get(...args)||null,
      all:async()=>({results:sql.prepare(query).all(...args)}),
      run:async()=>sql.prepare(query).run(...args)
     };
    }
   };
  }
 };
}
function post(data,headers={}){return new Request(origin+'/api/aanvragen',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});}
test('Geboortekaart cannot be combined with a wedding, in client catalog and server validation',()=>{assert.deepEqual(catalog.Kaarten.Geboortekaart,['Geboorte']);assert.ok(validateRequest(good({gelegenheid:'Bruiloft / Nikah'})).error);assert.ok(validateRequest(good()).data);});
test('Cadeautjes are a separate category; birthday cards are absent',()=>{assert.ok(catalog.Cadeautjes);assert.ok(!Object.keys(catalog.Kaarten).includes('Verjaardagskaart'));assert.ok(validateRequest(good({categorie:'Cadeautjes',product:'Cadeautjes',gelegenheid:'Verjaardag'})).data);});
test('Every allowed category/product/occasion combination validates',()=>{for(const [categorie,products] of Object.entries(catalog))for(const [product,occasions] of Object.entries(products))for(const gelegenheid of occasions)assert.ok(validateRequest(good({categorie,product,gelegenheid})).data,product+' '+gelegenheid);});
test('Customer contact details and quantities are required and validated',()=>{for(const override of [{naam:''},{email:''},{email:'not-an-email'},{telefoon:''},{telefoon:'letters123'},{aantal:'0'},{aantal:'1.5'},{datum:'2026-02-31'},{contactvoorkeur:'unknown'},{categorie:'__proto__'}])assert.ok(validateRequest(good(override)).error,JSON.stringify(override));});
test('An accepted request is durably inserted, with a safe acknowledgement and idempotent retry',async()=>{const DB=database(),data=good();const res=await worker.fetch(post(data),{DB});assert.equal(res.status,201);assert.deepEqual(await res.json(),{ok:true});const row=DB.sql.prepare('SELECT * FROM requests').get();assert.equal(row.name,data.naam);assert.equal(row.phone,data.telefoon);assert.equal(row.email,data.email);const retry=await worker.fetch(post(data),{DB});assert.equal(retry.status,200);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM requests').get().n,1);DB.sql.close();});
test('Cross-origin submissions, malformed requests, and invalid category pairs never write data',async()=>{const DB=database();assert.equal((await worker.fetch(post(good(),{Origin:'https://other.test'}),{DB})).status,403);assert.equal((await worker.fetch(post(good({gelegenheid:'Bruiloft / Nikah'})),{DB})).status,400);assert.equal((await worker.fetch(post(good({website:'spam'})),{DB})).status,400);assert.equal(DB.sql.prepare('SELECT COUNT(*) AS n FROM requests').get().n,0);DB.sql.close();});
test('A failed or unavailable database does not acknowledge success',async()=>{assert.equal((await worker.fetch(post(good()),{})).status,503);const DB={prepare(){throw Error('database unavailable');}};const res=await worker.fetch(post(good()),{DB});assert.equal(res.status,503);assert.ok(!(await res.json()).ok);});
test('Contact information is visible only to the configured owner, not another visitor',async()=>{const DB=database(),env={DB,ADMIN_EMAIL:'owner@example.test'};await worker.fetch(post(good()),env);const endpoint=origin+'/api/admin/aanvragen';assert.equal((await worker.fetch(new Request(endpoint),env)).status,403);assert.equal((await worker.fetch(new Request(endpoint,{headers:{'oai-authenticated-user-email':'other@example.test'}}),env)).status,403);const owner=await worker.fetch(new Request(endpoint,{headers:{'oai-authenticated-user-email':'owner@example.test'}}),env);assert.equal(owner.status,200);assert.equal((await owner.json()).requests.length,1);assert.equal((await worker.fetch(new Request(origin+'/beheer.html'),env)).status,302);assert.equal((await worker.fetch(new Request(origin+'/beheer',{headers:{'oai-authenticated-user-email':'other@example.test'}}),env)).status,403);DB.sql.close();});
test('The website, images and form module are served from the same Worker',async()=>{for(const path of ['/','/app.js','/catalog.js','/style.css','/assets/gold-collection.webp','/assets/cadeautjes.webp'])assert.equal((await worker.fetch(new Request(origin+path),{})).status,200,path);const body=await (await worker.fetch(new Request(origin),{})).text();assert.ok(body.includes('WITH LOVE'));assert.ok(body.includes('name="email"'));assert.ok(body.includes('name="telefoon"'));assert.ok(!body.includes('Verjaardagskaart'));assert.ok(!body.includes('Kopieer mijn aanvraag'));});
