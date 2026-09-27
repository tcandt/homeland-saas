// Read-only browser checks plus screenshots in maps/qa-lifecycle/.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.join(__dirname,'maps.html')).href;
  const output=path.join(__dirname,'qa-lifecycle');fs.mkdirSync(output,{recursive:true});
  const measurements=[];const textOverflow=[];
  for(const [width,height] of [[1440,900],[1600,1000],[1920,1080],[2048,1320],[390,844]]){
    await page.setViewportSize({width,height});await page.goto(url);await page.waitForSelector('#diagram .node');
    measurements.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,nodes:document.querySelectorAll('.node').length})));
    await page.screenshot({path:path.join(output,`overview-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});
  for(const chapter of await page.evaluate(()=>HOMELAND_LIFECYCLE.chapters.map(c=>c.id))){
    await page.goto(url+'#'+chapter);await page.waitForFunction(c=>document.querySelector('.nav-item[aria-current="step"]')&&location.hash==='#'+c,chapter);
    const ids=await page.locator('.node').evaluateAll(nodes=>nodes.map(n=>n.dataset.node));
    textOverflow.push(...await page.locator('.node').evaluateAll(nodes=>nodes.flatMap(n=>{const w=Number(n.querySelector('rect').getAttribute('width'));return [...n.querySelectorAll('text')].filter(t=>t.getBBox().x+t.getBBox().width>w-5).map(t=>({id:n.dataset.node,text:t.textContent}));})));
    for(const id of ids){await page.locator(`[data-node="${id}"]`).click();await page.waitForFunction(id=>location.hash.endsWith('/'+id),id);if(!await page.locator('#detail-title').innerText())throw new Error('Missing detail');}
  }
  await page.goto(url+'#expenses/draft');await page.locator('#search').fill('EXP01');await page.locator('#results button').first().click();
  if(!page.url().includes('#expenses/draft'))throw new Error('Search selection failed');
  await page.locator('#issues-toggle').click();
  if(await page.locator('#issues-toggle').getAttribute('aria-pressed')!=='true')throw new Error('Issue filter toggle failed');
  if(await page.locator('.node.error,.node.gap,.node.review').count()!==0)throw new Error('Unresolved map issue remains');
  await page.locator('#theme').click();await page.screenshot({path:path.join(output,'expenses-dark.png'),fullPage:true});
  await page.reload();if(await page.locator('html').getAttribute('data-theme')!=='dark')throw new Error('Theme not persisted');
  await page.goto(url+'#settlement');await page.screenshot({path:path.join(output,'settlement-dark.png'),fullPage:true});
  await page.goto(url+'#tenants');await page.locator('[data-node="capture"]').focus();await page.keyboard.press('Enter');await page.waitForTimeout(50);if(await page.evaluate(()=>document.activeElement?.getAttribute('data-node'))!=='capture')throw new Error('Keyboard focus lost');
  const chapterCount=await page.evaluate(()=>HOMELAND_LIFECYCLE.chapters.length);
  const summary={measurements,errors,textOverflow,chapters:chapterCount,interactionChecks:'all node clicks, chapter deep links, keyboard activation, search, issue highlight, theme persistence'};
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));await browser.close();
  if(errors.length||textOverflow.length||measurements.some(m=>m.scrollWidth>m.width))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
