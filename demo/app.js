'use strict';
const $ = id => document.getElementById(id);
let questions = [];
function showMarkdown(id, value) {
  const result = QuestionRenderer.render(String(value ?? ''));
  $(id).innerHTML = DOMPurify.sanitize(result.html);
  return result.issues.length;
}
function showQuestion() {
  const item = questions[Number($('questions').value)];
  if (!item) return;
  const q = item.question;
  let errors = showMarkdown('stem', q.stem_md);
  $('options').replaceChildren();
  const options = Array.isArray(q.options_json) ? q.options_json : [];
  options.forEach((option, index) => {
    const row = document.createElement('div');
    row.className = 'option';
    const label = document.createElement('strong');
    label.textContent = String.fromCharCode(65 + index) + '.';
    const text = document.createElement('div');
    const rendered = QuestionRenderer.render(String(option.content_md ?? ''));
    text.innerHTML = DOMPurify.sanitize(rendered.html);
    errors += rendered.issues.length;
    row.append(label, text);
    $('options').append(row);
  });
  $('options-section').hidden = options.length === 0;
  const answer = q.answer_json ?? {};
  if (Array.isArray(answer.option_keys)) {
    $('answer').textContent = answer.option_keys.map(key => {
      const index = options.findIndex(o => o.key === key);
      return index < 0 ? key : String.fromCharCode(65 + index);
    }).join('、');
  } else if (Array.isArray(answer.blanks)) {
    errors += showMarkdown('answer', answer.blanks.map((b, i) => (i + 1) + '. ' + (b.answers ?? []).join(' / ')).join('\n\n'));
  } else {
    errors += showMarkdown('answer', answer.reference_answer_md ?? JSON.stringify(answer));
  }
  if (String(q.analysis_md ?? '').trim()) errors += showMarkdown('analysis', q.analysis_md);
  else $('analysis').textContent = '此题解析尚未补齐。';
  $('raw').textContent = JSON.stringify(q, null, 2);
  $('content').hidden = false;
  $('status').textContent = item.name + (errors ? ' · 存在无法渲染的公式，已保留原文。' : '');
}
$('files').addEventListener('change', async event => {
  const loaded = [], failures = [];
  for (const file of event.target.files) {
    try {
      const parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      const records = Array.isArray(parsed) ? parsed : [parsed];
      records.forEach((q, i) => {
        if (!q || typeof q.stem_md !== 'string') throw new Error('需要题目对象或题目数组');
        loaded.push({name: file.name + ' #' + (i + 1) + ' · ' + q.stem_md.slice(0, 60), question: q});
      });
    } catch (error) { failures.push(file.name + '：' + error.message); }
  }
  questions = loaded;
  $('questions').replaceChildren(...loaded.map((q, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = q.name;
    return option;
  }));
  $('questions').hidden = loaded.length < 2;
  $('content').hidden = !loaded.length;
  if (loaded.length) showQuestion();
  else $('status').textContent = '未读取到题目。';
  if (failures.length) $('status').textContent += ' ' + failures.join('；');
});
$('questions').addEventListener('change', showQuestion);
