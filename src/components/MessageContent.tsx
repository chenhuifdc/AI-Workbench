import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const CodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {}
  };
  return (
    <div className="code-block my-2">
      <div className="code-block__bar">
        <span>{lang || 'text'}</span>
        <button type="button" onClick={copy} className="code-block__copy">
          {done ? <Check size={11} /> : <Copy size={11} />}
          {done ? '已复制' : '复制'}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
};

/** 正文保持纯文本排版（以角色提示词为准），仅把 ``` 代码块渲染为带复制按钮的代码卡片 */
export const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/```([\w+-]*)\n?([\s\S]*?)```/g);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    const plain = parts[i] || '';
    plain.split('\n').forEach((line, idx) => {
      nodes.push(line.trim()
        ? <div key={`p${i}-${idx}`} className="whitespace-pre-wrap leading-relaxed py-0.5">{line}</div>
        : <div key={`p${i}-${idx}`} className="h-1.5" />);
    });
    if (i + 2 < parts.length) {
      nodes.push(<CodeBlock key={`c${i}`} lang={parts[i + 1]} code={parts[i + 2].replace(/\n$/, '')} />);
    }
  }
  return <>{nodes}</>;
};
