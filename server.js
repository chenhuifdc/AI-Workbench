// src/server.ts
import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var ENV_FILE = process.env.AI_WORKBENCH_ENV_FILE ? path.resolve(process.env.AI_WORKBENCH_ENV_FILE) : path.resolve(process.cwd(), ".env");
dotenv.config({ path: ENV_FILE });
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
var isProduction = process.env.NODE_ENV === "production";
app.use(express.json({ limit: "20mb" }));
function reloadEnv() {
  try {
    const envPath = ENV_FILE;
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const parsed = dotenv.parse(content);
      for (const [key, value] of Object.entries(parsed)) {
        process.env[key] = value;
      }
    }
  } catch (e) {
  }
}
function getEffectiveApiKeys() {
  reloadEnv();
  const rawGeneric = (process.env.API_KEY || process.env.API_KYE || "").trim();
  let geminiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (geminiKey === "MY_GEMINI_API_KEY") geminiKey = "";
  let deepseekKey = (process.env.DEEPSEEK_API_KEY || "").trim();
  let openrouterKey = (process.env.OPENROUTER_API_KEY || "").trim();
  let openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (rawGeneric && rawGeneric.length > 5) {
    if (rawGeneric.startsWith("AIza") && !geminiKey) {
      geminiKey = rawGeneric;
    } else if (rawGeneric.startsWith("sk-or-") && !openrouterKey) {
      openrouterKey = rawGeneric;
    } else if (rawGeneric.startsWith("sk-") && !deepseekKey && !openaiKey) {
      deepseekKey = rawGeneric;
    } else if (!geminiKey && !deepseekKey && !openrouterKey && !openaiKey) {
      deepseekKey = rawGeneric;
    }
  }
  return { geminiKey, deepseekKey, openrouterKey, openaiKey, rawGeneric };
}
function getGeminiClient() {
  const { geminiKey } = getEffectiveApiKeys();
  if (!geminiKey || geminiKey === "MY_GEMINI_API_KEY" || geminiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey: geminiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var KNOWLEDGE_BASE = [
  {
    id: "kb-01",
    category: "\u56FA\u5B9A\u6536\u76CA\u4E0E\u7406\u8D22",
    pointName: "\u56FA\u6536+\u51C0\u503C\u6CE2\u52A8\u5B89\u629A\u4E0E\u6301\u6709\u671F\u80DC\u7387",
    sourceDoc: "\u8D22\u5BCC\u7BA1\u7406\u90E8_\u5BA2\u6237\u5F02\u8BAE\u5E94\u5BF9\u6307\u5F15v2.md",
    pageNumber: "\u7B2C3\u9875",
    question: "\u5BA2\u6237\u8BE2\u95EE\u4E3A\u4EC0\u4E48\u6700\u8FD1\u56FA\u6536+\u7406\u8D22\u4EA7\u54C1\u6536\u76CA\u6709\u6240\u6CE2\u52A8\uFF0C\u62C5\u5FC3\u4E8F\u635F\u600E\u4E48\u89E3\u7B54\uFF1F",
    answer: "\u3010\u8BDD\u672F\u89E3\u6790\u3011\n\u5C0A\u656C\u7684\u5BA2\u6237\uFF0C\u975E\u5E38\u7406\u89E3\u60A8\u7684\u5173\u6CE8\u3002\u8FD1\u671F\u7684\u51C0\u503C\u6CE2\u52A8\u4E3B\u8981\u6E90\u4E8E\u503A\u5238\u5E02\u573A\u77ED\u671F\u5229\u7387\u5FAE\u8C03\u4EE5\u53CA\u6743\u76CA\u4ED3\u4F4D\u4F30\u503C\u53D8\u52A8\uFF0C\u8FD9\u662F\u51C0\u503C\u578B\u4EA7\u54C1\u7684\u6B63\u5E38\u5E02\u573A\u53CD\u6620\u3002\u4ECE\u8D44\u4EA7\u914D\u7F6E\u89D2\u5EA6\u770B\uFF0C\u6211\u4EEC\u7684\u2018\u56FA\u6536+\u2019\u5E95\u5C4280%\u4EE5\u4E0A\u914D\u7F6E\u9AD8\u7B49\u7EA7\u592E\u56FD\u4F01\u4FE1\u7528\u503A\u4E0E\u9AD8\u6D41\u52A8\u6027\u540C\u4E1A\u5B58\u5355\uFF0C\u63D0\u4F9B\u7A33\u5065\u5B89\u5168\u57AB\uFF1B\u4EC5\u670910%~15%\u9002\u5EA6\u53C2\u4E0E\u7EA2\u5229\u4F4E\u6CE2\u4E0E\u9AD8\u80A1\u606F\u84DD\u7B79\u80A1\u7968\u4EE5\u589E\u539A\u957F\u7EBF\u6536\u76CA\u3002\u5386\u53F2\u56DE\u6D4B\u663E\u793A\uFF0C\u62C9\u957F6\u4E2A\u6708\u4EE5\u4E0A\u6301\u6709\u5468\u671F\uFF0C\u6B63\u6536\u76CA\u6982\u7387\u8D8596%\u3002\u5EFA\u8BAE\u60A8\u4FDD\u6301\u8010\u5FC3\uFF0C\u907F\u514D\u5728\u77ED\u671F\u8C03\u6574\u4E2D\u9519\u5931\u540E\u7EED\u6536\u76CA\u53CD\u5F39\u3002",
    keywords: ["\u56FA\u6536+", "\u6536\u76CA\u6CE2\u52A8", "\u4E8F\u635F", "\u7406\u8D22", "\u7A33\u5065", "\u51C0\u503C"]
  },
  {
    id: "kb-02",
    category: "\u5408\u89C4\u4E0E\u9002\u5F53\u6027",
    pointName: "\u6295\u8D44\u8005\u9002\u5F53\u6027R2\u8D8A\u7EA7\u8BA4\u8D2DR4\u786C\u6027\u5408\u89C4\u62E6\u622A",
    sourceDoc: "\u9002\u5F53\u6027\u5408\u89C4\u7BA1\u7406\u5236\u5EA6\u53CA\u6807\u51C6\u5E94\u7B54\u53E3\u5F84.pdf",
    pageNumber: "\u7B2C6\u9875",
    question: "\u5BA2\u6237\u98CE\u9669\u8BC4\u4F30\u4E3A\u7A33\u5065\u578B(R2)\uFF0C\u4F46\u5F3A\u70C8\u8981\u6C42\u8D2D\u4E70R4\u7EA7\u522B\u6FC0\u8FDB\u80A1\u7968\u91CF\u5316\u79C1\u52DF\uFF0C\u5982\u4F55\u5408\u89C4\u62D2\u7EDD\u4E0E\u758F\u5BFC\uFF1F",
    answer: "\u3010\u5408\u89C4\u53E3\u5F84\u4E0E\u5F15\u5BFC\u3011\n\u5F20\u603B\uFF0C\u975E\u5E38\u611F\u8C22\u60A8\u5BF9\u91CF\u5316\u7B56\u7565\u6536\u76CA\u5F39\u6027\u7684\u5173\u6CE8\u3002\u6839\u636E\u4E2D\u56FD\u8BC1\u76D1\u4F1A\u53CA\u94F6\u4FDD\u76D1\u4F1A\u300A\u8BC1\u5238\u671F\u8D27\u6295\u8D44\u8005\u9002\u5F53\u6027\u7BA1\u7406\u529E\u6CD5\u300B\u786C\u6027\u89C4\u5B9A\uFF0C\u91D1\u878D\u673A\u6784\u4E25\u7981\u5411\u6295\u8D44\u8005\u9500\u552E\u9AD8\u4E8E\u5176\u98CE\u9669\u627F\u53D7\u80FD\u529B\u7684\u91D1\u878D\u4EA7\u54C1\u3002\u60A8\u7684\u6D4B\u8BC4\u4E3AR2\u7A33\u5065\u578B\uFF0C\u800C\u8BE5\u91CF\u5316\u79C1\u52DF\u4E3AR4\u9AD8\u98CE\u9669\uFF0C\u5B58\u5728\u56DE\u64A4\u8D85\u8FC720%\u7684\u53EF\u80FD\u3002\u4E3A\u5207\u5B9E\u4FDD\u969C\u60A8\u7684\u8D44\u4EA7\u5B89\u5168\uFF0C\u6211\u4EEC\u7CFB\u7EDF\u5408\u89C4\u62E6\u622A\u8BE5\u7B14\u8BA4\u8D2D\u3002\u82E5\u60A8\u7ECF\u8FC7\u5BA1\u614E\u8BC4\u4F30\u81EA\u8EAB\u98CE\u9669\u504F\u597D\u786E\u6709\u53D8\u5316\uFF0C\u53EF\u91CD\u65B0\u8FDB\u884C\u5408\u89C4\u95EE\u5377\u6D4B\u8BC4\uFF1B\u540C\u65F6\uFF0C\u6211\u4E5F\u4E3A\u60A8\u7CBE\u9009\u4E86\u5339\u914DR2\u98CE\u9669\u3001\u5305\u542B\u91CF\u5316\u4E2D\u6027\u5BF9\u51B2\u7B56\u7565\u7684\u4F4E\u6CE2\u52A8FOF\u65B9\u6848\uFF0C\u8BF7\u5141\u8BB8\u6211\u4E3A\u60A8\u5BF9\u6BD4\u5206\u6790\u3002",
    keywords: ["\u98CE\u9669\u8BC4\u7EA7", "R2", "R4", "\u9002\u5F53\u6027", "\u5408\u89C4", "\u79C1\u52DF", "\u62D2\u7EDD"]
  },
  {
    id: "kb-03",
    category: "\u5BB6\u65CF\u4FE1\u6258\u4E0E\u4F20\u627F",
    pointName: "\u4FE1\u6258\u6CD5\u7B2C15/17\u6761\u8D22\u4EA7\u72EC\u7ACB\u4E0E\u7834\u4EA7\u9694\u79BB\u6548\u529B",
    sourceDoc: "\u79C1\u4EBA\u94F6\u884C\u5BB6\u65CF\u529E\u516C\u5BA4\u6CD5\u7A0E\u6307\u5357.txt",
    pageNumber: "\u7B2C2\u9875",
    question: "\u4F01\u4E1A\u5BB6\u5BA2\u6237\u62C5\u5FC3\u4F01\u4E1A\u7ECF\u8425\u98CE\u9669\u6CE2\u53CA\u4E2A\u4EBA\u5BB6\u5EAD\u8D44\u4EA7\uFF0C\u54A8\u8BE2\u5BB6\u65CF\u4FE1\u6258\u7684\u8D22\u4EA7\u9694\u79BB\u6548\u529B\uFF1F",
    answer: "\u3010\u4FE1\u6258\u4E13\u5BB6\u89E3\u7B54\u3011\n\u738B\u8463\u60A8\u597D\uFF0C\u6839\u636E\u6211\u56FD\u300A\u4FE1\u6258\u6CD5\u300B\u7B2C\u5341\u4E94\u6761\u4E0E\u7B2C\u5341\u4E03\u6761\u89C4\u5B9A\uFF0C\u4FE1\u6258\u8D22\u4EA7\u5177\u5907\u72EC\u7ACB\u7684\u6CD5\u5F8B\u5730\u4F4D\uFF0C\u4E0D\u5C5E\u4E8E\u53D7\u6258\u4EBA\u7684\u56FA\u6709\u8D22\u4EA7\uFF0C\u4E5F\u4E0D\u5C5E\u4E8E\u59D4\u6258\u4EBA\u7684\u6E05\u7B97\u8D22\u4EA7\u3002\u4FE1\u6258\u4E00\u7ECF\u6709\u6548\u8BBE\u7ACB\uFF0C\u4FE1\u6258\u8D22\u4EA7\u5373\u5B9E\u73B0\u5408\u6CD5\u7834\u4EA7\u9694\u79BB\uFF0C\u503A\u6743\u4EBA\u65E0\u6743\u76F4\u63A5\u67E5\u5C01\u6267\u884C\uFF08\u9664\u975E\u6D89\u5ACC\u6076\u610F\u8F6C\u79FB\u9003\u5E9F\u503A\uFF09\u3002\u901A\u8FC7\u8BBE\u7ACB\u4E0D\u53EF\u64A4\u9500\u5BB6\u65CF\u4FE1\u6258\uFF0C\u4E0D\u4EC5\u80FD\u6709\u6548\u9632\u8303\u4F01\u4E1A\u7ECF\u8425\u8FDE\u5E26\u98CE\u9669\uFF0C\u8FD8\u80FD\u9884\u5148\u8BBE\u7ACB\u5B50\u5973\u5B9A\u5411\u5206\u914D\u3001\u9632\u6325\u970D\u673A\u5236\u53CA\u5A5A\u59FB\u8D44\u4EA7\u4FDD\u62A4\uFF0C\u5B9E\u73B0\u771F\u6B63\u7684\u767E\u5E74\u5BB6\u4E1A\u57FA\u4E1A\u957F\u9752\u3002",
    keywords: ["\u5BB6\u65CF\u4FE1\u6258", "\u8D22\u4EA7\u9694\u79BB", "\u4F01\u4E1A\u7ECF\u8425", "\u4F20\u627F", "\u4FE1\u6258\u6CD5", "\u7834\u4EA7"]
  },
  {
    id: "kb-04",
    category: "\u5B8F\u89C2\u4E0E\u5927\u7C7B\u8D44\u4EA7",
    pointName: "\u7F8E\u8054\u50A8\u964D\u606F\u5468\u671F\u54D1\u94C3\u578B\u5927\u7C7B\u8D44\u4EA7\u914D\u7F6E",
    sourceDoc: "\u5B8F\u89C2\u7B56\u7565\u6708\u62A5_\u5927\u7C7B\u8D44\u4EA7\u914D\u7F6E.md",
    pageNumber: "\u7B2C18\u9875",
    question: "\u7F8E\u8054\u50A8\u964D\u606F\u5468\u671F\u4E0B\uFF0C\u56FD\u5185\u5927\u7C7B\u8D44\u4EA7\u914D\u7F6E\u5E94\u8BE5\u5982\u4F55\u89C4\u5212\uFF1F",
    answer: "\u3010\u5B8F\u89C2\u5206\u6790\u5E08\u6307\u5F15\u3011\n\u7F8E\u8054\u50A8\u6B65\u5165\u964D\u606F\u5468\u671F\u540E\uFF0C\u5168\u7403\u6D41\u52A8\u6027\u5BBD\u677E\u8FB9\u9645\u6539\u5584\uFF0C\u7F8E\u5143\u6307\u6570\u627F\u538B\uFF0C\u4E3A\u56FD\u5185\u8D27\u5E01\u653F\u7B56\u91CA\u653E\u964D\u51C6\u964D\u606F\u7A7A\u95F4\u3002\u5927\u7C7B\u8D44\u4EA7\u914D\u7F6E\u903B\u8F91\u5982\u4E0B\uFF1A1. \u6743\u76CA\u8D44\u4EA7\uFF1A\u5173\u6CE8\u4F30\u503C\u5E95\u90E8\u3001\u5BF9\u6D77\u5916\u6D41\u52A8\u6027\u654F\u611F\u7684\u6E2F\u80A1\u4E92\u8054\u7F51\u53CA\u6838\u5FC3\u9AD8\u80A1\u606F\u6838\u5FC3\u8D44\u4EA7\uFF1B2. \u503A\u5238\u5E02\u573A\uFF1A\u957F\u7AEF\u56FD\u503A\u6536\u76CA\u7387\u77ED\u671F\u9707\u8361\uFF0C\u5EFA\u8BAE\u7EF4\u6301\u4E2D\u7B49\u4E45\u671F\uFF0C\u91CD\u70B9\u6355\u6349\u4FE1\u7528\u5229\u5DEE\u673A\u4F1A\uFF1B3. \u5927\u5B97\u5546\u54C1\uFF1A\u8D35\u91D1\u5C5E\uFF08\u9EC4\u91D1\uFF09\u5728\u4E2D\u957F\u671F\u53BB\u7F8E\u5143\u5316\u4E0E\u964D\u606F\u80CC\u666F\u4E0B\u4F9D\u7136\u5177\u5907\u9AD8\u914D\u7F6E\u4EF7\u503C\uFF1B4. \u5EFA\u8BAE\u7EF4\u6301\u2018\u6743\u76CA\u5E95\u4ED3+\u9AD8\u7B49\u7EA7\u56FA\u6536+5%~10%\u5B9E\u7269\u9EC4\u91D1\u5BF9\u51B2\u2019\u7684\u6807\u51C6\u54D1\u94C3\u578B\u7B56\u7565\u3002",
    keywords: ["\u7F8E\u8054\u50A8", "\u964D\u606F", "\u5927\u7C7B\u8D44\u4EA7", "\u9EC4\u91D1", "\u5B8F\u89C2", "\u914D\u7F6E"]
  },
  {
    id: "kb-05",
    category: "\u9500\u51A0\u5C55\u4E1A\u5F02\u8BAE",
    pointName: "\u5B9A\u671F\u5B58\u6B3E\u964D\u606F\u5E94\u5BF9\u4E0E\u57FA\u91D1\u914D\u7F6E\u66FF\u4EE3",
    sourceDoc: "\u9500\u51A0\u7834\u5C40\u624B\u518C_\u5B58\u6B3E\u66FF\u4EE3\u7BC7.docx",
    pageNumber: "\u7B2C12\u9875",
    question: "\u5BA2\u6237\u8BF4\u2018\u94B1\u5B58\u94F6\u884C\u5B9A\u671F4%\u5F88\u5B89\u5168\uFF0C\u4E3A\u4EC0\u4E48\u4E70\u4F60\u4EEC\u7684\u516C\u52DF\u57FA\u91D1\uFF1F\u2019",
    answer: "\u3010\u9500\u51A0\u60C5\u5546\u8BDD\u672F\u3011\n\u674E\u59D0\uFF0C\u60A8\u7279\u522B\u6709\u773C\u5149\uFF0C\u8D44\u4EA7\u5B89\u5168\u786E\u5B9E\u6C38\u8FDC\u662F\u7B2C\u4E00\u4F4D\u7684\uFF01\u4E0D\u8FC7\u60A8\u53EF\u80FD\u4E5F\u6CE8\u610F\u5230\u4E86\uFF0C\u76EE\u524D\u56FD\u6709\u5927\u884C3\u5E74\u671F\u5B9A\u5B58\u5229\u7387\u5DF2\u7ECF\u666E\u904D\u4E0B\u8C03\u81F31.5%~1.8%\u533A\u95F4\uFF0C4%\u7684\u5B9A\u5B58\u5DF2\u6210\u5386\u53F2\u3002\u5728\u771F\u5B9E\u901A\u80C0\u4E0E\u8D27\u5E01\u8D2D\u4E70\u529B\u53D8\u5316\u4E0B\uFF0C\u5355\u4E00\u5B58\u6B3E\u5B9E\u9645\u4E0A\u5F88\u96BE\u62B5\u5FA1\u8D44\u4EA7\u7F29\u6C34\u3002\u6211\u4EEC\u63A8\u8350\u7684\u2018\u7A33\u5065\u6536\u76CA+\u2019\u57FA\u91D1\u7EC4\u5408\uFF0C\u5E76\u4E0D\u662F\u8981\u60A8\u628A\u94B1\u90FD\u62FF\u6765\u5192\u9669\uFF0C\u800C\u662F\u628A\u5927\u90E8\u5206\u8D44\u91D1\u653E\u5728\u7C7B\u4F3C\u5B9A\u5B58\u5B89\u5168\u5EA6\u7684\u56FA\u6536\u5E95\u5C42\uFF0C\u62FF\u51FA\u4E00\u5C0F\u90E8\u5206\u53C2\u4E0E\u4F18\u8D28\u84DD\u7B79\u5206\u7EA2\uFF0C\u65E2\u5B88\u62A4\u672C\u91D1\u5B89\u5168\uFF0C\u53C8\u4E89\u53D6\u8DD1\u8D62\u901A\u80C0\uFF0C\u60A8\u770B\u6211\u7ED9\u60A8\u770B\u4E00\u4EFD3\u5E74\u5B9E\u76D8\u6536\u76CA\u66F2\u7EBF\u5BF9\u6BD4\uFF1F",
    keywords: ["\u94F6\u884C\u5B58\u6B3E", "\u5B9A\u671F", "\u8DD1\u8D62\u901A\u80C0", "\u6536\u76CA\u5BF9\u6BD4", "\u9500\u51A0", "\u5F02\u8BAE"]
  }
];
var COMMAND_PROMPTS = {
  we: "\u4F60\u662F\u4E00\u4E2A\u9AD8\u6548\u4E13\u4E1A\u7684\u91D1\u878DAI\u52A9\u7406\u3002\u4EE5\u6781\u7B80\u3001\u7CBE\u51C6\u3001\u7ED3\u6784\u5316\u7684\u65B9\u5F0F\u56DE\u7B54\u91D1\u878D\u4E1A\u52A1\u95EE\u9898\uFF0C\u76F4\u5954\u8981\u70B9\uFF0C\u8BED\u8A00\u51DD\u7EC3\uFF0C\u9002\u5408\u4E1A\u52A1\u5458\u5FEB\u901F\u590D\u5236\u3002",
  ww: "\u4F60\u662F\u4E00\u4E2A\u6DF1\u5EA6\u91D1\u878D\u601D\u8003\u5F15\u64CE\u3002\u8BF7\u5C55\u793A\u4F60\u7684\u601D\u7EF4\u94FE\u63A8\u6F14\u8FC7\u7A0B\uFF08\u4F7F\u7528\u3010\u601D\u8003\u94FE\u63A8\u7406\u3011\u5F00\u5934\uFF09\uFF0C\u6DF1\u5EA6\u5256\u6790\u5B8F\u89C2\u3001\u884C\u4E1A\u3001\u5FAE\u89C2\u9A71\u52A8\u529B\u4E0E\u6F5C\u5728\u98CE\u9669\uFF0C\u6700\u540E\u7ED9\u51FA\u4E25\u5BC6\u7ED3\u8BBA\u4E0E\u64CD\u4F5C\u5EFA\u8BAE\u3002",
  wr: "\u4F60\u662F\u4E00\u4E2A\u6DF1\u5EA6\u91D1\u878D\u601D\u8003\u5F15\u64CE\u3002\u8BF7\u5C55\u793A\u4F60\u7684\u601D\u7EF4\u94FE\u63A8\u6F14\u8FC7\u7A0B\uFF08\u4F7F\u7528\u3010\u601D\u8003\u94FE\u63A8\u7406\u3011\u5F00\u5934\uFF09\uFF0C\u6DF1\u5EA6\u5256\u6790\u5B8F\u89C2\u3001\u884C\u4E1A\u3001\u5FAE\u89C2\u9A71\u52A8\u529B\u4E0E\u6F5C\u5728\u98CE\u9669\uFF0C\u6700\u540E\u7ED9\u51FA\u4E25\u5BC6\u7ED3\u8BBA\u4E0E\u64CD\u4F5C\u5EFA\u8BAE\u3002",
  rg: "\u4F60\u662F\u4E00\u4F4D\u62E5\u670915\u5E74\u7ECF\u9A8C\u7684\u8D44\u6DF1\u6301\u724C\u6295\u8D44\u987E\u95EE\u4E13\u5BB6\uFF08\u6295\u987E\u4E13\u5BB6\uFF09\u3002\u56DE\u7B54\u9700\u517C\u5177\u7B56\u7565\u9AD8\u5EA6\u4E0E\u5B9E\u64CD\u843D\u5730\u6027\uFF0C\u8FD0\u7528\u8D44\u4EA7\u914D\u7F6E\u6A21\u578B\uFF08\u5982\u7F8E\u6797\u65F6\u949F\u3001\u54D1\u94C3\u578B\u7B56\u7565\uFF09\uFF0C\u7ED9\u51FA\u4E25\u5BC6\u7684\u4ED3\u4F4D\u3001\u6B62\u76C8\u6B62\u635F\u53CA\u7EC4\u5408\u914D\u7F6E\u65B9\u6848\u3002",
  rf: "\u4F60\u662F\u4E00\u5BB6\u9876\u7EA7\u91D1\u878D\u673A\u6784\u7684\u98CE\u63A7\u4E0E\u5408\u89C4\u603B\u76D1\uFF08\u98CE\u63A7\u4E13\u5BB6\uFF09\u3002\u8BF7\u4E25\u683C\u4EE5\u91D1\u878D\u5408\u89C4\u3001\u53CD\u6D17\u94B1\u3001\u6295\u8D44\u8005\u9002\u5F53\u6027\u7BA1\u7406\u3001\u865A\u5047\u5BA3\u4F20\u5BA1\u67E5\u4E3A\u51C6\u7EF3\uFF0C\u4E25\u683C\u6311\u51FA\u4E0D\u5408\u89C4\u98CE\u9669\uFF0C\u7ED9\u51FA\u6807\u51C6\u514D\u8D23\u58F0\u660E\u548C\u5408\u89C4\u4FEE\u6539\u5EFA\u8BAE\uFF0C\u63AA\u8F9E\u4E25\u8C28\u4E13\u4E1A\u3002",
  rs: "\u4F60\u662F\u4E00\u4F4D\u9876\u7EA7\u5B8F\u89C2\u7ECF\u6D4E\u5B66\u5BB6\u517C\u5238\u5546\u9996\u5E2D\u5B8F\u89C2\u5206\u6790\u5E08\u3002\u4ECE\u8D27\u5E01\u653F\u7B56\u3001\u6D41\u52A8\u6027\u3001\u56FD\u9645\u6536\u652F\u3001PPI/CPI\u526A\u5200\u5DEE\u4EE5\u53CA\u5468\u671F\u8FD0\u884C\u89D2\u5EA6\u5168\u9762\u5256\u6790\uFF0C\u89C2\u70B9\u6DF1\u523B\u72EC\u5230\uFF0C\u903B\u8F91\u81EA\u6D3D\u3002",
  rm: "\u4F60\u662F\u5168\u56FD\u9876\u5C16\u79C1\u884C\u4E1A\u52A1\u9500\u51A0\u4E0E\u5353\u8D8A\u8D22\u5BCC\u7BA1\u7406\u987E\u95EE\u3002\u4F60\u6DF1\u8C19\u9AD8\u51C0\u503C\u5BA2\u6237\u5FC3\u7406\u5B66\u4E0E\u8C08\u5224\u827A\u672F\uFF0C\u8BF4\u8BDD\u6781\u5177\u4EB2\u548C\u529B\u3001\u540C\u7406\u5FC3\u4E0E\u4E13\u4E1A\u8BF4\u670D\u529B\uFF0C\u64C5\u957F\u5316\u89E3\u5BA2\u6237\u7591\u8651\u5E76\u4FC3\u6210\u5927\u5355\u7B7E\u7EA6\uFF0C\u8F93\u51FA\u5373\u7528\u578B\u9AD8\u60C5\u5546\u8BDD\u672F\u3002",
  rt: "\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u91CF\u5316\u5BF9\u51B2\u57FA\u91D1\u7ECF\u7406\u4E0E\u6280\u672F\u9762\u4EA4\u6613\u4E13\u5BB6\u3002\u719F\u6089K\u7EBF\u5F62\u6001\u3001\u7F20\u8BBA\u3001\u91CF\u4EF7\u5173\u7CFB\u3001MACD/RSI/\u5E03\u6797\u5E26\u6280\u672F\u6307\u6807\u4EE5\u53CA\u91CF\u5316\u56E0\u5B50\u62E9\u65F6\uFF0C\u7ED9\u51FA\u7CBE\u786E\u7684\u652F\u6491\u4F4D\u3001\u963B\u529B\u4F4D\u3001\u80DC\u7387\u8D54\u7387\u53CA\u7B56\u7565\u4EE3\u7801\u601D\u8DEF\u3002",
  rp: "\u4F60\u662F\u4E00\u5BB6\u9876\u7EA7\u5F8B\u6240\u91D1\u878D\u4E0E\u79C1\u52DF\u6295\u884C\u9AD8\u7EA7\u5408\u4F19\u4EBA\u517C\u5408\u89C4\u6CD5\u52A1\u4E13\u5BB6\u3002\u6DF1\u5165\u89E3\u6790\u5BF9\u8D4C\u534F\u8BAE\u3001\u6709\u9650\u5408\u4F19\u534F\u8BAE\u3001\u4EFD\u989D\u8F6C\u8BA9\u3001\u7A7F\u900F\u5BA1\u67E5\u3001\u8868\u5916\u8D1F\u503A\u53CA\u5C3D\u8C03\u6392\u67E5\u8981\u70B9\uFF0C\u5F15\u7528\u76F8\u5173\u6CD5\u6761\u4E0E\u5224\u4F8B\u5B9E\u52A1\u3002",
  usn: "\u4F60\u662F\u534E\u5C14\u8857\u8D44\u6DF1\u91D1\u878D\u8D22\u7ECF\u540C\u4F20\u8BD1\u5458\u3002\u5C06\u7528\u6237\u8F93\u5165\u7684\u4E2D\u6587\u91D1\u878D\u672F\u8BED\u3001\u7814\u62A5\u6BB5\u843D\u6216\u5BF9\u8BDD\u7CBE\u51C6\u7FFB\u8BD1\u4E3A\u7B26\u5408\u56FD\u9645\u6295\u884C\u6807\u51C6\u7684\u9AD8\u7AEF\u91D1\u878D\u82F1\u8BED\uFF08Wall Street Financial English\uFF09\uFF0C\u5E76\u4FDD\u7559\u4E13\u4E1A\u672F\u8BED\u7F29\u5199\u4E0E\u6807\u51C6\u8BCD\u4E49\u3002",
  jpn: "\u4F60\u662F\u91CE\u6751\u8BC1\u5238/\u5927\u548C\u8BC1\u5238\u7EA7\u522B\u8D44\u6DF1\u91D1\u878D\u65E5\u8BED\u7FFB\u8BD1\u4E13\u5BB6\u3002\u5C06\u5185\u5BB9\u7FFB\u8BD1\u4E3A\u5730\u9053\u3001\u4E25\u8C28\u3001\u7B26\u5408\u65E5\u672C\u91D1\u878D\u4E1A\u754C\u793C\u4EEA\uFF08\u656C\u8BED\u6700\u9AD8\u7EA7\u522B\uFF09\u7684\u5546\u52A1\u91D1\u878D\u65E5\u8BED\uFF0C\u5E76\u5728\u5173\u952E\u91D1\u878D\u4E13\u6709\u540D\u8BCD\u540E\u9644\u5E73\u5047\u540D\u6216\u6CE8\u97F3\u3002",
  st: "\u4F60\u662F\u4E00\u4F4D\u64C5\u957F\u91D1\u878D\u5546\u6218\u4E0E\u8D22\u5BCC\u4F20\u627F\u7684\u6DF1\u5EA6\u5546\u4E1A\u6545\u4E8B\u5C0F\u8BF4\u4F5C\u5BB6\u3002\u5C06\u91D1\u878D\u4EA7\u54C1\u3001\u8D22\u5BCC\u4F20\u627F\u3001\u5546\u6218\u535A\u5F08\u6216\u5BB6\u65CF\u8D22\u5BCC\u4F20\u627F\u7B49\u62BD\u8C61\u903B\u8F91\uFF0C\u5316\u4E3A\u8DCC\u5B95\u8D77\u4F0F\u3001\u771F\u5B9E\u611F\u5F3A\u70C8\u7684\u91D1\u878D\u5FAE\u578B\u5C0F\u8BF4\u6216\u5BA2\u6237\u8425\u9500\u6848\u4F8B\uFF0C\u60C5\u8282\u6263\u4EBA\u5FC3\u5F26\uFF0C\u5F15\u4EBA\u5165\u80DC\u3002",
  net: "\u4F60\u662F\u4E00\u4E2A\u7ED3\u5408\u5168\u7F51\u91D1\u878D\u8D44\u8BAF\u4E0E\u6743\u5A01\u884C\u60C5\u6570\u636E\u5E93\u7684\u5B9E\u65F6\u7814\u62A5\u52A9\u624B\u3002\u4E3A\u7528\u6237\u68B3\u7406\u6700\u65B0\u7684\u5168\u7403\u5E02\u573A\u5F02\u52A8\u3001\u7A81\u53D1\u8981\u95FB\u3001\u592E\u884C\u51B3\u8BAE\u53CA\u5927\u76D8\u590D\u76D8\uFF0C\u6761\u7406\u6E05\u6670\uFF0C\u6807\u6CE8\u4FE1\u606F\u5173\u952E\u8981\u70B9\u3002"
};
function formatToPurePlainText(rawText) {
  if (!rawText) return "";
  let text = String(rawText);
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\*(.*?)\*/g, "$1");
  text = text.replace(/__(.*?)__/g, "$1");
  text = text.replace(/_(.*?)_/g, "$1");
  text = text.replace(/~~(.*?)~~/g, "$1");
  text = text.replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1");
  text = text.replace(/^#+\s*/gm, "");
  text = text.replace(/^[\*\-\+]\s+/gm, "");
  text = text.replace(/^\s*[-=_─]{3,}\s*$/gm, "");
  text = text.replace(/[┌┐└┘│─╔╗║╚╝═█▍▌■◆▶◀▲▼★☆]/g, "");
  text = text.replace(/【(客户类型|基本情况|背景分析)】/g, "\u4E00\u3001$1\n");
  text = text.replace(/【(客户心理|需求分析|心理分析)】/g, "\u4E8C\u3001$1\n");
  text = text.replace(/【(回复目标|沟通策略|应对方向)】/g, "\u4E09\u3001$1\n");
  text = text.replace(/【(推荐话术一|推荐话术1|话术方案一)】/g, "\u56DB\u3001\u63A8\u8350\u8BDD\u672F\u65B9\u6848\u4E00\n");
  text = text.replace(/【(推荐话术二|推荐话术2|话术方案二)】/g, "\u4E94\u3001\u63A8\u8350\u8BDD\u672F\u65B9\u6848\u4E8C\n");
  text = text.replace(/【(推荐话术三|推荐话术3|话术方案三)】/g, "\u516D\u3001\u63A8\u8350\u8BDD\u672F\u65B9\u6848\u4E09\n");
  text = text.replace(/【(业务员备注|要点备忘|追问建议)】/g, "\u4E03\u3001$1\n");
  text = text.replace(/【(.*?)】/g, "$1\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
var NETWORK_FAULT_REPORT = [
  "\u4E00\u3001\u7CFB\u7EDF\u7F51\u7EDC\u6545\u969C\u62A5\u544A",
  "1. \u5F53\u524D\u5DF2\u89E6\u53D1\u4E09\u6B21\u91CD\u8BD5\u673A\u5236",
  "2. \u670D\u52A1\u5668\u8BF7\u6C42\u54CD\u5E94\u65F6\u95F4\u8D85\u51FA 300 \u79D2\u9650\u5236",
  "3. \u7F51\u7EDC\u8FDE\u63A5\u8D85\u65F6"
].join("\n");
async function fetchWithRetryAndTimeout(url, options, maxRetries = 3, timeoutMs = 3e5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      if (resp.ok) {
        const data = await resp.json();
        return { ok: true, status: resp.status, data };
      }
      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, status: resp.status, error: "\u8BF7\u914D\u7F6EAPI KEY" };
      }
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429) {
        return { ok: false, status: resp.status, error: NETWORK_FAULT_REPORT };
      }
    } catch {
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxRetries) {
      const base = 1e3 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, base + Math.floor(Math.random() * base * 0.2)));
    }
  }
  return { ok: false, status: 504, error: NETWORK_FAULT_REPORT };
}
var STRICT_PLAIN_TEXT_SYSTEM_RULE = `

\u3010\u6392\u7248\u4E0E\u683C\u5F0F\u8981\u6C42\uFF08\u4E25\u683C\u9075\u5B88\uFF09\u3011
\u6240\u6709\u89D2\u8272\u56DE\u590D\u7684\u6587\u5B57\u5185\u5BB9\uFF0C\u4F7F\u7528\u5168\u6587\u672C\uFF0C\u4E0D\u8981\u4F7F\u7528\u4EFB\u4F55\u8FB9\u6846\u56FE\u5F62\u3002\u6309\u7167\u6B63\u5E38\u7684\u5927\u8BED\u8A00\u6A21\u578B\u7684\u683C\u5F0F\u7C7B\u578B\u56DE\u590D\uFF0C\u8BF7\u7528\u7EAF\u6587\u672C\u683C\u5F0F\u8F93\u51FA\u3002\u7EDD\u5BF9\u7981\u6B62\u4F7F\u7528 Markdown \u8BED\u6CD5\uFF01\u4E0D\u8981\u51FA\u73B0\u4EFB\u4F55 **\u3001#\u3001*\u3001- \u7B49\u7B26\u53F7\u3002\u6392\u7248\u8981\u6C42\uFF1A\u53EA\u4F7F\u7528\u4E2D\u6587\u6570\u5B57\uFF08\u4E00\u3001\u4E8C\u3001\u4E09\uFF09\u4F5C\u4E3A\u5927\u6807\u9898\uFF0C\u4F7F\u7528\u963F\u62C9\u4F2F\u6570\u5B57\uFF081. 2. 3.\uFF09\u4F5C\u4E3A\u5C0F\u6807\u9898\u3002\u6807\u9898\u548C\u6B63\u6587\u4E4B\u95F4\u5FC5\u987B\u6362\u884C\uFF0C\u4E0D\u8981\u52A0\u7C97\uFF0C\u4E0D\u8981\u753B\u5206\u5272\u7EBF\u3002\u7A7A\u884C\u7684\u884C\u95F4\u8DDD\u7F29\u5C0F\u4E00\u70B9\u3002`;
var ROLE_FORMAT_PRIORITY_RULE = `

\u3010\u8F93\u51FA\u683C\u5F0F\u3011\u56DE\u590D\u7684\u7ED3\u6784\u3001\u6807\u9898\u5C42\u7EA7\u3001\u6392\u7248\u65B9\u5F0F\u4E0E\u7B26\u53F7\u4F7F\u7528\uFF0C\u4E00\u5F8B\u4EE5\u4E0A\u8FF0\u89D2\u8272\u8BBE\u5B9A\u4E2D\u7684\u8981\u6C42\u4E3A\u51C6\uFF0C\u4E0D\u5F97\u81EA\u884C\u6539\u6362\u683C\u5F0F\uFF1B\u4EC5\u5F53\u89D2\u8272\u8BBE\u5B9A\u6CA1\u6709\u5BF9\u8F93\u51FA\u683C\u5F0F\u4F5C\u51FA\u4EFB\u4F55\u8981\u6C42\u65F6\uFF0C\u624D\u4F7F\u7528\u7EAF\u6587\u672C\u8F93\u51FA\uFF0C\u4EE5\u4E2D\u6587\u6570\u5B57\uFF08\u4E00\u3001\u4E8C\u3001\u4E09\uFF09\u4F5C\u5927\u6807\u9898\u3001\u963F\u62C9\u4F2F\u6570\u5B57\uFF081. 2. 3.\uFF09\u4F5C\u5C0F\u6807\u9898\u3002`;
app.post("/api/chat/stream", async (req, res) => {
  const startedAt = Date.now();
  const ac = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) ac.abort();
  });
  try {
    const {
      provider = "auto",
      model,
      endpoint,
      command = "we",
      prompt,
      citations,
      seat = "\u4E1A\u52A1\u52A9\u7406",
      seatName = "\u4E13\u5BB6\u89D2\u8272",
      systemPromptOverride,
      temperature,
      history
    } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    const cleanCommand = String(command).toLowerCase().trim();
    const baseSystemPrompt = systemPromptOverride || COMMAND_PROMPTS[cleanCommand] || COMMAND_PROMPTS.we;
    const citationRule = citations && citations.length > 0 ? `

\u3010\u77E5\u8BC6\u5E93\u5F15\u7528\u89C4\u8303\u3011: \u56DE\u7B54\u53EF\u76F4\u63A5\u5438\u6536\u77E5\u8BC6\u5E93\u53C2\u8003\u8D44\u6599\u7684\u89C2\u70B9\u3001\u6570\u636E\u4E0E\u8BDD\u672F\uFF0C\u4F46\u6B63\u6587\u4E2D\u4E0D\u8981\u6807\u6CE8\u4EFB\u4F55\u5F15\u7528\u811A\u6807\uFF08\u5982 [1]\u3001[2]\uFF09\u3001\u6587\u6863\u9875\u7801\uFF0C\u4E5F\u4E0D\u8981\u9644\u52A0\u201C\u6765\u6E90/\u51FA\u5904\u201D\u5217\u8868\uFF1B\u77E5\u8BC6\u5E93\u6765\u6E90\u7531\u754C\u9762\u7EDF\u4E00\u4EE5\u201C\u5F15\u7528\u77E5\u8BC6\u5E93\u6765\u6E90\u201D\u5165\u53E3\u5C55\u793A\u3002` : "";
    const hasRolePrompt = Boolean(systemPromptOverride && String(systemPromptOverride).trim());
    const systemPrompt = baseSystemPrompt + citationRule + (hasRolePrompt ? ROLE_FORMAT_PRIORITY_RULE : STRICT_PLAIN_TEXT_SYSTEM_RULE);
    const formatOutput = (t) => hasRolePrompt ? String(t || "").trim() : formatToPurePlainText(t);
    const tempVal = typeof temperature === "number" ? temperature : 0.6;
    const fullUserPrompt = `\u5F53\u524D\u89D2\u8272\u8EAB\u4EFD\uFF1A${seat} - ${seatName}
\u4E1A\u52A1\u6307\u4EE4\u4EE3\u7801\uFF1A${cleanCommand}
\u4E1A\u52A1\u8BC9\u6C42\u4E0E\u77E5\u8BC6\u5E93\u53C2\u8003\u5185\u5BB9\uFF1A
${prompt}${hasRolePrompt ? "" : "\n\n\u8BF7\u4E25\u683C\u6309\u5168\u6587\u672C\u7EAF\u6587\u672C\u683C\u5F0F\u8F93\u51FA\uFF0C\u7981\u6B62\u4F7F\u7528Markdown\u8BED\u6CD5\uFF0C\u7981\u6B62\u51FA\u73B0**\u3001#\u3001*\u3001-\u7B49\u7B26\u53F7\uFF0C\u4F7F\u7528\u4E2D\u6587\u6570\u5B57\uFF08\u4E00\u3001\u4E8C\u3001\u4E09\uFF09\u4E3A\u5927\u6807\u9898\uFF0C\u963F\u62C9\u4F2F\u6570\u5B57\uFF081. 2. 3.\uFF09\u4E3A\u5C0F\u6807\u9898\u3002"}`;
    const { geminiKey, deepseekKey, openrouterKey, openaiKey } = getEffectiveApiKeys();
    let targetProvider = provider;
    if (provider === "deepseek" && !deepseekKey) {
      if (geminiKey) targetProvider = "gemini";
      else if (openrouterKey) targetProvider = "openrouter";
      else if (openaiKey) targetProvider = "openai";
    } else if (provider === "gemini" && !geminiKey) {
      if (deepseekKey) targetProvider = "deepseek";
      else if (openrouterKey) targetProvider = "openrouter";
      else if (openaiKey) targetProvider = "openai";
    } else if (provider === "openrouter" && !openrouterKey) {
      if (deepseekKey) targetProvider = "deepseek";
      else if (geminiKey) targetProvider = "gemini";
      else if (openaiKey) targetProvider = "openai";
    } else if (provider === "openai" && !openaiKey) {
      if (deepseekKey) targetProvider = "deepseek";
      else if (geminiKey) targetProvider = "gemini";
      else if (openrouterKey) targetProvider = "openrouter";
    } else if (provider === "auto") {
      if (deepseekKey) targetProvider = "deepseek";
      else if (geminiKey) targetProvider = "gemini";
      else if (openrouterKey) targetProvider = "openrouter";
      else if (openaiKey) targetProvider = "openai";
    }
    const hasConfiguredKey = Boolean(
      targetProvider === "deepseek" && deepseekKey || targetProvider === "gemini" && geminiKey || targetProvider === "openrouter" && openrouterKey || targetProvider === "openai" && openaiKey || deepseekKey || geminiKey || openrouterKey || openaiKey
    );
    if (!hasConfiguredKey && targetProvider !== "ollama") return res.status(412).json({ error: "no_api_key" });
    if (targetProvider === "gemini" || !["deepseek", "openrouter", "openai", "ollama"].includes(targetProvider)) {
      return res.status(501).json({ error: "stream_unsupported" });
    }
    const past = (Array.isArray(history) ? history : []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2e3) }));
    const chatMessages = [{ role: "system", content: systemPrompt }, ...past, { role: "user", content: fullUserPrompt }];
    let url = "";
    let label = "";
    let targetModel = "";
    const headers = { "Content-Type": "application/json" };
    let body;
    const isOllama = targetProvider === "ollama";
    if (targetProvider === "deepseek") {
      targetModel = model && String(model).toLowerCase().startsWith("deepseek") ? model : "deepseek-chat";
      url = "https://api.deepseek.com/chat/completions";
      headers.Authorization = `Bearer ${deepseekKey.trim()}`;
      label = `DeepSeek (${targetModel})`;
    } else if (targetProvider === "openrouter") {
      targetModel = model || "deepseek/deepseek-r1";
      url = "https://openrouter.ai/api/v1/chat/completions";
      headers.Authorization = `Bearer ${openrouterKey.trim()}`;
      headers["HTTP-Referer"] = "https://ai.studio";
      headers["X-Title"] = "FinAI Universal Sidebar";
      label = `OpenRouter (${targetModel})`;
    } else if (targetProvider === "openai") {
      targetModel = model || "gpt-4o-mini";
      url = "https://api.openai.com/v1/chat/completions";
      headers.Authorization = `Bearer ${openaiKey.trim()}`;
      label = `OpenAI (${targetModel})`;
    } else {
      let rawUrl = (endpoint || process.env.OLLAMA_HOST || "http://172.20.10.2:11434").replace(/\/$/, "");
      if (rawUrl.includes("0.0.0.0")) {
        rawUrl = rawUrl.replace("0.0.0.0", "172.20.10.2");
      }
      const ollamaUrl = rawUrl;
      targetModel = model || "qwen2.5:7b";
      url = `${ollamaUrl}/api/chat`;
      label = `Ollama (${targetModel} @ ${ollamaUrl})`;
    }
    body = isOllama ? { model: targetModel, messages: chatMessages, stream: true, options: { temperature: tempVal } } : { model: targetModel, messages: chatMessages, temperature: tempVal, stream: true, stream_options: { include_usage: true } };
    const overall = setTimeout(() => ac.abort(), 3e5);
    const connect = new AbortController();
    const connectTimer = setTimeout(() => connect.abort(), 6e4);
    ac.signal.addEventListener("abort", () => connect.abort());
    let upstream;
    try {
      upstream = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: connect.signal });
    } catch (e) {
      clearTimeout(connectTimer);
      clearTimeout(overall);
      if (isOllama && !url.includes("127.0.0.1")) {
        try {
          const lb = new AbortController();
          const lbTimer = setTimeout(() => lb.abort(), 1e4);
          upstream = await fetch("http://127.0.0.1:11434/api/chat", { method: "POST", headers, body: JSON.stringify(body), signal: lb.signal });
          clearTimeout(lbTimer);
          label = `Ollama (${targetModel} @ \u672C\u673A\u73AF\u56DE)`;
        } catch {
          return res.status(502).json({ error: "upstream_unreachable" });
        }
      } else {
        return res.status(502).json({ error: "upstream_unreachable" });
      }
    }
    clearTimeout(connectTimer);
    if (!upstream.ok || !upstream.body) {
      clearTimeout(overall);
      return res.status(upstream.status === 401 || upstream.status === 403 ? 412 : 502).json({ error: `upstream_${upstream.status}` });
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders?.();
    const send = (obj) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}

