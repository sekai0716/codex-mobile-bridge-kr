'use strict';
const {test, expect} = require('@playwright/test');

// 외부 문서 없이 실제 PDF.js 본체·worker·텍스트 레이어의 호환성을 검사한다.
function fixturePdf() {
  const text = 'BT /F1 24 Tf 30 100 Td (PDF regression fixture) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(source.length);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = source.length;
  source += 'xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) source += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return Buffer.from(source + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'ascii');
}

test('vendored PDF.js renders selectable text with its real worker and disposes the reader', async ({page, context, request, baseURL}) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL
    ? route.continue() : route.abort());
  expect(await (await request.get('/__fixture_health')).json()).toEqual({fixture: 'cmb-browser-regression'});
  const document = fixturePdf(), failures = [], workers = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
  await page.route('**/__fixture.pdf*', route => route.fulfill({contentType: 'application/pdf', body: document}));
  await page.goto('/?case=success');
  await page.waitForFunction(() => document.getElementById('bootstrap-status')?.hidden);
  await page.evaluate(async size => {
    await BridgeFeatures.load('files');
    window.pdfReader = BridgePdfPreview.create({url: '/__fixture.pdf?fixture=1', info: {size, clickDownloadMiB: 1}});
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:white';
    pdfReader.element.style.height = '100%';
    host.append(pdfReader.element);
    document.body.append(host);
    await pdfReader.load();
  }, document.length);
  await expect(page.locator('.wb-pdf .textLayer')).toContainText('PDF regression fixture');
  // 텍스트 추출 성공만으로 렌더링 성공을 판단하지 않고 실제 캔버스 픽셀도 확인한다.
  const ink = await page.locator('.wb-pdf canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    for (let index = 0; index < pixels.length; index += 4)
      if (pixels[index + 3] && pixels[index] < 180 && pixels[index + 1] < 180 && pixels[index + 2] < 180) dark++;
    return dark;
  });
  expect(ink).toBeGreaterThan(20);
  // 배포 서버는 버전 태그를 파일 내용 해시로 바꾸므로 worker의 공개 경로를 확인한다.
  expect(workers.some(url => new URL(url).pathname === '/vendor/pdfjs/pdf.worker.min.mjs')).toBe(true);
  expect(await page.evaluate(async () => (await import('/vendor/pdfjs/pdf.min.mjs')).version)).toBe('6.5.438');
  expect(failures).toEqual([]);
  await page.evaluate(() => pdfReader.dispose());
  await expect(page.locator('.wb-pdf canvas')).toHaveCount(0);
});
