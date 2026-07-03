const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const breakpoints = [
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'ipad-portrait', width: 768, height: 1024 },
  { name: 'android-tablet', width: 800, height: 1280 },
  { name: 'mobile', width: 390, height: 844 }
];

const urls = [
  { path: '/', name: 'global-dashboard' },
  { path: '/buildings', name: 'building-dashboard' }
];

const outputDir = path.join(__dirname, '..', 'screenshots', 'v7-review');

if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
}

(async () => {
  console.log("🚀 Bắt đầu chụp ảnh các breakpoint V7...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  let reportMd = "# Báo cáo kiểm thử Responsive V7\n\n";

  for (const url of urls) {
    reportMd += `## Trang: ${url.name}\n\n`;
    for (const bp of breakpoints) {
      console.log(`Chụp ${url.name} - ${bp.name}...`);
      await page.setViewport({ width: bp.width, height: bp.height });
      await page.goto(`http://localhost:3000${url.path}`, { waitUntil: 'networkidle0' });
      
      const fileName = `${url.name}-${bp.name}.png`;
      const filePath = path.join(outputDir, fileName);
      await page.screenshot({ path: filePath, fullPage: true });
      
      reportMd += `### ${bp.name} (${bp.width}x${bp.height})\n`;
      reportMd += `![${bp.name}](./${fileName})\n\n`;
    }
  }

  await browser.close();
  
  fs.writeFileSync(path.join(outputDir, 'v7-ui-audit.md'), reportMd);
  console.log("✅ Hoàn thành! File báo cáo lưu tại:", path.join(outputDir, 'v7-ui-audit.md'));
})();
