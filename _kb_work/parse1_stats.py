import json, io, os

SRC = "D:/AI工具/AI工作台_extracted/AI工作台/dist/prompts-chat.json"
OUT = "D:/AI工具/AI工作台/_kb_work"
os.makedirs(OUT, exist_ok=True)

with io.open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

KEYWORDS = [
    "business", "market",
    "finance", "stock", "investment", "trading",
    "translate", "translation",
    "legal", "lawyer", "court",
    "health", "medical", "doctor",
    "fortune", "astrology", "tarot",
    "roleplay", "character",
    "image", "draw", "art", "painting", "midjourney", "prompt",
    "voice", "audio", "clone", "sound",
    "relationship", "emotion", "dating", "love",
    "search", "research", "find", "asset", "material", "source",
    "concise", "brief", "quick", "short", "fast", "simple",
    "story", "narrative", "persona", "act as",
    "contract", "compliance", "nutrition", "diet", "fitness",
    "zodiac", "horoscope", "feng shui", "divination", "mystic",
    "logo", "poster", "banner", "illustration", "render", "design",
    "tts", "speech", "narrat", "podcast", "music", "vocal",
    "stock image", "royalty", "license", "public domain", "footage",
    "valuation", "fundamental", "technical", "portfolio", "dividend",
    "empathy", "listening", "boundary", "communication", "reply",
    "symptom", "treatment", "diagnosis", "nutritionist", "wellness",
    "negative prompt", "prompt engineering", "aesthetic", "cinematic",
    "screenplay", "plot", "dialogue", "immerse", "worldbuilding",
    "b2b", "b2c", "crm", "funnel", "negotiat", "objection", "conversion",
    "lead", "prospect", "follow up", "cold call", "pitch",
    "email", "proposal", "upsell", "retention", "churn",
    "translation", "bilingual", "multilingual", "fluent", "proofread",
    "clone", "dubbing", "voiceover", "sound effect",
    "link", "directory", "curated", "collect", "discover", "scrape",
    "jurisdiction", "liability", "regulation", "litigation", "dispute",
    "ticker", "nasdaq", "etf", "earnings", "roe", "dcf",
    "dating", "flirt", "tinder", "red flag", "breakup", "self-esteem",
    "sleep", "anxiety", "depression", "medication", "chronic",
    "chinese", "english", "japanese", "korean", "spanish", "french",
    "german", "russian", "arabic", "portuguese",
]

stats = {}
for kw in KEYWORDS:
    n = sum(1 for item in data if kw.lower() in (item.get("a", "") + " " + item.get("p", "")).lower())
    stats[kw] = n

lines = ["# 提示词库关键词出现次数统计", "",
         "数据源：`D:/AI工具/AI工作台_extracted/AI工作台/dist/prompts-chat.json`",
         "总条数：%d" % len(data), "",
         "统计口径：关键词出现在标题(a)或提示词正文(p)中即计 1 次，按条目去重。", "",
         "| 关键词 | 出现条目数 |", "|---|---:|"]
for kw in KEYWORDS:
    lines.append("| %s | %d |" % (kw, stats[kw]))

with io.open(os.path.join(OUT, "01_keyword_stats.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

with io.open(os.path.join(OUT, "01_keyword_stats.json"), "w", encoding="utf-8") as f:
    f.write(json.dumps(stats, ensure_ascii=False, indent=2))

print("KEYWORD_STATS_DONE", len(data))
