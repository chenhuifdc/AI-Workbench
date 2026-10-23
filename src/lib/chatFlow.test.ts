import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STOPPED_MARK,
  STOPPED_SUFFIX,
  buildChatHistory,
  canRegenerate,
  decideStreamOutcome,
  planRegenerate,
  stripCitationFootnotes,
} from './chatFlow';
import type { ChatMessage } from '../types';

let seq = 0;
const user = (text: string): ChatMessage => ({
  id: `u${++seq}`,
  sender: 'user',
  text,
  timestamp: '2026-10-23T00:00:00.000Z',
});
const ai = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `a${++seq}`,
  sender: 'ai',
  text,
  timestamp: '2026-10-23T00:00:01.000Z',
  ...extra,
});

test('停止：首 token 前停止必须就地收口，不得进入回退链路', () => {
  const out = decideStreamOutcome({ started: false, stopRequested: true, acc: '' });
  assert.equal(out.action, 'stopped');
  assert.equal(out.action === 'stopped' && out.text, STOPPED_MARK);
  assert.equal(out.action === 'stopped' && out.hasBubbleText, false);
});

test('停止：流式途中停止保留已生成的正文并加标记', () => {
  const out = decideStreamOutcome({ started: true, stopRequested: true, acc: '北京今天晴' });
  assert.equal(out.action, 'stopped');
  assert.equal(out.action === 'stopped' && out.text, `北京今天晴${STOPPED_SUFFIX}`);
  assert.equal(out.action === 'stopped' && out.hasBubbleText, true);
});

test('停止优先于同时到达的 done（不会被完整回答覆盖）', () => {
  const out = decideStreamOutcome({
    started: true,
    stopRequested: true,
    acc: '北',
    finishedText: '北京今天晴，气温 18 度。',
  });
  assert.equal(out.action, 'stopped');
  assert.equal(out.action === 'stopped' && out.text, `北${STOPPED_SUFFIX}`);
});

test('正常结束：优先用服务端格式化全文', () => {
  const out = decideStreamOutcome({
    started: true,
    stopRequested: false,
    acc: '北京今天晴',
    finishedText: '北京今天晴，气温 18 度。',
  });
  assert.deepEqual(out, { action: 'finalize', text: '北京今天晴，气温 18 度。' });
});

test('正常结束但缺 done 文本时用累积内容兜底', () => {
  const out = decideStreamOutcome({ started: true, stopRequested: false, acc: '半句' });
  assert.deepEqual(out, { action: 'finalize', text: '半句' });
});

test('未收到任何 token 才允许回退，并带上上游错误', () => {
  const out = decideStreamOutcome({
    started: false,
    stopRequested: false,
    acc: '',
    errorText: 'upstream_401',
  });
  assert.deepEqual(out, { action: 'fallback', errorText: 'upstream_401' });
});

test('重新生成最后一条回复：历史不含本轮，提问不重复', () => {
  const msgs = [user('第一问'), ai('第一答'), user('第二问'), ai('第二答')];
  const plan = planRegenerate(msgs, msgs[3].id);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.prompt, '第二问');
  assert.equal(plan.keepCount, 3);
  assert.equal(plan.dropped, 1);
  assert.deepEqual(plan.history, [
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第一答' },
  ]);
});

test('重新生成：连续两次得到同样的 prompt 与历史（幂等、无累加）', () => {
  const msgs = [user('问'), ai('答')];
  const first = planRegenerate(msgs, msgs[1].id);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const truncated = msgs.slice(0, first.keepCount);
  const second = planRegenerate(truncated);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.prompt, '问');
  assert.equal(second.history.length, 0);
  assert.equal(truncated.length, 1, '重新生成不应再追加一条用户提问');
});

test('重新生成历史中被停止的回复：丢弃后续轮次并定位到对应提问', () => {
  const msgs = [user('问一'), ai(STOPPED_MARK, { isRealAi: false }), user('问二'), ai('答二')];
  const plan = planRegenerate(msgs, msgs[1].id);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.prompt, '问一');
  assert.equal(plan.keepCount, 1);
  assert.equal(plan.dropped, 3);
  assert.deepEqual(plan.history, []);
});

test('重新生成：忙碌时拒绝，无提问时返回明确原因', () => {
  const busy = planRegenerate([user('问'), ai('答')], undefined, { busy: true });
  assert.deepEqual(busy, { ok: false, reason: 'busy' });
  const empty = planRegenerate([], undefined);
  assert.deepEqual(empty, { ok: false, reason: 'no-user-message' });
  const bad = planRegenerate([user('问')], 'not-exist');
  assert.deepEqual(bad, { ok: false, reason: 'bad-target' });
});

test('历史构造：跳过占位/媒体消息、合并相邻同角色、剥离引用脚标', () => {
  const msgs = [
    user('甲'),
    user('乙'),
    ai('丙[1][2]', { citations: [] }),
    ai('', { isRealAi: false }),
    ai('图', { mediaType: 'image' }),
    ai('丁'),
  ];
  assert.deepEqual(buildChatHistory(msgs), [
    { role: 'user', content: '甲\n\n乙' },
    { role: 'assistant', content: '丙\n\n丁' },
  ]);
});

test('历史构造：最多 12 条且按截断位置生效', () => {
  const msgs: ChatMessage[] = [];
  for (let i = 0; i < 20; i++) msgs.push(i % 2 === 0 ? user(`问${i}`) : ai(`答${i}`));
  const all = buildChatHistory(msgs);
  assert.equal(all.length, 12);
  assert.equal(all[all.length - 1].content, '答19');
  const cut = buildChatHistory(msgs, 4);
  assert.equal(cut.length, 4);
  assert.equal(cut[cut.length - 1].content, '答3');
});

test('canRegenerate 只对空或已停止的回复成立', () => {
  assert.equal(canRegenerate(''), true);
  assert.equal(canRegenerate(undefined), true);
  assert.equal(canRegenerate(`半句${STOPPED_SUFFIX}`), true);
  assert.equal(canRegenerate('完整回答'), false);
});

test('stripCitationFootnotes 清除脚标、页码与来源段落', () => {
  const raw = '结论一[1]，结论二[2][3]。\n\n---\n📌 知识点来源：制度手册 第 3 页';
  assert.equal(stripCitationFootnotes(raw), '结论一，结论二。');
});
