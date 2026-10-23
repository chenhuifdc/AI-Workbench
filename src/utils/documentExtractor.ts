import { DifyChunk, DifyDocument } from '../types';

export interface ExtractedQAResult {
  document: DifyDocument;
  chunks: DifyChunk[];
  summary: {
    totalExtractedQA: number;
    categoriesFound: string[];
    keywordsCount: number;
    avgCharCount: number;
    formatPreserved: string;
  };
}

// Predefined fine-grained financial & business categories
export const KNOWLEDGE_CATEGORIES = [
  '固定收益与理财业务',
  '合规与投资者适当性',
  '高净值家族信托与传承',
  '宏观经济与大类资产配置',
  '销冠展业异议安抚',
  '私募量化与对冲策略',
  '税收筹划与大额保单法商',
  '金融科技与系统操作'
];

/**
 * Intelligent Keyword & Terminology Extractor
 */
function extractKeywordsFromText(text: string): string[] {
  const dictionary = [
    '固收+', '净值波动', '回撤', '安全垫', '持有期', '信用债', '同业存单',
    '银行定存', '通货膨胀', '分红', '资产保值', '跑赢通胀', '定期存款',
    'FOF', '基金中的基金', '平滑波动', '二次分散', '最大回撤', '动态再平衡',
    '美联储降息', '流动性', '哑铃型策略', '黄金对冲', '高股息', '美林时钟',
    '量化中性', '多因子', 'Alpha对冲', '股指期货', 'Beta风险', '对冲策略',
    '家族信托', '财产独立', '破产隔离', '信托法', '婚姻保护', '虚假信托', '权利保留', '监察人',
    '投资者适当性', 'R2稳健型', 'R4高风险', '合规拦截', '风险揭示', '刚性兑付', '资管新规', '保本保息',
    '大类资产配置', '高净值客户', '财富传承', '资产隔离', '税收合规', '异议处理'
  ];

  const matched = new Set<string>();
  const lower = text.toLowerCase();

  for (const term of dictionary) {
    if (lower.includes(term.toLowerCase())) {
      matched.add(term);
    }
  }

  // If fewer than 3 dictionary keywords found, extract high-frequency terms
  if (matched.size < 3) {
    const commonTerms = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
    for (const term of commonTerms) {
      if (term.length >= 2 && !['可以', '我们', '进行', '客户', '因为', '这个', '如果', '建议', '通过'].includes(term)) {
        matched.add(term);
        if (matched.size >= 5) break;
      }
    }
  }

  return Array.from(matched).slice(0, 8);
}

/**
 * Classifies text into detailed financial category
 */
function detectDetailedCategory(text: string, title?: string): string {
  const combined = `${title || ''} ${text}`.toLowerCase();

  if (combined.includes('信托') || combined.includes('隔离') || combined.includes('传承') || combined.includes('家族') || combined.includes('法条')) {
    return '高净值家族信托与传承';
  }
  if (combined.includes('适当性') || combined.includes('合规') || combined.includes('r2') || combined.includes('r4') || combined.includes('保本') || combined.includes('资管新规')) {
    return '合规与投资者适当性';
  }
  if (combined.includes('量化') || combined.includes('alpha') || combined.includes('对冲') || combined.includes('期货') || combined.includes('beta')) {
    return '私募量化与对冲策略';
  }
  if (combined.includes('美联储') || combined.includes('宏观') || combined.includes('降息') || combined.includes('加息') || combined.includes('哑铃型') || combined.includes('黄金')) {
    return '宏观经济与大类资产配置';
  }
  if (combined.includes('定存') || combined.includes('定期') || combined.includes('销冠') || combined.includes('抗拒') || combined.includes('异议') || combined.includes('安抚话术')) {
    return '销冠展业异议安抚';
  }
  if (combined.includes('税') || combined.includes('保单') || combined.includes('年金') || combined.includes('寿险')) {
    return '税收筹划与大额保单法商';
  }
  // Default to fixed income & wealth management
  return '固定收益与理财业务';
}

/**
 * Automatically extracts QA content from arbitrary document formats without altering original content
 * Strictly enforces <= 500 characters limit on extracted QA answers!
 */