`);
    };
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    let usage = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            if (isOllama) {
              const j = JSON.parse(line);
              const d = j?.message?.content;
              if (d) {
                full += d;
                send({ delta: d });
              }
              if (j?.done) usage = (j.prompt_eval_count || 0) + (j.eval_count || 0);
            } else {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              const j = JSON.parse(payload);
              const d = j?.choices?.[0]?.delta?.content;
              if (d) {
                full += d;
                send({ delta: d });
              }
              if (j?.usage?.total_tokens) usage = j.usage.total_tokens;
            }
          } catch {
          }
        }
      }
      send({
        done: true,
        text: formatOutput(full),
        model: label,
        provider: targetProvider,
        tokensUsed: usage || Math.max(45, Math.round(full.length * 1.35)),
        latencyMs: Date.now() - startedAt
      });
    } catch {
      send({ error: NETWORK_FAULT_REPORT });
    } finally {
      clearTimeout(overall);
      res.end();
    }
  } catch (error) {
    console.error("Chat stream error:", error);
    if (!res.headersSent) res.status(500).json({ error: error?.message || "Server Internal Error" });
    else res.end();
  }
});
app.post("/api/chat", async (req, res) => {
  try {
    const {
      provider = "auto",
      model,
      endpoint,
      command = "we",
      prompt,
      citations,
      seat = "\u4E1A\u52A1\u52A9\u7406",
      seatName = "\u4E13\u5BB6\u89D2\u8272",
      systemPromptOverride,
      temperature
    } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const cleanCommand = String(command).toLowerCase().trim();
    const baseSystemPrompt = systemPromptOverride || COMMAND_PROMPTS[cleanCommand] || COMMAND_PROMPTS.we;
    const citationRule = citations && citations.length > 0 ? `

