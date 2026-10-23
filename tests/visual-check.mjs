import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const site = process.env.SITE_URL || 'http://127.0.0.1:8765/';
const dir = 'test-results';
await mkdir(dir,{recursive:true});
const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
const failures = [];
async function run(name, fn) {
  try { await fn(); console.log('PASS',name); }
  catch(e) {failures.push({name,error:e.stack||String(e)});console.error('FAIL',name,e.message);}
}

const desktop = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];
desktop.on('pageerror',e=>errors.push(e.message));
await desktop.goto(site,{waitUntil:'domcontentloaded'});
await desktop.waitForTimeout(3400);

await run('Marca y portada personalizada',async()=>{
  assert.match(await desktop.title(),/Linares Mendoza/);
  assert.match(await desktop.locator('h1').innerText(),/Construimos/);
  assert.equal(await desktop.locator('a[href*="595975968600"]').count()>0,true);
  assert.equal(await desktop.locator('body').innerText().then(s=>s.includes('OHANA')),false);
  assert.equal(errors.length,0,errors.join('; '));
});
await run('La apertura no bloquea navegación',async()=>{
  assert.equal(await desktop.locator('#intro').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  await desktop.locator('a.nav-cta').click();
  assert.equal(await desktop.evaluate(()=>location.hash),'#contacto');
});
await run('La galería interactiva cambia el concepto',async()=>{
  await desktop.locator('[data-vision="1"]').click();
  await desktop.waitForTimeout(1500);
  assert.match(await desktop.locator('#visionTitle').innerText(),/Interiores/);
  assert.equal(await desktop.locator('[data-vision="1"]').getAttribute('aria-selected'),'true');
});
await run('El formulario prepara consulta por WhatsApp',async()=>{
  await desktop.locator('#fullName').fill('Cliente de ensayo');
  await desktop.locator('#projectType').selectOption({label:'Obra civil'});
  await desktop.locator('#location').fill('Asunción');
  await desktop.evaluate(()=>{window.__sent='';window.open=(url)=>{window.__sent=url;return {}}});
  await desktop.locator('#quoteForm button[type="submit"]').click();
  const url=await desktop.evaluate(()=>window.__sent);
  assert.match(url,/wa\.me\/595975968600/);
  assert.match(decodeURIComponent(url),/Cliente de ensayo/);
  assert.match(decodeURIComponent(url),/Obra civil/);
});
await desktop.goto(site,{waitUntil:'domcontentloaded'});
await desktop.waitForTimeout(3300);
await desktop.screenshot({path:dir+'/desktop.png',fullPage:true,animations:'disabled'});

const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
mobile.on('pageerror',e=>errors.push('mobile:'+e.message));
await mobile.goto(site,{waitUntil:'domcontentloaded'});
await mobile.waitForTimeout(3300);
await run('Móvil sin desplazamiento lateral',async()=>{
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),true);
});
await run('Menú móvil accesible y operable',async()=>{
  await mobile.locator('#menuToggle').click();
  assert.equal(await mobile.locator('#menuToggle').getAttribute('aria-expanded'),'true');
  await mobile.locator('#navItems a[href="#servicios"]').click();
  assert.equal(await mobile.locator('#menuToggle').getAttribute('aria-expanded'),'false');
  assert.equal(await mobile.evaluate(()=>location.hash),'#servicios');
});
await mobile.goto(site,{waitUntil:'domcontentloaded'});
await mobile.waitForTimeout(3300);
await mobile.screenshot({path:dir+'/mobile.png',fullPage:true,animations:'disabled'});
await run('Sin errores JavaScript',async()=>assert.deepEqual(errors,[]));
await browser.close();
if(failures.length) {console.error(JSON.stringify(failures,null,2));process.exitCode=1}
else console.log('OK 7 pruebas de navegación y capturas realizadas.');
