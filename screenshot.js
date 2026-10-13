import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/?invite=EDU26-19&ev=ev_internal_1787674161506', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshot.png') });
  await browser.close();
  console.log("Screenshot saved.");
})();