export function autoExtractQADocument(
  rawContent: string,
  fileName: string,
  fileFormat: 'markdown' | 'txt' | 'docx' | 'pdf' | 'csv' | 'json',
  datasetId: string
): ExtractedQAResult {
  const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanText = rawContent.trim();
  const overallCategory = detectDetailedCategory(cleanText, fileName);

  const document: DifyDocument = {
    id: docId,
    name: fileName,
    format: fileFormat,
    rawContent: cleanText, // 原格式、原版式 100% 保持未改动
    charCount: cleanText.length,
    uploadedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    category: overallCategory,
    extractedQACount: 0
  };

  const chunks: DifyChunk[] = [];

  // Check for CSV / Excel tabular structure
  if (fileFormat === 'csv' || fileName.endsWith('.csv')) {
    const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const hasHeader = lines[0]?.includes('问题') || lines[0]?.includes('分类') || lines[0]?.includes('Q');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    dataLines.forEach((line, idx) => {
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 2) {
        const cat = parts.length >= 3 ? parts[0] : detectDetailedCategory(line);
        const q = parts.length >= 3 ? parts[1] : parts[0];
        let a = parts.length >= 3 ? parts[2] : parts[1];
        const kwStr = parts.length >= 4 ? parts[3] : '';

        // Strict 500 characters limit
        if (a.length > 500) {
          a = a.slice(0, 494) + '...';
        }

        const keywords = kwStr ? kwStr.split(/[;；,， ]+/).filter(Boolean) : extractKeywordsFromText(`${q} ${a}`);

        chunks.push({
          id: `chk-${Date.now()}-${idx}`,
          datasetId,
          title: q.length > 25 ? q.slice(0, 25) + '...' : q,
          pointName: q.length > 20 ? q.slice(0, 20) + '...' : q,
          pageNumber: `第${Math.floor(idx / 2) + 1}页`,
          category: cat || overallCategory,
          question: q,
          answer: a,
          content: a,
          charCount: a.length,
          tokenCount: Math.ceil(a.length * 1.3),
          keywords,
          sourceDoc: fileName,
          originalDocFormat: fileFormat,
          rawOriginalContent: line,
          updatedAt: '刚刚'
        });
      }
    });
  } else {
    // Markdown / TXT / DOCX / PDF / JSON text processing
    // Step 1: Detect explicit Q&A patterns (问: / 答: / Q: / A: / 【客户问题】 / 【标准应答】)
    const qaRegex = /(?:问|Q|问题|客户提问|【客户问题】|【客户真实抗拒】)[：:\s]+([\s\S]*?)(?:答|A|回答|解答|应答|【销冠标准应对话术】|【标准解答话术】|【应对口径】)[：:\s]+([\s\S]*?)(?=(?:问|Q|问题|客户提问|【客户问题】|【客户真实抗拒】)[：:\s]+|$)/gi;
    let match: RegExpExecArray | null;
    let qaIndex = 0;

    while ((match = qaRegex.exec(cleanText)) !== null) {
      const q = match[1]?.trim();
      let a = match[2]?.trim();
      if (q && a && q.length >= 4 && a.length >= 10) {
        // Enforce strict 500 characters limit
        if (a.length > 500) {
          a = a.slice(0, 494) + '...';
        }

        const cat = detectDetailedCategory(`${q} ${a}`, fileName);
        const keywords = extractKeywordsFromText(`${q} ${a}`);

        chunks.push({
          id: `chk-${Date.now()}-${qaIndex++}`,
          datasetId,
          title: q.length > 25 ? q.slice(0, 25) + '...' : q,
          pointName: q.length > 20 ? q.slice(0, 20) + '...' : q,
          pageNumber: `第${Math.floor(qaIndex / 2) + 1}页`,
          category: cat,
          question: q,
          answer: a,
          content: a,
          charCount: a.length,
          tokenCount: Math.ceil(a.length * 1.3),
          keywords,
          sourceDoc: fileName,
          originalDocFormat: fileFormat,
          rawOriginalContent: match[0],
          updatedAt: '刚刚'
        });
      }
    }

    // Step 2: If no explicit QA regex patterns found, perform intelligent section/heading chunking
    if (chunks.length === 0) {
      // Split by Markdown headers (##, ###) or double newlines
      const sections = cleanText
        .split(/(?=(?:^|\n)#{1,4}\s+|(?:\n\n(?=[一二三四五六七八九十\d]+[、.]))|(?:\n\n(?=【)))/g)
        .map(s => s.trim())
        .filter(s => s.length >= 25);

      sections.forEach((sec, idx) => {
        // Extract section header or first line as topic
        const lines = sec.split('\n').map(l => l.trim()).filter(Boolean);
        const rawHeader = lines[0].replace(/^#{1,4}\s*|[【】一二三四五六七八九十\d+、.：:]+/g, '').trim();
        const headerTitle = rawHeader || `业务知识要点 ${idx + 1}`;

        // Construct realistic user scenario question (QA Question)
        let simulatedQuestion = `关于${headerTitle}，客户咨询或发生业务异议时如何标准应对？`;
        if (sec.includes('波动') || sec.includes('亏损')) {
          simulatedQuestion = `客户对${headerTitle}净值短期波动产生疑虑时，如何安抚并引导长期持有？`;
        } else if (sec.includes('信托') || sec.includes('隔离')) {
          simulatedQuestion = `针对${headerTitle}，如何向高净值客户讲解其财产独立性与破产隔离效力？`;
        } else if (sec.includes('合规') || sec.includes('适当性') || sec.includes('拦截')) {
          simulatedQuestion = `当遇到${headerTitle}相关的合规要求或适当性测评不匹配时，如何规范处理？`;
        }

        // Body as answer
        let answerText = lines.slice(1).join('\n').trim() || lines[0];
        // Enforce strict 500 characters limit
        if (answerText.length > 500) {
          answerText = answerText.slice(0, 494) + '...';
        }

        const cat = detectDetailedCategory(`${headerTitle} ${answerText}`, fileName);
        const keywords = extractKeywordsFromText(`${headerTitle} ${answerText}`);

        chunks.push({
          id: `chk-${Date.now()}-${idx}`,
          datasetId,
          title: headerTitle,
          pointName: headerTitle,
          pageNumber: `第${Math.floor(idx / 2) + 1}页`,
          category: cat,
          question: simulatedQuestion,
          answer: answerText,
          content: answerText,
          charCount: answerText.length,
          tokenCount: Math.ceil(answerText.length * 1.3),
          keywords,
          sourceDoc: fileName,
          originalDocFormat: fileFormat,
          rawOriginalContent: sec,
          updatedAt: '刚刚'
        });
      });
    }
  }

  // Fallback if document is a single short paragraph
  if (chunks.length === 0 && cleanText.length > 0) {
    let answerText = cleanText;
    if (answerText.length > 500) {
      answerText = answerText.slice(0, 494) + '...';
    }
    const cat = detectDetailedCategory(cleanText, fileName);
    const keywords = extractKeywordsFromText(cleanText);

    chunks.push({
      id: `chk-${Date.now()}-0`,
      datasetId,
      title: fileName.replace(/\.[^/.]+$/, ''),
      category: cat,
      question: `针对文档《${fileName}》涉及的业务规则，核心解答与操作口径是什么？`,
      answer: answerText,
      content: answerText,
      charCount: answerText.length,
      tokenCount: Math.ceil(answerText.length * 1.3),
      keywords,
      sourceDoc: fileName,
      originalDocFormat: fileFormat,
      rawOriginalContent: cleanText,
      updatedAt: '刚刚'
    });
  }

  document.extractedQACount = chunks.length;

  const categoriesFound = Array.from(new Set(chunks.map(c => c.category || overallCategory)));
  const totalKeywords = chunks.reduce((acc, c) => acc + c.keywords.length, 0);
  const avgCharCount = Math.round(chunks.reduce((acc, c) => acc + c.charCount, 0) / (chunks.length || 1));

  return {
    document,
    chunks,
    summary: {
      totalExtractedQA: chunks.length,
      categoriesFound,
      keywordsCount: totalKeywords,
      avgCharCount,
      formatPreserved: fileFormat.toUpperCase()
    }
  };
}
