// Opt-in homepage QA. External traffic is blocked; no member or purchase actions are submitted.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const assert = require('node:assert/strict');
const base = process.env.HOMEPAGE_QA_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('Homepage QA is restricted to localhost.');
const out = require('node:path').resolve(process.env.HOMEPAGE_QA_OUTPUT || 'docs/screenshots/homepage-storytelling');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
 const results=[];
 try {
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['narrow-mobile',{width:320,height:740}]]){
   const context=await browser.newContext({viewport,reducedMotion:'reduce'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===base ? route.continue() : route.abort());
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base,{waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Decline',exact:true}).click();
   await page.getByRole('heading',{level:1}).waitFor();
   assert.equal(await page.getByRole('heading',{level:1}).innerText(),'You carry enough. Your health shouldn’t be one more thing you have to figure out.');
   await page.screenshot({path:`${out}/${name}-hero.png`});
   await page.locator('#story').scrollIntoViewIfNeeded();
   const image=page.locator('img[src*="evening-kitchen"]');
   await image.evaluate(img=>img.decode());
   const imageInfo=await image.evaluate(img=>({naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,width:img.width,height:img.height,sizes:img.sizes,loading:img.loading,currentSrc:img.currentSrc}));
   assert.equal(imageInfo.loading,'lazy');assert(imageInfo.naturalWidth>0);assert(Math.abs(imageInfo.width/imageInfo.height-1.5)<0.02);
   await page.screenshot({path:`${out}/${name}-story.png`});
   await page.locator('#founder').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/${name}-founder.png`});
   await page.locator('#community').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/${name}-community.png`});
   const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,overflows:[...document.querySelectorAll('main *')].filter(el=>{const r=el.getBoundingClientRect();return r.width && (r.left < -1 || r.right > innerWidth+1)}).map(el=>({tag:el.tagName,text:el.textContent.slice(0,50)}))}));
   assert.equal(layout.scroll,layout.viewport,JSON.stringify(layout));assert.deepEqual(layout.overflows,[]);
   const auditLinks=await page.locator('[data-homepage-audit-cta] a').evaluateAll(links=>links.map(a=>({href:a.getAttribute('href'),location:a.parentElement.dataset.homepageAuditCta})));
   assert.deepEqual(auditLinks.map(x=>x.href),['/audit','/audit','/audit']);
   for(const loc of ['hero','outcome','final_cta']){
    await page.locator(`[data-homepage-audit-cta="${loc}"] a`).click();await page.waitForURL(`${base}/audit`);await page.getByRole('heading',{level:1}).waitFor();await page.goBack({waitUntil:'networkidle'});
   }
   const how=page.getByRole('link',{name:'See How It Works',exact:true}).first();await how.click();await page.waitForURL(`${base}/#how-it-works`);assert.equal(new URL(page.url()).hash,'#how-it-works');
   await page.getByRole('button',{name:'Open navigation menu'}).click();
   const nav=page.getByRole('navigation',{name:'Main navigation'});await nav.getByRole('link',{name:'Programs',exact:true}).click();await page.waitForURL(`${base}/program`);await page.getByRole('heading',{level:1}).waitFor();await page.goBack({waitUntil:'networkidle'});
   await page.locator('#start').getByRole('link',{name:'Compare support levels'}).click();await page.waitForURL(`${base}/program`);await page.goBack({waitUntil:'networkidle'});
   assert.deepEqual(errors,[],JSON.stringify(errors));
   results.push({name,viewport,layout,imageInfo,auditLinks,pageErrors:errors,checks:['hero visible with reduced motion','story image responsive and lazy','no horizontal overflow including descendants','all three audit CTAs navigate','how-it-works anchor','navigation menu + program destination','closing program CTA']});
   await context.close();
  }
  fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
