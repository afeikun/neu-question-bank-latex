(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('katex'), require('marked'));
  else root.QuestionRenderer = factory(root.katex, root.marked);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (katex, marked) {
  'use strict';
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  // 在 Markdown 解析之前识别公式，防止矩阵换行、下划线及反斜杠被 Markdown 改写。
  function mathAt(source) {
    const pairs = [['$$', '$$', true], ['\\[', '\\]', true], ['\\(', '\\)', false], ['$', '$', false]];
    for (const [open, close, display] of pairs) {
      if (!source.startsWith(open)) continue;
      let at = open.length;
      while ((at = source.indexOf(close, at)) !== -1) {
        let slashes = 0;
        for (let j = at - 1; j >= 0 && source[j] === '\\'; j--) slashes++;
        if (slashes % 2 === 0) return {raw: source.slice(0, at + close.length), tex: source.slice(open.length, at), display};
        at += close.length;
      }
      return {raw: source, tex: source.slice(open.length), display, unclosed: true};
    }
  }
  function render(text, field = '') {
    const issues = [];
    let formulas = 0;
    function mathHTML(token) {
      formulas++;
      try {
        if (token.unclosed) throw new Error('公式定界符未闭合');
        const html = katex.renderToString(token.tex, {displayMode: token.display, throwOnError: true, trust: false, strict: 'ignore'});
        return `<span class="math-${token.display ? 'display' : 'inline'}">${html}</span>`;
      } catch (error) {
        issues.push({field, latex: token.tex, message: error.message});
        return `<span class="math-error" title="${escape(error.message)}">${escape(token.raw)}</span>`;
      }
    }
    const parser = new marked.Marked({gfm: true, breaks: true});
    parser.use({extensions: [
      {name: 'questionMathBlock', level: 'block',
        tokenizer(source) {
          if (!source.startsWith('$$') && !source.startsWith('\\[')) return;
          const token = mathAt(source);
          return {...token, type: 'questionMathBlock'};
        }, renderer: mathHTML},
      {name: 'questionMathInline', level: 'inline',
        start(source) { const i = source.search(/\$|\\[\[(]/); return i < 0 ? undefined : i; },
        tokenizer(source) { const token = mathAt(source); if (token) return {...token, type: 'questionMathInline'}; },
        renderer: mathHTML}
    ]});
    return {html: parser.parse(String(text)), issues, formulas};
  }
  function check(value, field = '') {
    let formulas = 0;
    const issues = [];
    function visit(item, path) {
      if (typeof item === 'string') {
        const result = render(item, path);
        formulas += result.formulas;
        issues.push(...result.issues);
      } else if (item && typeof item === 'object') {
        for (const [key, child] of Object.entries(item)) visit(child, path ? `${path}.${key}` : key);
      }
    }
    visit(value, field);
    return {formulas, issues};
  }
  return {render, check, escape};
});
