import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  page.on('response', response => {
    if (!response.ok()) {
      console.log('RESPONSE FAILED:', response.url(), response.status());
    }
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    localStorage.setItem('i18nextLng', 'ar');
  });
  
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  
  await page.type('input[name="email"]', 'syndic@test.com');
  await page.type('input[name="password"]', '1234');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  console.log('CURRENT URL:', page.url());
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await browser.close();
})();