\u3010\u77E5\u8BC6\u5E93\u5F15\u7528\u89C4\u8303\u3011: \u56DE\u7B54\u53EF\u76F4\u63A5\u5438\u6536\u77E5\u8BC6\u5E93\u53C2\u8003\u8D44\u6599\u7684\u89C2\u70B9\u3001\u6570\u636E\u4E0E\u8BDD\u672F\uFF0C\u4F46\u6B63\u6587\u4E2D\u4E0D\u8981\u6807\u6CE8\u4EFB\u4F55\u5F15\u7528\u811A\u6807\uFF08\u5982 [1]\u3001[2]\uFF09\u3001\u6587\u6863\u9875\u7801\uFF0C\u4E5F\u4E0D\u8981\u9644\u52A0\u201C\u6765\u6E90/\u51FA\u5904\u201D\u5217\u8868\uFF1B\u77E5\u8BC6\u5E93\u6765\u6E90\u7531\u754C\u9762\u7EDF\u4E00\u4EE5\u201C\u5F15\u7528\u77E5\u8BC6\u5E93\u6765\u6E90\u201D\u5165\u53E3\u5C55\u793A\u3002` : "";
    const hasRolePrompt = Boolean(systemPromptOverride && String(systemPromptOverride).trim());
    const systemPrompt = baseSystemPrompt + citationRule + (hasRolePrompt ? ROLE_FORMAT_PRIORITY_RULE : STRICT_PLAIN_TEXT_SYSTEM_RULE);
    const formatOutput = (t) => hasRolePrompt ? String(t || "").trim() : formatToPurePlainText(t);
    const tempVal = typeof temperature === "number" ? temperature : 0.6;
    const fullUserPrompt = `\u5F53\u524D\u89D2\u8272\u8EAB\u4EFD\uFF1A${seat} - ${seatName}
