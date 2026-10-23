import type { ChatMessage } from '../types';

/**
 * 对话流的纯逻辑边界（无 React 依赖，可被 node:test 直接覆盖）：
 * 1) 多轮上下文构造：显式传入截断位置，避免用闭包里的旧 messages 污染上下文；
 * 2) 流式结束判定：用户点“停止”后一律就地收口，绝不再走回退链路；
 * 3) 重新生成定位：按目标回复回退到它对应的用户提问，历史不含本轮，避免重复提问。
 */

/** 用户主动“停止生成”时的中断标记（AbortError 无法区分超时与手动停止） */
export const STOPPED_SUFFIX = '\n\n_（已停止生成）_';
export const STOPPED_MARK = '已停止生成';

/** 最近 12 条多轮上下文 */
export const MAX_HISTORY_TURNS = 12;
/** 单条历史文本上限 */
const MAX_HISTORY_CHARS = 2000;

/**
 * 清洗正文：剥离知识库引用脚标 [1]/[2]、文末来源段落与正文内页码标记，
 * 知识库来源统一由回复下方的“引用知识库来源”入口承载（不再显示脚标与来源清单）。
 */
export const stripCitationFootnotes = (text: string): string =>
  String(text || '')
    .replace(/\n*-{3,}\n*📌?\s*(知识点来源|参考来源|引用来源|知识库来源|来源与页码)[\s\S]*$/i, '')
    .replace(/\n*📌\s*[^\n]*(来源|引用|出处)[\s\S]*$/i, '')
    .replace(/\[\^?\d+(?:\s*[,，、-]\s*\d+)*\]/g, '')
    .replace(/[（(]\s*(?:第\s*\d+\s*页|P\.?\s*\d+)\s*[)）]/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

/** 被打断的回复可重新生成：正文为空（刚发出即停止）或带停止标记 */
export const canRegenerate = (text?: string): boolean =>
  !text || !text.trim() || text.includes(STOPPED_MARK);

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 构造发往服务端的多轮上下文。
 * @param upToIndex 只取该下标之前的消息（不含该条）：重新生成时传用户提问下标，
 *                  因为提问本身会作为 prompt 单独发送，放进 history 会重复。
 */
export function buildChatHistory(messages: ChatMessage[], upToIndex?: number): HistoryTurn[] {
  const end = typeof upToIndex === 'number' ? upToIndex : messages.length;
  const turns: HistoryTurn[] = [];
  for (const m of messages.slice(0, end)) {
    if (!m.text || m.isRealAi === false) continue;
    if (m.mediaType && m.mediaType !== 'text') continue;
    const role: HistoryTurn['role'] = m.sender === 'user' ? 'user' : 'assistant';
    const content = stripCitationFootnotes(m.text).slice(0, MAX_HISTORY_CHARS);
    if (!content.trim()) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) turns[turns.length - 1] = { role, content: `${last.content}\n\n${content}` };
    else turns.push({ role, content });
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

export type StreamOutcome =
  /** 用户点了停止：就地收口，hasBubbleText 表示是否已有气泡可更新 */
  | { action: 'stopped'; text: string; hasBubbleText: boolean }
  /** 正常结束：用服务端格式化后的全文（或已累积内容）落库 */
  | { action: 'finalize'; text: string }
  /** 一个 token 都没拿到：才允许走非流式回退链路 */
  | { action: 'fallback'; errorText?: string };

/**
 * 流式收口判定。停止优先于一切（包括刚好同时到达的 done），
 * 否则“首 token 前停止”会掉进回退链路，用户停止后仍会收到完整回答。
 */
export function decideStreamOutcome(input: {
  started: boolean;
  stopRequested: boolean;
  acc: string;
  finishedText?: string;
  errorText?: string;
}): StreamOutcome {
  const partial = String(input.acc || '');
  if (input.stopRequested) {
    const hasBubbleText = partial.trim().length > 0;
    return {
      action: 'stopped',
      text: hasBubbleText ? `${partial}${STOPPED_SUFFIX}` : STOPPED_MARK,
      hasBubbleText,
    };
  }
  if (input.started) return { action: 'finalize', text: input.finishedText || partial };
  return { action: 'fallback', errorText: input.errorText };
}

export type RegeneratePlan =
  | { ok: false; reason: 'busy' | 'no-user-message' | 'bad-target' }
  | {
      ok: true;
      prompt: string;
      userIndex: number;
      /** 重新生成后保留的消息条数（含该条用户提问） */
      keepCount: number;
      /** 将被丢弃的后续消息条数 */
      dropped: number;
      history: HistoryTurn[];
    };

/**
 * 定位要重跑的那一轮问答。
 * @param targetAiId 目标回复 id；缺省为最后一条用户提问对应的一轮。
 */
export function planRegenerate(
  messages: ChatMessage[],
  targetAiId?: string,
  options: { busy?: boolean } = {},
): RegeneratePlan {
  if (options.busy) return { ok: false, reason: 'busy' };
  let anchor = messages.length - 1;
  if (targetAiId) {
    const idx = messages.findIndex(m => m.id === targetAiId);
    if (idx < 0) return { ok: false, reason: 'bad-target' };
    anchor = idx;
  }
  for (let i = anchor; i >= 0; i--) {
    const m = messages[i];
    if (m.sender === 'user' && typeof m.text === 'string' && m.text.trim()) {
      const keepCount = i + 1;
      return {
        ok: true,
        prompt: m.text,
        userIndex: i,
        keepCount,
        dropped: Math.max(0, messages.length - keepCount),
        history: buildChatHistory(messages, i),
      };
    }
  }
  return { ok: false, reason: 'no-user-message' };
}
