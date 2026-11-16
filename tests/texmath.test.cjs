'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const markdownit = require('../web/vendor/markdown-it.min.js');
const texmath = require('../web/vendor/texmath.js');
const katex = require('../web/vendor/katex/katex.min.js');

const markdown = markdownit({html:false, linkify:true, breaks:true})
  .use(texmath, {engine:katex, delimiters:['brackets','dollars']});
const expression = String.raw`S=\{x>0:x^2\le b\},\qquad a=\sup S.`;

for (const [open, close] of [['\\[', '\\]'], ['$$', '$$']]) {
  test(`${open} display math interrupts a paragraph without a blank line`, () => {
    const source = `양수가 존재함을 증명하려면 실링\n${open}\n${expression}\n${close}\n후속 텍스트`;
    const tokens = markdown.parse(source, {});
    const math = tokens.filter(token => token.type === 'math_block');
    assert.equal(math.length, 1);
    assert.equal(math[0].content.trim(), expression);
    assert.deepEqual(tokens.filter(token => token.type === 'inline').map(token => token.content),
      ['양수가 존재함을 증명하려면 실링', '후속 텍스트']);
    assert.match(markdown.render(source), /class="katex-display"/);
  });
}

test('code and incomplete brackets do not interrupt paragraphs as display math', () => {
  for (const source of ['텍스트\n\\[\nx^2', '텍스트\n`\\[x^2\\]`', '텍스트\n```tex\n\\[x^2\\]\n```']) {
    assert.equal(markdown.parse(source, {}).filter(token => token.type.startsWith('math_')).length, 0);
  }
});

for (const [name, source, type, content] of [
  ['backtick fence', '텍스트\n```tex\n\\[x^2\\]\n$$y$$\n```', 'fence', '\\[x^2\\]\n$$y$$\n'],
  ['tilde fence', '텍스트\n~~~tex\n\\[x^2\\]\n~~~', 'fence', '\\[x^2\\]\n'],
  ['indented code', '텍스트\n\n    \\[x^2\\]\n', 'code_block', '\\[x^2\\]\n'],
]) {
  test(`${name} preserves literal formula delimiters`, () => {
    const tokens = markdown.parse(source, {});
    assert.equal(tokens.filter(token => token.type.startsWith('math_')).length, 0);
    assert.equal(tokens.find(token => token.type === type).content, content);
  });
}

test('inline code, escaped delimiters and currency remain literal', () => {
  for (const source of ['텍스트 `\\[x\\]`', String.raw`텍스트
\\[x\\]`, String.raw`가격 $20 및 $30，총 $50。`, String.raw`텍스트
\$\$x\$\$`]) {
    const tokens = markdown.parse(source, {});
    assert.equal(tokens.flatMap(token => [token, ...(token.children || [])])
      .filter(token => token.type.startsWith('math_')).length, 0);
  }
});

for (const [open, close] of [['\\[', '\\]'], ['$$', '$$']]) {
  test(`${open} keeps existing standalone, inline and numbered formulas`, () => {
    const tokens = markdown.parse(`텍스트\n\n${open}${expression}${close}\n\n업계 내부 \\(x\\) 및 $y$。`, {});
    assert.equal(tokens.find(token => token.type === 'math_block').content, expression);
    assert.deepEqual(tokens.flatMap(token => token.children || [])
      .filter(token => token.type === 'math_inline').map(token => token.content), ['x', 'y']);
    const numbered = markdown.parse(`텍스트\n${open}x^2${close} (1)\n나중에 텍스트`, {});
    assert.equal(numbered.find(token => token.type === 'math_block_eqno').info, '1');
    assert.deepEqual(numbered.filter(token => token.type === 'inline').map(token => token.content), ['텍스트', '나중에 텍스트']);
  });
}

for (const [name, first, rest, container] of [
  ['blockquote', '> ', '> ', 'blockquote_open'],
  ['list item', '- ', '  ', 'list_item_open'],
]) {
  test(`adjacent math preserves the ${name} and surrounding text`, () => {
    const tokens = markdown.parse(`${first}텍스트\n${rest}\\[\n${rest}x^2\n${rest}\\]\n${rest}나중에 텍스트`, {});
    assert.equal(tokens.filter(token => token.type === container).length, 1);
    assert.equal(tokens.find(token => token.type === 'math_block').content.trim(), 'x^2');
    assert.deepEqual(tokens.filter(token => token.type === 'inline').map(token => token.content), ['텍스트', '나중에 텍스트']);
  });
}