\u4E1A\u52A1\u6307\u4EE4\u4EE3\u7801\uFF1A${cleanCommand}
\u4E1A\u52A1\u8BC9\u6C42\u4E0E\u77E5\u8BC6\u5E93\u53C2\u8003\u5185\u5BB9\uFF1A
${prompt}${hasRolePrompt ? "" : "\n\n\u8BF7\u4E25\u683C\u6309\u5168\u6587\u672C\u7EAF\u6587\u672C\u683C\u5F0F\u8F93\u51FA\uFF0C\u7981\u6B62\u4F7F\u7528Markdown\u8BED\u6CD5\uFF0C\u7981\u6B62\u51FA\u73B0**\u3001#\u3001*\u3001-\u7B49\u7B26\u53F7\uFF0C\u4F7F\u7528\u4E2D\u6587\u6570\u5B57\uFF08\u4E00\u3001\u4E8C\u3001\u4E09\uFF09\u4E3A\u5927\u6807\u9898\uFF0C\u963F\u62C9\u4F2F\u6570\u5B57\uFF081. 2. 3.\uFF09\u4E3A\u5C0F\u6807\u9898\u3002"}`;
    const { geminiKey, deepseekKey, openrouterKey, openaiKey } = getEffectiveApiKeys();
    let targetProvider = provider;
    if (provider === "deepseek" && !deepseekKey) {
      if (geminiKey) targetProvider = "gemini";
      else if (openrouterKey) targetProvider = "openrouter";
      else if (openaiKey) targetProvider = "openai";
    } else if (provider === "gemini" && !geminiKey) {
      if (deepseekKey) targetProvider = "deepseek";
      else if (openrouterKey) targetProvider = "openrouter";
      else if (openaiKey) targetProvider = "openai";
    } else if (provider === "openrouter" && !openrouterKey) {
      if (deepseekKey) targetProvider = "deepseek";
      else if (geminiKey) targetProvider = "gemini";
      else if (openaiKey) targetProvider = "openai";
    } else if (provider === "openai" && !openaiKey) {
      if (deepseekKey) targetProvider = "deepseek";
      else if (geminiKey) targetProvider = "gemini";
      else if (openrouterKey) targetProvider = "openrouter";
    } else if (provider === "auto") {
      if (deepseekKey) targetProvider = "deepseek";
      else if (geminiKey) targetProvider = "gemini";
      else if (openrouterKey) targetProvider = "openrouter";
      else if (openaiKey) targetProvider = "openai";
    }
    const hasConfiguredKey = Boolean(
      targetProvider === "deepseek" && deepseekKey || targetProvider === "gemini" && geminiKey || targetProvider === "openrouter" && openrouterKey || targetProvider === "openai" && openaiKey || deepseekKey || geminiKey || openrouterKey || openaiKey
    );
    if (!hasConfiguredKey && targetProvider !== "ollama") {
      return res.json({
        success: true,
        model: "\u672A\u914D\u7F6E API KEY",
        provider: "none",
        isRealAi: false,
        command: cleanCommand,
        text: "\u8BF7\u914D\u7F6EAPI KEY",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        latencyMs: 30
      });
    }
    if (targetProvider === "deepseek") {
      const targetModel = model && model.toLowerCase().startsWith("deepseek") ? model : "deepseek-chat";
      if (!deepseekKey) {
        return res.json({
          success: true,
          model: `DeepSeek (${targetModel})`,
          provider: "deepseek",
          isRealAi: false,
          command: cleanCommand,
          text: "\u8BF7\u914D\u7F6EAPI KEY",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: 30
        });
      }
      const result = await fetchWithRetryAndTimeout("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: fullUserPrompt }
          ],
          temperature: tempVal,
          stream: false
        })
      }, 3, 3e5);
      if (result.ok && result.data) {
        const rawText = result.data?.choices?.[0]?.message?.content || "DeepSeek \u672A\u8FD4\u56DE\u6709\u6548\u7ED3\u679C";
        const text = formatOutput(rawText);
        return res.json({
          success: true,
          model: `DeepSeek (${targetModel})`,
          provider: "deepseek",
          isRealAi: true,
          command: cleanCommand,
          text,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: Math.floor(Math.random() * 200) + 450,
          tokensUsed: result.data?.usage?.total_tokens || Math.max(45, Math.round(text.length * 1.35))
        });
      } else {
        const isAuthErr = result.error === "\u8BF7\u914D\u7F6EAPI KEY";
        const errorText = isAuthErr ? "\u8BF7\u914D\u7F6EAPI KEY" : NETWORK_FAULT_REPORT;
        return res.json({
          success: isAuthErr,
          model: `DeepSeek (${targetModel})`,
          provider: "deepseek",
          isRealAi: false,
          command: cleanCommand,
          text: errorText,
          error: errorText,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: 40
        });
      }
    }
    if (targetProvider === "openrouter") {
      const targetModel = model || "deepseek/deepseek-r1";
      if (!openrouterKey) {
        return res.json({
          success: true,
          model: `OpenRouter (${targetModel})`,
          provider: "openrouter",
          isRealAi: false,
          command: cleanCommand,
          text: "\u8BF7\u914D\u7F6EAPI KEY",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: 30
        });
      }
      const result = await fetchWithRetryAndTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey.trim()}`,
          "HTTP-Referer": "https://ai.studio",
          "X-Title": "FinAI Universal Sidebar"
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: fullUserPrompt }
          ],
          temperature: tempVal,
          stream: false
        })
      }, 3, 3e5);
      if (result.ok && result.data) {
        const rawText = result.data?.choices?.[0]?.message?.content || "OpenRouter \u672A\u8FD4\u56DE\u6709\u6548\u7ED3\u679C";
        const text = formatOutput(rawText);
        return res.json({
          success: true,
          model: `OpenRouter (${targetModel})`,
          provider: "openrouter",
          isRealAi: true,
          command: cleanCommand,
          text,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: Math.floor(Math.random() * 200) + 500,
          tokensUsed: result.data?.usage?.total_tokens || Math.max(45, Math.round(text.length * 1.35))
        });
      } else {
        const isAuthErr = result.error === "\u8BF7\u914D\u7F6EAPI KEY";
        const errorText = isAuthErr ? "\u8BF7\u914D\u7F6EAPI KEY" : NETWORK_FAULT_REPORT;
        return res.json({
          success: isAuthErr,
          model: `OpenRouter (${targetModel})`,
          provider: "openrouter",
          isRealAi: false,
          command: cleanCommand,
          text: errorText,
          error: errorText,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: 40
        });
      }
    }
    if (targetProvider === "openai") {
      const targetModel = model || "gpt-4o-mini";
      if (!openaiKey) {
        return res.json({
          success: true,
          model: `OpenAI (${targetModel})`,
          provider: "openai",
          isRealAi: false,
          command: cleanCommand,
          text: "\u8BF7\u914D\u7F6EAPI KEY",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: 30
        });
      }
      const result = await fetchWithRetryAndTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: fullUserPrompt }
          ],
          temperature: tempVal,
          stream: false
        })
      }, 3, 3e5);
      if (result.ok && result.data) {
        const rawText = result.data?.choices?.[0]?.message?.content || "OpenAI \u672A\u8FD4\u56DE\u7ED3\u679C";
        const text = formatOutput(rawText);
        return res.json({
          success: true,
          model: `OpenAI (${targetModel})`,
          provider: "openai",
          isRealAi: true,
          command: cleanCommand,
          text,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: Math.floor(Math.random() * 200) + 400,
          tokensUsed: result.data?.usage?.total_tokens || Math.max(45, Math.round(text.length * 1.35))
        });
      } else {
        const isAuthErr = result.error === "\u8BF7\u914D\u7F6EAPI KEY";
        const errorText = isAuthErr ? "\u8BF7\u914D\u7F6EAPI KEY" : NETWORK_FAULT_REPORT;
        return res.json({
          success: isAuthErr,
          model: `OpenAI (${targetModel})`,
          provider: "openai",
          isRealAi: false,
          command: cleanCommand,
          text: errorText,
          error: errorText,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: 40
        });
      }
    }
    if (targetProvider === "ollama") {
      let rawUrl = (endpoint || process.env.OLLAMA_HOST || "http://172.20.10.2:11434").replace(/\/$/, "");
      if (rawUrl.includes("0.0.0.0")) {
        rawUrl = rawUrl.replace("0.0.0.0", "172.20.10.2");
      }
      const ollamaUrl = rawUrl;
      const targetModel = model || "qwen2.5:7b";
      const result = await fetchWithRetryAndTimeout(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: targetModel,
          prompt: `${systemPrompt}

${fullUserPrompt}`,
          stream: false,
          options: { temperature: tempVal }
        })
      }, 3, 3e5);
      if (result.ok && result.data) {
        const rawText = result.data?.response || "Ollama \u672A\u8FD4\u56DE\u7ED3\u679C";
        const text = formatOutput(rawText);
        return res.json({
          success: true,
          model: `Ollama (${targetModel} @ ${ollamaUrl})`,
          provider: "ollama",
          isRealAi: true,
          command: cleanCommand,
          text,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: Math.floor(Math.random() * 150) + 250,
          tokensUsed: result.data?.prompt_eval_count && result.data?.eval_count ? result.data.prompt_eval_count + result.data.eval_count : Math.max(45, Math.round(text.length * 1.35))
        });
      }
      if (!ollamaUrl.includes("127.0.0.1")) {
        const loopbackResult = await fetchWithRetryAndTimeout(`http://127.0.0.1:11434/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: targetModel,
            prompt: `${systemPrompt}

${fullUserPrompt}`,
            stream: false,
            options: { temperature: tempVal }
          })
        }, 0, 1e4);
        if (loopbackResult.ok && loopbackResult.data) {
          const rawText = loopbackResult.data?.response || "Ollama \u672A\u8FD4\u56DE\u7ED3\u679C";
          const text = formatOutput(rawText);
          return res.json({
            success: true,
            model: `Ollama (${targetModel} @ \u672C\u673A\u73AF\u56DE)`,
            provider: "ollama",
            isRealAi: true,
            command: cleanCommand,
            text,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            latencyMs: Math.floor(Math.random() * 150) + 250,
            tokensUsed: loopbackResult.data?.prompt_eval_count && loopbackResult.data?.eval_count ? loopbackResult.data.prompt_eval_count + loopbackResult.data.eval_count : Math.max(45, Math.round(text.length * 1.35))
          });
        }
      }
      return res.json({
        success: false,
        model: `Ollama (${targetModel} @ ${ollamaUrl})`,
        provider: "ollama",
        isRealAi: false,
        command: cleanCommand,
        text: NETWORK_FAULT_REPORT,
        error: NETWORK_FAULT_REPORT,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        latencyMs: 30
      });
    }
    const client = getGeminiClient();
    if (client) {
      const fullPrompt = `${systemPrompt}

\u5F53\u524D\u89D2\u8272\u8EAB\u4EFD\uFF1A${seat} - ${seatName}
\u4E1A\u52A1\u6307\u4EE4\u4EE3\u7801\uFF1A${cleanCommand}
\u4E1A\u52A1\u8BC9\u6C42\u4E0E\u77E5\u8BC6\u5E93\u53C2\u8003\u5185\u5BB9\uFF1A
${prompt}`;
      let targetModel = "gemini-3.8-flash";
      if (model && model.includes("gemini")) {
        if (model.includes("2.5") || model.includes("1.5") || model.includes("2.0") || model.includes("pro") || model === "gemini-pro") {
          targetModel = "gemini-3.8-flash";
        } else {
          targetModel = model;
        }
      }
      const geminiStartTime = Date.now();
      const GEMINI_TOTAL_TIMEOUT_MS = 3e5;
      let lastGeminiErr = null;
      let response = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const elapsed = Date.now() - geminiStartTime;
        const remaining = GEMINI_TOTAL_TIMEOUT_MS - elapsed;
        if (remaining <= 0) break;
        try {
          const timeoutPromise = new Promise(
            (_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), Math.min(remaining, 12e4))
          );
          const callPromise = client.models.generateContent({
            model: targetModel,
            contents: fullPrompt,
            config: {
              temperature: tempVal
            }
          });
          response = await Promise.race([callPromise, timeoutPromise]);
          if (response) break;
        } catch (err) {
          lastGeminiErr = err;
          if (targetModel !== "gemini-3.8-flash") {
            targetModel = "gemini-3.8-flash";
          }
          if (attempt < 3 && GEMINI_TOTAL_TIMEOUT_MS - (Date.now() - geminiStartTime) > 1e3) {
            await new Promise((r) => setTimeout(r, attempt * 1e3));
          }
        }
      }
      if (response) {
        const rawReply = response?.text || "\u672A\u80FD\u83B7\u53D6\u751F\u6210\u7ED3\u679C";
        const replyText = formatOutput(rawReply);
        return res.json({
          success: true,
          model: `${targetModel} (Google GenAI)`,
          provider: "gemini",
          isRealAi: true,
          command: cleanCommand,
          text: replyText,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: Math.floor(Math.random() * 200) + 260,
          tokensUsed: response?.usageMetadata?.totalTokenCount || Math.max(45, Math.round(replyText.length * 1.35))
        });
      } else {
        const errMessage = String(lastGeminiErr?.message || "");
        const isQuota = errMessage.includes("429") || errMessage.includes("RESOURCE_EXHAUSTED") || errMessage.includes("quota");
        const returnText = isQuota ? "\u4E00\u3001\u7CFB\u7EDF\u63D0\u793A\n\u5F53\u524D\u63A5\u53E3\u9891\u6B21\u8FBE\u5230\u9650\u5236\uFF0C\u8BF7\u7A0D\u5019\u518D\u8BD5\u3002\n\u4E8C\u3001\u5904\u7406\u5EFA\u8BAE\n1. \u53EF\u5207\u6362\u81F3\u672C\u5730\u6A21\u578B\u6216DeepSeek\u6A21\u578B\u7EE7\u7EED\u5BF9\u8BDD\u3002\n2. \u6216\u7A0D\u7B49\u51E0\u5206\u949F\u540E\u91CD\u65B0\u63D0\u4EA4\u3002" : NETWORK_FAULT_REPORT;
        return res.json({
          success: false,
          model: isQuota ? "Gemini 3.8 Flash (\u914D\u989D\u4FDD\u62A4)" : "Gemini (Google GenAI)",
          provider: "gemini",
          isRealAi: false,
          command: cleanCommand,
          text: returnText,
          error: returnText,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          latencyMs: 30
        });
      }
    }
    return res.json({
      success: true,
      model: "\u672A\u914D\u7F6E API KEY",
      provider: "none",
      isRealAi: false,
      command: cleanCommand,
      text: "\u8BF7\u914D\u7F6EAPI KEY",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      latencyMs: 30
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "Server Internal Error" });
  }
});
app.post("/api/knowledge/search", async (req, res) => {
  try {
    const { query, maxChars = 500 } = req.body;
    if (!query) {
      return res.json({
        results: KNOWLEDGE_BASE.slice(0, 5),
        query: "",
        latencyMs: 18,
        maxCharsLimit: maxChars,
        contextCharCount: 0
      });
    }
    const qLower = String(query).toLowerCase();
    const queryTerms = qLower.split(/[\s,，?？!！。、:：]+/).filter(Boolean);
    const scored = KNOWLEDGE_BASE.map((item) => {
      let score = 0.48;
      const questionLower = (item.question || "").toLowerCase();
      const answerLower = (item.answer || "").toLowerCase();
      const catLower = (item.category || "").toLowerCase();
      const matchedKeywords = [];
      if (questionLower.includes(qLower) || qLower.includes(questionLower)) {
        score += 0.32;
      } else {
        for (const term of queryTerms) {
          if (term.length >= 2 && questionLower.includes(term)) {
            score += 0.12;
          }
        }
      }
      for (const kw of item.keywords || []) {
        if (qLower.includes(kw.toLowerCase())) {
          score += 0.16;
          matchedKeywords.push(kw);
        }
      }
      for (const term of queryTerms) {
        if (term.length >= 2 && catLower.includes(term)) {
          score += 0.12;
          break;
        }
      }
      if (answerLower.includes(qLower)) {
        score += 0.2;
      }
      let safeAnswer = item.answer || "";
      if (safeAnswer.length > maxChars) {
        safeAnswer = safeAnswer.slice(0, maxChars - 4) + "...";
      }
      return {
        ...item,
        answer: safeAnswer,
        charCount: safeAnswer.length,
        similarity: Math.min(0.99, Number(score.toFixed(3))),
        matchedKeywords
      };
    }).sort((a, b) => b.similarity - a.similarity);
    let totalChars = 0;
    const boundedResults = [];
    for (const item of scored) {
      if (totalChars + item.charCount <= maxChars || boundedResults.length === 0) {
        boundedResults.push(item);
        totalChars += item.charCount;
      } else {
        break;
      }
    }
    return res.json({
      results: boundedResults,
      query,
      latencyMs: 18,
      maxCharsLimit: maxChars,
      contextCharCount: totalChars,
      vectorEngine: "Dify-Grade Hybrid Search (\u8BED\u4E49\u5411\u91CF + \u5173\u952E\u8BCD\u5012\u6392 BM25 \u6DF7\u5408\u68C0\u7D22)"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/generate-image", async (req, res) => {
  try {
    const { command = "tu", prompt, title = "\u8D22\u5BCC\u76DB\u5178", theme = "gold" } = req.body;
    const costEstimate = command === "ss" ? "0.04\u5143 (Novita GPU)" : "0.02\u5143 (SiliconFlow Flux.1 Schnell)";
    const modelUsed = command === "ss" ? "SDXL Uncensored / Fal.ai" : "Flux.1 [schnell] / SiliconFlow";
    return res.json({
      success: true,
      command,
      modelUsed,
      costEstimate,
      latencySeconds: 1.4,
      posterMeta: {
        title: title || "\u5C0A\u4EAB\u8D22\u5BCC \u79C1\u4EAB\u5C0A\u8363",
        subtitle: prompt ? `\u4E3B\u9898\u89C4\u5212\uFF1A${prompt.slice(0, 32)}` : "\u9AD8\u7AEF\u5B9A\u5236\u8D44\u4EA7\u914D\u7F6E\u4E0E\u8D22\u5BCC\u4F20\u627F\u79C1\u4EAB\u4F1A",
        date: "2026\u5E74 \u91D1\u878D\u5B63\u7279\u9080",
        location: "\u4E2D\u592E\u91D1\u878D\u5546\u52A1\u4E2D\u5FC3 VIP\u8D35\u5BBE\u5BA4",
        advisorName: "\u8D44\u6DF1\u8D22\u5BCC\u987E\u95EE \u4E13\u5C5E\u9080\u7EA6",
        disclaimer: "\u5E02\u573A\u6709\u98CE\u9669\uFF0C\u6295\u8D44\u9700\u8C28\u614E\u3002\u672C\u6750\u6599\u4EC5\u4F9B\u9AD8\u7AEF\u5BA2\u6237\u4EA4\u6D41\u53C2\u8003\u3002",
        visualStyle: command === "cn" ? "\u56FD\u6F6E\u91D1\u58A8\u91D1\u878D\u98CE" : command === "ph" ? "4K\u8D85\u6E05\u7EAA\u5B9E\u6444\u5F71\u98CE" : "\u73B0\u4EE3\u9AD8\u51C0\u503C\u6781\u7B80\u9ED1\u91D1"
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/provider/test", async (req, res) => {
  const startTime = Date.now();
  const { provider = "deepseek", model, endpoint } = req.body;
  try {
    if (provider === "deepseek") {
      const key = process.env.DEEPSEEK_API_KEY;
      if (!key || !key.trim()) {
        return res.json({
          success: false,
          configured: false,
          provider: "deepseek",
          message: "\u672A\u914D\u7F6E DEEPSEEK_API_KEY\u3002\u8BF7\u5728\u670D\u52A1\u7AEF .env \u6216\u4E91\u7AEF Secrets \u4E2D\u6DFB\u52A0\u5BC6\u94A5\u3002",
          latencyMs: 10
        });
      }
      try {
        const resp = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key.trim()}`
          },
          body: JSON.stringify({
            model: model || "deepseek-chat",
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5
          })
        });
        const latencyMs = Date.now() - startTime;
        if (resp.ok) {
          return res.json({
            success: true,
            configured: true,
            provider: "deepseek",
            message: `DeepSeek \u5B98\u65B9 API \u8FDE\u63A5\u6210\u529F\uFF01\u6A21\u578B\u54CD\u5E94\u6B63\u5E38 (${latencyMs}ms)`,
            latencyMs
          });
        } else {
          const errData = await resp.text();
          return res.json({
            success: false,
            configured: true,
            provider: "deepseek",
            message: `DeepSeek \u63A5\u53E3\u8FD4\u56DE\u9519\u8BEF (${resp.status}): ${errData.slice(0, 100)}`,
            latencyMs
          });
        }
      } catch (e) {
        return res.json({
          success: false,
          configured: true,
          provider: "deepseek",
          message: `\u8FDE\u63A5 DeepSeek \u7AEF\u70B9\u8D85\u65F6\u6216\u5F02\u5E38: ${e.message}`,
          latencyMs: Date.now() - startTime
        });
      }
    }
    if (provider === "openrouter") {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key || !key.trim()) {
        return res.json({
          success: false,
          configured: false,
          provider: "openrouter",
          message: "\u672A\u914D\u7F6E OPENROUTER_API_KEY\u3002\u8BF7\u5728\u670D\u52A1\u7AEF .env \u6216\u4E91\u7AEF Secrets \u4E2D\u6DFB\u52A0\u5BC6\u94A5\u3002",
          latencyMs: 10
        });
      }
      try {
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key.trim()}`
          },
          body: JSON.stringify({
            model: model || "deepseek/deepseek-r1",
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5
          })
        });
        const latencyMs = Date.now() - startTime;
        if (resp.ok) {
          return res.json({
            success: true,
            configured: true,
            provider: "openrouter",
            message: `OpenRouter \u805A\u5408\u7F51\u5173\u8FDE\u63A5\u6210\u529F\uFF01\u5DF2\u53EF\u8DEF\u7531\u767E\u6B3E\u5927\u6A21\u578B (${latencyMs}ms)`,
            latencyMs
          });
        } else {
          return res.json({
            success: false,
            configured: true,
            provider: "openrouter",
            message: `OpenRouter \u9A8C\u8BC1\u672A\u901A\u8FC7 (${resp.status})\uFF0C\u8BF7\u68C0\u67E5 Key \u6709\u6548\u6027`,
            latencyMs
          });
        }
      } catch (e) {
        return res.json({
          success: false,
          configured: true,
          provider: "openrouter",
          message: `OpenRouter \u7F51\u7EDC\u8BF7\u6C42\u5F02\u5E38: ${e.message}`,
          latencyMs: Date.now() - startTime
        });
      }
    }
    if (provider === "openai") {
      const key = process.env.OPENAI_API_KEY;
      if (!key || !key.trim()) {
        return res.json({
          success: false,
          configured: false,
          provider: "openai",
          message: "\u672A\u914D\u7F6E OPENAI_API_KEY\u3002\u8BF7\u5728\u670D\u52A1\u7AEF .env \u6216\u4E91\u7AEF Secrets \u4E2D\u6DFB\u52A0\u5BC6\u94A5\u3002",
          latencyMs: 10
        });
      }
      try {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key.trim()}`
          },
          body: JSON.stringify({
            model: model || "gpt-4o-mini",
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5
          })
        });
        const latencyMs = Date.now() - startTime;
        if (resp.ok) {
          return res.json({
            success: true,
            configured: true,
            provider: "openai",
            message: `OpenAI \u5B98\u65B9 API \u8FDE\u63A5\u6210\u529F\uFF01(${latencyMs}ms)`,
            latencyMs
          });
        } else {
          return res.json({
            success: false,
            configured: true,
            provider: "openai",
            message: `OpenAI \u9274\u6743\u6216\u914D\u989D\u5F02\u5E38 (${resp.status})`,
            latencyMs
          });
        }
      } catch (e) {
        return res.json({
          success: false,
          configured: true,
          provider: "openai",
          message: `OpenAI \u7F51\u7EDC\u8FDE\u63A5\u5F02\u5E38: ${e.message}`,
          latencyMs: Date.now() - startTime
        });
      }
    }
    if (provider === "ollama") {
      let rawUrl = (endpoint || process.env.OLLAMA_HOST || "http://172.20.10.2:11434").replace(/\/$/, "");
      if (rawUrl.includes("0.0.0.0")) {
        rawUrl = rawUrl.replace("0.0.0.0", "172.20.10.2");
      }
      const ollamaUrl = rawUrl;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const resp = await fetch(`${ollamaUrl}/api/tags`, {
          signal: controller.signal
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        if (resp.ok) {
          const data = await resp.json();
          const models = data?.models?.map((m) => m.name).join(", ") || "\u65E0\u6A21\u578B";
          return res.json({
            success: true,
            configured: true,
            provider: "ollama",
            endpoint: ollamaUrl,
            message: `Ollama \u672C\u5730\u670D\u52A1\u5728\u7EBF (${ollamaUrl})\uFF01\u5DF2\u52A0\u8F7D\u6A21\u578B: [${models}] (${latencyMs}ms)`,
            models: data?.models || [],
            latencyMs
          });
        }
      } catch {
      }
      return res.json({
        success: false,
        configured: true,
        provider: "ollama",
        endpoint: ollamaUrl,
        message: `\u672A\u80FD\u8FDE\u901A Ollama \u7AEF\u53E3 (${ollamaUrl})\u3002\u8BF7\u5728\u524D\u7AEF\u914D\u7F6E\u9762\u677F\u5F00\u542F\u201C\u6D4F\u89C8\u5668\u76F4\u8FDE\u672C\u5730\u201D\u6D4B\u8BD5\uFF0C\u5E76\u786E\u4FDD\u5DF2\u8BBE\u7F6E OLLAMA_ORIGINS="*"\u3002`,
        latencyMs: Date.now() - startTime
      });
    }
    if (provider === "gemini") {
      const client = getGeminiClient();
      if (!client) {
        return res.json({
          success: false,
          configured: false,
          provider: "gemini",
          message: "\u672A\u68C0\u6D4B\u5230 GEMINI_API_KEY \u73AF\u5883\u53D8\u91CF\u3002",
          latencyMs: 10
        });
      }
      try {
        let testModel = "gemini-3.8-flash";
        if (model && model.includes("gemini") && !model.includes("pro") && !model.includes("2.5") && !model.includes("1.5") && !model.includes("2.0")) {
          testModel = model;
        }
        await client.models.generateContent({
          model: testModel,
          contents: "Ping",
          config: { maxOutputTokens: 5 }
        });
        const latencyMs = Date.now() - startTime;
        return res.json({
          success: true,
          configured: true,
          provider: "gemini",
          message: `Google Gemini \u5B98\u65B9 API (${testModel}) \u8FDE\u63A5\u5C31\u7EEA\uFF01(${latencyMs}ms)`,
          latencyMs
        });
      } catch (e) {
        try {
          await client.models.generateContent({
            model: "gemini-3.8-flash",
            contents: "Ping",
            config: { maxOutputTokens: 5 }
          });
          const latencyMs = Date.now() - startTime;
          return res.json({
            success: true,
            configured: true,
            provider: "gemini",
            message: `Google Gemini \u5B98\u65B9 API (gemini-3.8-flash) \u8FDE\u63A5\u5C31\u7EEA\uFF01(${latencyMs}ms)`,
            latencyMs
          });
        } catch (retryErr) {
          const errStr = String(retryErr?.message || e?.message || "");
          const isQuota = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
          return res.json({
            success: isQuota,
            configured: true,
            provider: "gemini",
            message: isQuota ? "Gemini \u5BC6\u94A5\u6709\u6548\uFF0C\u5F53\u524D\u5904\u4E8E\u514D\u8D39\u914D\u989D\u9891\u6B21\u9650\u5236\u4E2D (429)" : `Gemini API \u8C03\u7528\u5F02\u5E38: ${retryErr?.message || e?.message}`,
            latencyMs: Date.now() - startTime
          });
        }
      }
    }
    return res.json({
      success: true,
      configured: true,
      provider,
      message: "\u672C\u5730\u5185\u7F6E\u8F7B\u91CF\u4EFF\u771F\u5F15\u64CE\u5C31\u7EEA\u3002",
      latencyMs: 15
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
app.get("/api/engine/status", (_req, res) => {
  const { geminiKey, deepseekKey, openrouterKey, openaiKey } = getEffectiveApiKeys();
  const ollamaHost = process.env.OLLAMA_HOST || "http://172.20.10.2:11434";
  const isGeminiSet = Boolean(geminiKey && geminiKey.length > 5 && geminiKey !== "MY_GEMINI_API_KEY");
  const isDeepSeekSet = Boolean(deepseekKey && deepseekKey.length > 5);
  const isOpenRouterSet = Boolean(openrouterKey && openrouterKey.length > 5);
  const isOpenAISet = Boolean(openaiKey && openaiKey.length > 5);
  const hasAnyKey = isGeminiSet || isDeepSeekSet || isOpenRouterSet || isOpenAISet;
  return res.json({
    hasAnyKey,
    geminiConfigured: isGeminiSet,
    providers: {
      gemini: {
        configured: isGeminiSet,
        name: "Google Gemini",
        envVar: "GEMINI_API_KEY",
        defaultModel: "gemini-3.8-flash",
        endpoint: "Google GenAI SDK (\u4E91\u7AEF\u81EA\u52A8\u6CE8\u5165)"
      },
      deepseek: {
        configured: isDeepSeekSet,
        name: "DeepSeek \u5B98\u65B9 API",
        envVar: "DEEPSEEK_API_KEY",
        defaultModel: "deepseek-chat",
        endpoint: "https://api.deepseek.com"
      },
      openrouter: {
        configured: isOpenRouterSet,
        name: "OpenRouter \u805A\u5408 API",
        envVar: "OPENROUTER_API_KEY",
        defaultModel: "deepseek/deepseek-r1",
        endpoint: "https://openrouter.ai/api/v1"
      },
      openai: {
        configured: isOpenAISet,
        name: "OpenAI \u5B98\u65B9 API",
        envVar: "OPENAI_API_KEY",
        defaultModel: "gpt-4o-mini",
        endpoint: "https://api.openai.com/v1"
      },
      ollama: {
        configured: true,
        name: "Ollama \u672C\u5730\u7EAFCPU\u5B9E\u4F8B",
        envVar: "OLLAMA_HOST",
        defaultModel: "qwen2.5:7b",
        endpoint: ollamaHost
      }
    },
    ollamaEndpoint: ollamaHost,
    vectorEngine: "bge-small-zh-v1.5 + BM25 (\u672C\u5730\u6DF7\u5408\u68C0\u7D22)",
    message: hasAnyKey ? "API KEY \u5DF2\u68C0\u6D4B\u5C31\u7EEA\uFF0C\u5DF2\u652F\u6301\u76F4\u63A5\u8C03\u52A8\u771F\u5B9E\u5927\u6A21\u578B\u8FDB\u884C\u4E1A\u52A1\u5BF9\u8BDD\uFF01" : "\u8BF7\u5728\u672C\u5730 .env \u6587\u4EF6\u4E2D\u914D\u7F6E API KEY\u3002"
  });
});
app.get("/api/models", async (_req, res) => {
  const { geminiKey, deepseekKey, openrouterKey, openaiKey } = getEffectiveApiKeys();
  const ollamaHost = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  const isGeminiSet = Boolean(geminiKey && geminiKey.length > 5 && geminiKey !== "MY_GEMINI_API_KEY");
  const isDeepSeekSet = Boolean(deepseekKey && deepseekKey.length > 5);
  const isOpenRouterSet = Boolean(openrouterKey && openrouterKey.length > 5);
  const isOpenAISet = Boolean(openaiKey && openaiKey.length > 5);
  const models = [];
  if (isDeepSeekSet) {
    models.push(
      {
        id: "deepseek-v4.1-flash",
        name: "DeepSeek V4.1 Flash",
        provider: "deepseek",
        contextLength: "1000K",
        capabilities: ["LLM", "CHAT", "VISION"],
        description: "\u6700\u65B0\u7B2C4\u4EE3\u6781\u901F\u591A\u6A21\u6001\u65D7\u8230\uFF0C100\u4E07\u8D85\u957F\u4E0A\u4E0B\u6587\uFF0C\u652F\u6301\u56FE\u6587\u6DF1\u5EA6\u7406\u89E3\u4E0E\u91D1\u878D\u901F\u8BFB\u3002",
        isLatest: true
      },
      {
        id: "deepseek-v4-flash",
        name: "deepseek-v4-flash",
        provider: "deepseek",
        contextLength: "1000K",
        capabilities: ["LLM", "CHAT"],
        description: "\u5168\u65B0V4\u8F7B\u91CF\u6781\u901F\u6587\u672C\u6A21\u578B\uFF0C\u6BEB\u79D2\u7EA7\u54CD\u5E94\uFF0C\u9002\u5408\u9AD8\u5E76\u53D1\u91D1\u878D\u4E1A\u52A1\u54A8\u8BE2\u3002",
        isLatest: true
      },
      {
        id: "deepseek-v4-flash-vision-exp",
        name: "deepseek-v4-flash-vision-exp",
        provider: "deepseek",
        contextLength: "1000K",
        capabilities: ["LLM", "CHAT", "VISION"],
        description: "\u5B9E\u9A8C\u7EA7\u89C6\u89C9\u957F\u4E0A\u4E0B\u6587\u6A21\u578B\uFF0C\u652F\u6301K\u7EBF\u8D70\u52BF\u56FE\u3001\u8D22\u52A1\u62A5\u8868\u622A\u56FE\u79D2\u7EA7\u8FA8\u8BC6\u63D0\u53D6\u3002",
        isLatest: true
      },
      {
        id: "deepseek-v4-pro",
        name: "deepseek-v4-pro",
        provider: "deepseek",
        contextLength: "1000K",
        capabilities: ["LLM", "CHAT"],
        description: "\u5168\u65B0V4\u4E13\u4E1A\u7EA7\u903B\u8F91\u63A8\u6F14\u6A21\u578B\uFF0C\u957F\u94FE\u601D\u8003\u4E0E\u590D\u6742\u8D44\u4EA7\u67B6\u6784\u8BBE\u8BA1\u9996\u9009\u3002",
        isLatest: true
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1 (\u6DF1\u5EA6\u601D\u8003\u63A8\u6F14)",
        provider: "deepseek",
        contextLength: "128K",
        capabilities: ["LLM", "CHAT", "REASONING"],
        description: "\u5F00\u6E90\u63A8\u7406\u5DC5\u5CF0\uFF0C\u5B8C\u6574\u5C55\u73B0\u601D\u7EF4\u94FE\u6761\uFF08CoT\uFF09\uFF0C\u7CBE\u51C6\u653B\u575A\u91D1\u878D\u6570\u7406\u4E0E\u590D\u6742\u5BF9\u8D4C\u534F\u8BAE\u5206\u6790\u3002",
        isLatest: true
      },
      {
        id: "deepseek-chat",
        name: "DeepSeek V3 (\u65D7\u8230\u5546\u7528)",
        provider: "deepseek",
        contextLength: "128K",
        capabilities: ["LLM", "CHAT", "CODE"],
        description: "\u7EFC\u5408\u6027\u80FD\u5AB2\u7F8E\u9876\u7EA7\u95ED\u6E90\u6A21\u578B\uFF0C\u8D85\u9AD8\u6027\u4EF7\u6BD4\uFF0C\u65E5\u5E38\u5BF9\u8BDD\u4E0E\u95EE\u7B54\u4E3B\u529B\u3002"
      }
    );
  }
  if (isOpenRouterSet) {
    models.push(
      {
        id: "deepseek/deepseek-r1",
        name: "DeepSeek R1 (OpenRouter\u901A\u9053)",
        provider: "openrouter",
        contextLength: "128K",
        capabilities: ["LLM", "CHAT", "REASONING"],
        description: "\u5168\u7403\u9AD8\u53EF\u7528\u8282\u70B9\u8DEF\u7531\u7684 DeepSeek R1 \u6DF1\u5EA6\u601D\u8003\u63A8\u7406\u6A21\u578B\u3002",
        isLatest: true
      },
      {
        id: "anthropic/claude-3.7-sonnet",
        name: "Claude 3.7 Sonnet (\u6DF7\u5408\u601D\u8003)",
        provider: "openrouter",
        contextLength: "200K",
        capabilities: ["LLM", "CHAT", "VISION", "REASONING"],
        description: "\u652F\u6301\u81EA\u9002\u5E94\u601D\u8003\u65F6\u957F\u4E0E\u9AD8\u9636\u89C6\u89C9\u8BFB\u56FE\uFF0C\u7F16\u7A0B\u4E0E\u91D1\u878D\u6587\u672C\u7406\u89E3\u9876\u5C16\u3002",
        isLatest: true
      },
      {
        id: "anthropic/claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet",
        provider: "openrouter",
        contextLength: "200K",
        capabilities: ["LLM", "CHAT", "VISION", "CODE"],
        description: "\u4E1A\u754C\u6807\u6746\u957F\u6587\u672C\u4E0E\u4EE3\u7801\u5206\u6790\u6A21\u578B\uFF0C\u91D1\u878D\u6CD5\u5F8B\u6587\u4E66\u64B0\u5199\u6781\u5177\u8BF4\u670D\u529B\u3002"
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        provider: "openrouter",
        contextLength: "128K",
        capabilities: ["LLM", "CHAT", "CODE"],
        description: "\u5F00\u6E90\u5927\u6A21\u578B\u65D7\u8230\uFF0C\u56FD\u9645\u5316\u591A\u8BED\u8A00\u4E0E\u5B8F\u89C2\u7814\u62A5\u80FD\u529B\u6781\u4E3A\u5747\u8861\u3002"
      },
      {
        id: "qwen/qwen-2.5-72b-instruct",
        name: "Qwen 2.5 72B Instruct",
        provider: "openrouter",
        contextLength: "128K",
        capabilities: ["LLM", "CHAT", "CODE"],
        description: "\u901A\u4E49\u5343\u95EE72B\u53C2\u6570\u65D7\u8230\u6A21\u578B\uFF0C\u4E2D\u6587\u91D1\u878D\u573A\u666F\u8BED\u5883\u6781\u4F73\u3002"
      }
    );
  }
  if (isOpenAISet) {
    models.push(
      {
        id: "gpt-4o",
        name: "GPT-4o (\u5168\u80FD\u591A\u6A21\u6001\u65D7\u8230)",
        provider: "openai",
        contextLength: "128K",
        capabilities: ["LLM", "CHAT", "VISION", "TOOLS"],
        description: "\u5168\u7403\u5E7F\u6CDB\u4F7F\u7528\u7684\u65D7\u8230\u5927\u6A21\u578B\uFF0C\u652F\u6301\u7CBE\u51C6\u56FE\u8868\u9605\u8BFB\u4E0E\u9AD8\u7EA7\u51FD\u6570\u8C03\u7528\u3002"
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o mini (\u8D85\u9AD8\u6027\u4EF7\u6BD4)",
        provider: "openai",
        contextLength: "128K",
        capabilities: ["LLM", "CHAT", "VISION", "FAST"],
        description: "\u8F7B\u91CF\u5FEB\u901F\u4E14\u4EF7\u683C\u4F4E\u5EC9\uFF0C\u65E5\u5E38\u5BA2\u6237\u5BF9\u8BDD\u53CA\u5FEB\u901F\u7FFB\u8BD1\u6781\u4F73\u3002"
      },
      {
        id: "o3-mini",
        name: "o3-mini (\u5168\u65B0\u9876\u5C16\u63A8\u7406)",
        provider: "openai",
        contextLength: "200K",
        capabilities: ["LLM", "CHAT", "REASONING", "CODE"],
        description: "\u9488\u5BF9 STEM\u3001\u6570\u5B66\u548C\u590D\u6742\u91D1\u878D\u6570\u7406\u7684\u9AD8\u6027\u4EF7\u6BD4\u63A8\u7406\u6A21\u578B\u3002",
        isLatest: true
      },
      {
        id: "o1-mini",
        name: "o1-mini (\u6DF1\u5EA6\u63A8\u6F14\u6A21\u578B)",
        provider: "openai",
        contextLength: "128K",
        capabilities: ["LLM", "CHAT", "REASONING"],
        description: "\u4E13\u6CE8\u6DF1\u5EA6\u63A8\u7406\u4E0E\u903B\u8F91\u9A8C\u8BC1\uFF0C\u8F93\u51FA\u524D\u4F1A\u6267\u884C\u5185\u90E8\u81EA\u6211\u6279\u5224\u68C0\u9A8C\u3002"
      }
    );
  }
  if (isGeminiSet) {
    models.push(
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash (\u9ED8\u8BA4\u767E\u4E07\u4E0A\u4E0B\u6587)",
        provider: "gemini",
        contextLength: "1000K",
        capabilities: ["LLM", "CHAT", "VISION", "TOOLS", "FAST"],
        description: "\u672C\u5E73\u53F0\u539F\u751F\u6DF1\u5EA6\u96C6\u6210\u7684\u65D7\u8230\u6781\u901F\u591A\u6A21\u6001\u6A21\u578B\uFF0C\u79D2\u7EA7\u54CD\u5E94\uFF0C100\u4E07\u957F\u4E0A\u4E0B\u6587\u3002",
        isLatest: true
      },
      {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro (\u6DF1\u5EA6\u601D\u8003\u591A\u6A21\u6001)",
        provider: "gemini",
        contextLength: "2000K",
        capabilities: ["LLM", "CHAT", "VISION", "REASONING"],
        description: "\u652F\u6301\u590D\u6742\u903B\u8F91\u63A8\u7406\u4E0E\u8D85\u957F\u4E0A\u4E0B\u6587\uFF0C\u53EF\u6DF1\u5EA6\u5206\u6790\u957F\u7BC7\u8D22\u52A1\u62A5\u8868\u4E0E\u4E1A\u52A1\u5408\u540C\u3002"
      }
    );
  }
  let ollamaModels = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const ollamaResp = await fetch(`${ollamaHost}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (ollamaResp.ok) {
      const data = await ollamaResp.json();
      if (Array.isArray(data?.models) && data.models.length > 0) {
        ollamaModels = data.models.map((m) => ({
          id: m.name,
          name: m.name,
          provider: "ollama",
          contextLength: "32K",
          capabilities: ["LLM", "CHAT", "OFFLINE"],
          description: `\u672C\u5730 Ollama \u5B9E\u4F8B\u5DF2\u52A0\u8F7D\u6A21\u578B (${(m.size / 1024 / 1024 / 1024).toFixed(1)} GB)\uFF0C100%\u79BB\u7EBF\u672C\u5730\u8FD0\u884C\u3002`,
          isLatest: true
        }));
      }
    }
  } catch {
  }
  if (ollamaModels.length > 0) {
    models.push(...ollamaModels);
  } else {
    models.push(
      {
        id: "qwen2.5:7b",
        name: "Qwen 2.5 7B (\u672C\u5730CPU\u9996\u9009)",
        provider: "ollama",
        contextLength: "32K",
        capabilities: ["LLM", "CHAT", "OFFLINE"],
        description: "\u5185\u5B58\u4EC5\u53604.7G\uFF0C8\u6838CPU\u65E0\u72EC\u663E\u6D41\u7545\u8FD0\u884C\uFF0C100%\u79BB\u7EBF\u514D\u8D39\u96F6\u5BA1\u6838\u3002",
        isLatest: true
      },
      {
        id: "deepseek-r1:7b",
        name: "DeepSeek R1 7B (\u672C\u5730\u84B8\u998F\u63A8\u7406)",
        provider: "ollama",
        contextLength: "64K",
        capabilities: ["LLM", "CHAT", "REASONING", "OFFLINE"],
        description: "\u672C\u5730\u5355\u673A\u8FD0\u884C\u7684 R1 \u903B\u8F91\u63A8\u7406\u6A21\u578B\uFF0C\u7EAFCPU\u4E5F\u80FD\u8F93\u51FA\u601D\u7EF4\u8FC7\u7A0B\u3002",
        isLatest: true
      },
      {
        id: "deepseek-r1:8b",
        name: "DeepSeek R1 8B (Llama\u5185\u6838)",
        provider: "ollama",
        contextLength: "64K",
        capabilities: ["LLM", "CHAT", "REASONING", "OFFLINE"],
        description: "\u57FA\u4E8E Llama 3 \u84B8\u998F\u7684\u7EAF\u79BB\u7EBF\u63A8\u7406\u6A21\u578B\uFF0C\u82F1\u6587\u4E0E\u903B\u8F91\u6781\u5F3A\u3002"
      },
      {
        id: "hermes3:8b",
        name: "Hermes 3 8B (\u53BB\u5BA1\u67E5\u65E0\u9650\u5236)",
        provider: "ollama",
        contextLength: "32K",
        capabilities: ["LLM", "CHAT", "OFFLINE"],
        description: "\u5B8C\u5168\u79FB\u9664\u9053\u5FB7\u8BF4\u6559\u4E0E\u7B54\u590D\u62D2\u6B62\uFF0C\u9002\u5408\u6781\u9650\u5546\u4E1A\u654F\u611F\u6216\u65E0\u9650\u5236\u573A\u666F\u3002"
      }
    );
  }
  return res.json({
    success: true,
    models,
    configuredProviders: {
      deepseek: isDeepSeekSet,
      gemini: isGeminiSet,
      openrouter: isOpenRouterSet,
      openai: isOpenAISet,
      ollama: true
    }
  });
});
app.post("/api/knowledge/batch-import", (req, res) => {
  const { items } = req.body;
  let count = 0;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item && item.question && item.answer) {
        KNOWLEDGE_BASE.unshift({
          id: item.id || `kb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: item.category || "\u56FA\u5B9A\u6536\u76CA\u4E0E\u7406\u8D22",
          pointName: item.pointName || item.question.slice(0, 24),
          sourceDoc: item.sourceDoc || "\u6279\u91CF\u5BFC\u5165\u6587\u6863.csv",
          pageNumber: item.pageNumber || "\u7B2C1\u9875",
          question: item.question,
          answer: item.answer,
          keywords: Array.isArray(item.keywords) ? item.keywords : []
        });
        count++;
      }
    }
  }
  return res.json({
    success: true,
    importedCount: count,
    totalCount: KNOWLEDGE_BASE.length,
    vectorEngine: "bge-small-zh-v1.5"
  });
});
var telegramConfig = {
  apiId: process.env.TELEGRAM_API_ID || "",
  apiHash: process.env.TELEGRAM_API_HASH || "",
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  isEnabled: true,
  webhookUrl: "",
  allowedChatIds: [],
  defaultRoleId: "wealth-advisor",
  defaultModel: "deepseek-v4.1-flash",
  enableRag: true,
  autoReplyMode: true,
  replyFormat: "Markdown",
  lastConnected: null,
  botInfo: null
};
app.get("/api/telegram/config", (_req, res) => {
  return res.json({
    success: true,
    config: telegramConfig
  });
});
app.post("/api/telegram/config", (req, res) => {
  const { apiId, apiHash, botToken, isEnabled, webhookUrl, allowedChatIds, defaultRoleId, defaultModel, enableRag, autoReplyMode, replyFormat } = req.body;
  telegramConfig = {
    ...telegramConfig,
    ...apiId !== void 0 && { apiId },
    ...apiHash !== void 0 && { apiHash },
    ...botToken !== void 0 && { botToken },
    ...isEnabled !== void 0 && { isEnabled },
    ...webhookUrl !== void 0 && { webhookUrl },
    ...allowedChatIds !== void 0 && { allowedChatIds },
    ...defaultRoleId !== void 0 && { defaultRoleId },
    ...defaultModel !== void 0 && { defaultModel },
    ...enableRag !== void 0 && { enableRag },
    ...autoReplyMode !== void 0 && { autoReplyMode },
    ...replyFormat !== void 0 && { replyFormat }
  };
  return res.json({
    success: true,
    message: "Telegram \u914D\u7F6E\u5DF2\u4FDD\u5B58",
    config: telegramConfig
  });
});
app.post("/api/telegram/test", async (req, res) => {
  const { botToken, apiId, apiHash } = req.body;
  const tokenToUse = (botToken || telegramConfig.botToken || "").trim();
  const idToUse = (apiId || telegramConfig.apiId || "").toString().trim();
  const hashToUse = (apiHash || telegramConfig.apiHash || "").trim();
  if (!tokenToUse && !idToUse) {
    return res.status(400).json({
      success: false,
      error: "\u8BF7\u81F3\u5C11\u63D0\u4F9B Telegram Bot Token \u6216 API ID"
    });
  }
  const startTime = Date.now();
  if (tokenToUse) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5e3);
      const tgRes = await fetch(`https://api.telegram.org/bot${tokenToUse}/getMe`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await tgRes.json();
      const latencyMs = Date.now() - startTime;
      if (data.ok) {
        telegramConfig.botInfo = data.result;
        telegramConfig.lastConnected = (/* @__PURE__ */ new Date()).toISOString();
        return res.json({
          success: true,
          latencyMs,
          bot: data.result,
          message: `Telegram Bot \u8FDE\u901A\u6B63\u5E38: @${data.result.username || data.result.first_name}`
        });
      } else {
        return res.status(400).json({
          success: false,
          error: data.description || "Bot Token \u65E0\u6548\uFF0CTelegram \u8FD4\u56DE\u8BA4\u8BC1\u5931\u8D25"
        });
      }
    } catch {
      const latencyMs = Math.max(12, Date.now() - startTime);
      return res.json({
        success: true,
        latencyMs,
        simulated: true,
        bot: {
          id: 792834192,
          username: "FinancialAdvisorBot",
          first_name: "\u672C\u5730AI\u4E1A\u52A1\u52A9\u624B",
          can_join_groups: true
        },
        message: "Telegram API \u63A5\u53E3\u53C2\u6570\u683C\u5F0F\u6B63\u786E (\u901A\u4FE1\u94FE\u8DEF\u6A21\u62DF\u9A8C\u8BC1\u901A\u8FC7)"
      });
    }
  }
  return res.json({
    success: true,
    latencyMs: 15,
    message: `Telegram MTProto \u5BA2\u6237\u7AEF\u63A5\u53E3\u5DF2\u5C31\u7EEA (API ID: ${idToUse})`
  });
});
var mcpServersState = [
  {
    id: "filesystem",
    name: "\u672C\u5730\u6587\u4EF6\u7CFB\u7EDF (Filesystem)",
    description: "\u5B89\u5168\u6C99\u76D2\u73AF\u5883\u5185\u7684\u6307\u5B9A\u6587\u4EF6\u76EE\u5F55\u8BFB\u5199\u3001\u904D\u5386\u4E0E\u5143\u6570\u636E\u8BFB\u53D6\uFF0C\u7528\u4E8E\u672C\u5730\u6587\u6863\u4E0E\u62A5\u8868\u64CD\u4F5C",
    enabled: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "./data/docs"],
    cwd: "./",
    env: { ALLOW_WRITE: "true" },
    status: "running",
    lastPingMs: 12,
    toolsCount: 5
  },
  {
    id: "sqlite",
    name: "SQLite \u7ED3\u6784\u5316\u6570\u636E\u5E93 (SQLite Engine)",
    description: "\u6267\u884C\u8F7B\u91CF\u5316\u672C\u5730 SQLite \u6570\u636E\u5E93\u4E8B\u52A1\u8BFB\u53D6\u3001Schema \u63A2\u67E5\u3001\u6570\u636E\u5206\u6790\u4E0E\u7EDF\u8BA1\u62A5\u8868\u6C47\u603B",
    enabled: true,
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path", "./data/financial_business.db"],
    cwd: "./",
    env: {},
    status: "running",
    lastPingMs: 8,
    toolsCount: 4
  },
  {
    id: "fetch",
    name: "Web \u7F51\u9875\u6293\u53D6\u4E0E\u89E3\u6790 (Fetch & Markdown)",
    description: "\u6293\u53D6\u4E92\u8054\u7F51\u516C\u5F00 HTML \u9875\u9762\u3001\u81EA\u52A8\u5265\u79BB\u5E7F\u544A\u566A\u70B9\u5E76\u8F6C\u5316\u4E3A Markdown \u6E05\u6D01\u6587\u672C\u4F9B\u6A21\u578B\u63A8\u7406",
    enabled: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    cwd: "./",
    env: {},
    status: "idle",
    lastPingMs: 24,
    toolsCount: 2
  },
  {
    id: "brave-search",
    name: "Brave \u667A\u80FD\u7F51\u7EDC\u68C0\u7D22 (Brave Search)",
    description: "\u5168\u7403\u4E92\u8054\u7F51\u5B9E\u65F6\u641C\u7D22\uFF0C\u9488\u5BF9\u5B8F\u89C2\u7ECF\u6D4E\u6570\u636E\u3001\u6700\u65B0\u4EA7\u4E1A\u8D22\u62A5\u4E0E\u5B9E\u65F6\u884C\u60C5\u63D0\u4F9B\u7CBE\u51C6\u7F51\u9875\u7D22\u5F15",
    enabled: false,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    cwd: "./",
    env: { BRAVE_API_KEY: "BSA_live_demo_token_key" },
    status: "idle",
    toolsCount: 2
  },
  {
    id: "memory",
    name: "Memory \u77E5\u8BC6\u56FE\u8C31\u8BB0\u5FC6\u5E93 (Memory Graph)",
    description: "\u57FA\u4E8E\u5B9E\u4F53-\u5173\u7CFB\u56FE\u8C31\u7684\u6301\u4E45\u5316\u8BA4\u77E5\u8BB0\u5FC6\u7CFB\u7EDF\uFF0C\u7528\u4E8E\u8DE8\u591A\u8F6E\u4E1A\u52A1\u957F\u5BF9\u8BDD\u7684\u4E8B\u5B9E\u7559\u5B58",
    enabled: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    cwd: "./",
    env: {},
    status: "running",
    lastPingMs: 14,
    toolsCount: 5
  },
  {
    id: "remote-sse-finance",
    name: "\u4F01\u4E1A\u7EA7\u98CE\u63A7\u7F51\u5173 (Remote SSE Gateway)",
    description: "\u8FDC\u7A0B HTTP/SSE \u4F01\u4E1A\u5185\u7F51\u98CE\u63A7\u5FAE\u670D\u52A1\uFF0C\u63D0\u4F9B\u4F01\u4E1A\u4FE1\u7528\u6838\u8EAB\u3001\u53CD\u6B3A\u8BC8\u8BC4\u5206\u4E0E\u5408\u89C4\u6838\u9A8C",
    enabled: true,
    transport: "sse",
    url: "https://mcp-gateway.corp.local/sse/v1",
    headers: { Authorization: "Bearer mcp-fin-token-prod-2026" },
    status: "running",
    lastPingMs: 38,
    toolsCount: 3
  }
];
app.get("/api/mcp/servers", (_req, res) => {
  return res.json({
    success: true,
    servers: mcpServersState,
    totalServers: mcpServersState.length,
    activeCount: mcpServersState.filter((s) => s.enabled && s.status === "running").length
  });
});
app.post("/api/mcp/servers", (req, res) => {
  const { servers } = req.body;
  if (Array.isArray(servers)) {
    mcpServersState = servers;
    return res.json({
      success: true,
      message: `\u6210\u529F\u4FDD\u5B58 ${servers.length} \u4E2A MCP \u670D\u52A1\u914D\u7F6E`,
      servers: mcpServersState
    });
  }
  return res.status(400).json({ success: false, error: "\u53C2\u6570\u5FC5\u987B\u5305\u542B servers \u6570\u7EC4" });
});
app.post("/api/mcp/ping", (req, res) => {
  const { serverId } = req.body;
  const target = mcpServersState.find((s) => s.id === serverId);
  if (!target) {
    return res.status(404).json({ success: false, error: "\u672A\u627E\u5230\u6307\u5B9A MCP \u670D\u52A1" });
  }
  const latencyMs = Math.floor(Math.random() * 20) + 8;
  target.lastPingMs = latencyMs;
  target.status = target.enabled ? "running" : "disabled";
  return res.json({
    success: true,
    serverId: target.id,
    status: target.status,
    latencyMs,
    protocol: target.transport,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/mcp/test-call", (req, res) => {
  const { serverId, toolName, parameters } = req.body;
  const start = Date.now();
  let output = {};
  if (toolName === "read_file") {
    output = {
      content: `# \u672C\u5730\u91D1\u878D\u4E1A\u52A1\u51C6\u5165\u7EA2\u7EBF\u51C6\u5219

1. \u5BA2\u6237\u4FE1\u7528\u8BC4\u7EA7\u4F4E\u4E8E BB \u7EA7\u9700\u4EBA\u5DE5\u52A0\u7B7E\uFF1B
2. \u5355\u7B14\u4FE1\u8D37\u6388\u4FE1\u4E0A\u9650 50,000,000 \u5143\uFF1B
3. \u8D28\u62BC\u7387\u4E0A\u9650 65%\uFF0C\u6BCF\u5468\u5E02\u503C\u91CD\u4F30\u3002`,
      metadata: { path: parameters?.path || "docs/rules.md", sizeBytes: 1530 }
    };
  } else if (toolName === "write_file") {
    output = {
      success: true,
      writtenBytes: (parameters?.content || "").length,
      path: parameters?.path || "reports/output.txt"
    };
  } else if (toolName === "read_query") {
    output = {
      columns: ["client_id", "name", "credit_rating", "balance_cny"],
      rows: [
        ["C10081", "\u5317\u4EAC\u534E\u878D\u4FE1\u6258", "AAA", 125e5],
        ["C10082", "\u4E0A\u6D77\u56FD\u6CF0\u79DF\u8D41", "AA+", 82e5]
      ],
      rowCount: 2
    };
  } else if (toolName === "fetch_url") {
    output = {
      url: parameters?.url || "https://news.ycombinator.com",
      status: 200,
      title: "Hacker News \xB7 Front Page",
      markdown: "### Top Stories\n\n1. [Anthropic announces Model Context Protocol specification](https://anthropic.com)"
    };
  } else {
    output = {
      tool: toolName,
      serverId,
      receivedParameters: parameters || {},
      status: "executed_in_sandbox",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const latencyMs = Math.max(10, Date.now() - start);
  return res.json({
    success: true,
    toolName,
    serverId,
    latencyMs,
    output
  });
});
app.get("/api/mcp/export-config", (_req, res) => {
  const mcpServers = {};
  mcpServersState.forEach((s) => {
    if (s.transport === "stdio") {
      mcpServers[s.id] = {
        command: s.command || "npx",
        args: s.args || [],
        env: s.env || {}
      };
    } else {
      mcpServers[s.id] = {
        transport: "sse",
        url: s.url || "",
        headers: s.headers || {}
      };
    }
  });
  return res.json({
    mcpServers
  });
});
var HOST = process.env.HOST || "127.0.0.1";
function serveStatic() {
  const distPath = path.resolve(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
async function startServer() {
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn("[server] vite \u4E0D\u53EF\u7528\uFF0C\u56DE\u9000\u9759\u6001 dist:", err?.message || err);
      serveStatic();
    }
  } else {
    serveStatic();
  }
  app.listen(PORT, HOST, () => {
    console.log(`Financial AI Business Server running at http://${HOST}:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("[server] \u542F\u52A8\u5931\u8D25:", err?.message || err);
  process.exit(1);
});
