/* Run in the gateway browser alongside tests/browser/markdown.browser.js. */
(() => {
  const checks = [];
  function check(name, condition) {
    if (!condition) throw Error(name);
    checks.push(name);
  }
  function render(text) {
    const node = document.createElement('div');
    node.className = 'message assistant';
    renderMarkdown(node, text);
    return node;
  }
  const formulas = String.raw`보다 \(V\)，답변 \(p_v(A)\)。

\[
U(q)=H\!\left(\sum_v w_v p_v(A)\right)
-\sum_v w_vH\!\left(p_v(A)\right)
\]

\[
\max I(Z;Y\mid Q)-\beta I(Z;D\mid Q)
\]

업계 내부 $x^2$ 및

$$\frac{a}{b}$$`;
  const node = render(formulas);
  check('bracket and dollar math render', node.querySelectorAll('.katex').length === 6);
  check('display and inline modes', node.querySelectorAll('.katex-display').length === 3);
  check('TeX survives Markdown escapes', node.querySelectorAll('annotation')[2]?.textContent.includes(String.raw`\sum_v w_v p_v(A)`));
  check('fractions have MathML', node.querySelector('mfrac'));
  const adjacent = render(String.raw`양수가 존재함을 증명하려면 실링
\[
S=\{x>0:x^2\le b\},\qquad a=\sup S.
\]
후속 텍스트`);
  check('display math interrupts a paragraph without a blank line', adjacent.querySelectorAll('.katex-display').length === 1);
  check('adjacent display math preserves TeX', adjacent.querySelector('annotation')?.textContent.trim() === String.raw`S=\{x>0:x^2\le b\},\qquad a=\sup S.`);
  check('code and escaped dollars stay literal', !render('`\\(x\\)`\n\n```tex\n\\[x^2\\]\n```\n\n\\$x\\$').querySelector('.katex'));
  check('currency stays text', !render('가격 $20 및 $30，총 $50。').querySelector('.katex'));
  check('plain brackets stay text', render('[이것은 설명입니다]').textContent === '[이것은 설명입니다]');
  const unsafe = render(String.raw`\(\href{javascript:alert(1)}{click}\) \(\includegraphics{https://example.com/track.png}\) \(\htmlStyle{background:url(https://example.com)}{x}\)`);
  check('TeX cannot create links, images or user styles', !unsafe.querySelector('a,img,[style*="example.com"]'));
  const broken = render(String.raw`\[\frac{a}\]`);
  check('invalid formula remains readable', broken.textContent.includes(String.raw`\frac{a}`));
  for (let i = 1; i <= formulas.length; i += 7) render(formulas.slice(0, i));
  check('partial streaming formulas do not throw', true);
  const fixture = document.createElement('div');
  fixture.style.width = '300px';
  fixture.append(render('\\[' + 'a+b+'.repeat(70) + 'c\\]'));
  document.body.append(fixture);
  const display = fixture.querySelector('.math-display');
  const fits = fixture.scrollWidth <= 301 && display && display.scrollWidth > display.clientWidth;
  fixture.remove();
  check('long equations scroll within the phone width', fits);
  return {passed:checks.length, checks};
})();
