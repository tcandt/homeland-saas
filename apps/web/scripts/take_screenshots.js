const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const breakpoints = [
  { width: 375, height: 812, name: 'iphone_13_mini' },
  { width: 390, height: 844, name: 'iphone_14' },
  { width: 414, height: 896, name: 'iphone_11_pro_max' },
  { width: 430, height: 932, name: 'iphone_14_pro_max' },
  { width: 768, height: 1024, name: 'ipad_mini' }
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  for (const bp of breakpoints) {
    console.log(`Testing ${bp.name} (${bp.width}x${bp.height})`);
    const context = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    
    // 1. Building List
    await page.goto('http://localhost:3000/buildings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `scripts/screenshots/${bp.name}_1_building_list.png`, fullPage: false });

    // 2. Building expanded
    await page.click('text=LK01.31'); // assuming first building name or just click the first building card
    await page.waitForTimeout(500);
    await page.screenshot({ path: `scripts/screenshots/${bp.name}_2_building_expanded.png`, fullPage: false });

    // 3. Floor expanded
    await page.click('text=Tầng 1');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `scripts/screenshots/${bp.name}_3_floor_expanded.png`, fullPage: false });

    // 4. Room Detail Overview (P.101)
    await page.click('text=P.101');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `scripts/screenshots/${bp.name}_4_room_detail.png`, fullPage: false });

    // Close modal
    await page.click('button:has(svg.lucide-x)'); // The X button
    await page.waitForTimeout(500);

    // 5. Shared room example (P.103 or find one with "khách ghép")
    try {
      const sharedRoom = await page.locator('text=khách ghép').first();
      if (await sharedRoom.isVisible()) {
        await sharedRoom.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: `scripts/screenshots/${bp.name}_5_shared_room.png`, fullPage: false });
      }
    } catch(e) {
      console.log('No shared room found');
    }
    
    await context.close();
  }
  
  await browser.close();
  console.log('Screenshots completed!');
}

if (!fs.existsSync('scripts/screenshots')){
    fs.mkdirSync('scripts/screenshots', { recursive: true });
}

run().catch(console.error);
