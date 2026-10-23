# -*- coding: utf-8 -*-
"""Parse prompts-chat.json: keyword stats + per-role filtered prompt sets."""
import json, re, io, os, sys

SRC = "D:/AI工具/AI工作台_extracted/AI工作台/dist/prompts-chat.json"
OUT = "D:/AI工具/AI工作台/_kb_work"

os.makedirs(OUT, exist_ok=True)

with io.open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

# ---------- STEP 1: keyword stats ----------
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
    "screenplay", "story", "narrative", "persona", "act",
    "legal advice", "contract", "compliancelower()
        if kw.lower() in blob:
            n += 1
    stats[kw] = n

lines = ["# 关键词出现次数统计（标题+提示词，合计 %d 条）" % len(data), ""]
lines.append("| 关键词 | 次数 |")
lines.append("|---|---:|")
for kw in KEYWORDS:
    lines.append("| %s | %d |" % (kw, stats[kw]))
with io.open(os.path.join(OUT, "01_keyword_stats.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))


# ---------- STEP 2: per-role filtering ----------
def matches(item, groups):
    blob = (item.get("a", "") + " " + item.get("p", "")).lower()
    for g in groups:
        if any(k in blob for k in g):
            return True
    return False


def score(item, groups, bonus_title=0.0):
    """Higher = better match. Title hits weigh more."""
    a = item.get("a", "").lower()
    p = item.get("p", "").lower()
    s = 0.0
    for g in groups:
        for k in g:
            if k in a:
                s += 3 + bonus_title
            if k in p:
                s += 1
    # prefer substantive prompts
    s += min(len(p) / 1200.0, 1.5)
    return s


ROLES = {
    "01_极速对话助手": {
        "groups": [
            ["concise", "brief", "short answer", "quick answer", "one sentence"],
            ["fast", "quick", "rapid", "instant", "immediately"],
            ["simple", "plain english", "concise", "terse", "elaborate", "short"],
            ["answer directly", "no preamble", "tl;dr", "summary"],
        ],
        "exclude": ["story", "novel", "screenplay", "poem"],
    },
    "02_业务全能助手": {
        "groups": [
            ["business", "market"],
            ["sales", "customer", "client", "lead", "negotiat", "pitch", "outreach"],
            ["cold call", "follow up", "email", "proposal", "b2b", "b2c", "crm", "funnel"],
            ["upsell", "cross-sell", "objection", "conversion", "retention", "churn"],
        ],
        "exclude": [],
    },
    "03_全球翻译互译": {
        "groups": [
            ["translat", "interpret"],
            ["language", "bilingual", "multilingual", "fluent", "native speaker", "idiom"],
            ["proofread", "localiz", "proof reading", "editor"],
        ],
        "exclude": [],
    },
    "04_全能制图": {
        "groups": [
            ["image", "draw", "art", "painting", "midjourney"],
            ["photo", "logo", "icon", "illustration", "render", "visual", "graphic"],
            ["design", "poster", "banner", "thumbnail", "sketch", "concept art"],
            ["background", "wallpaper", "portrait", "landscape", "character art"],
        ],
        "exclude": [],
    },
    "05_声音克隆": {
        "groups": [
            ["voice", "audio", "clone", "sound"],
            ["tts", "text to speech", "speech", "narrat", "voiceover", "voice over", "dubbing"],
            ["podcast", "audiobook", "vocal", "singing", "music", "sound effect", "sfx"],
        ],
        "exclude": [],
    },
    "06_素材获取": {
        "groups": [
            ["search", "research", "find", "discover", "collect"],
            ["source", "asset", "material", "resource", "library", "stock", "footage", "dataset"],
            ["scrape", "crawl", "list of", "curated", "collection of", "directories", "links"],
            ["free", "public domain", "royalty", "license"],
        ],
        "exclude": [],
    },
    "07_全球股票分析大师": {
        "groups": [
            ["stock", "finance", "investment", "trading", "market"],
            ["fundamental", "technical analysis", "valuation", "dividend", "portfolio"],
            ["ticker", "nasdaq", "nyse", "etf", "earnings", "balance sheet", "dcf", "roe"],
        ],
        "exclude": [],
    },
    "08_法律顾问": {
        "groups": [
            ["legal", "lawyer", "court"],
            ["contract", "compliance", "regulation", "liability", "jurisdiction", "statute"],
            ["dispute", "litigation", "settlement", "plaintiff", "defendant", "due diligence"],
            ["intellectual property", "privacy", "gdpr", "employment law", "tax law"],
        ],
        "exclude": [],
    },
    "09_情感大师": {
        "groups": [
            ["relationship", "emotion", "dating", "love"],
            ["communication", "conversation", "conversation starter", "flirt", "tinder", "red flag"],
            ["conflict", "argument", "breakup", "ex", "self-esteem", "boundaries", "trust"],
            ["empathy", "listening", "understanding", "reply", "message"],
        ],
        "exclude": [],
    },
    "10_健康专家": {
        "groups": [
            ["health", "medical", "doctor"],
            ["nutrition", "diet", "exercise", "fitness", "symptom", "nutritionist", "wellness"],
            ["sleep", "mental health", "anxiety", "depression", "medication", "chronic", "preventive"],
            ["physician", "clinic", "patient", "diagnosis", "treatment", "supplement"],
        ],
        "exclude": [],
    },
    "11_算命大师": {
        "groups": [
            ["astrology", "fortune", "tarot"],
            ["zodiac", "horoscope", "bazi", "zodiac sign", "chart", "palmistry", "numerology"],
            ["feng shui", "bagua", "iching", "i ching", "divination", "mystic", "tarot reading"],
        ],
        "exclude": [],
    },
    "12_生图提示词优化": {
        "groups": [
            ["prompt", "midjourney", "stable diffusion", "dall-e", "dalle"],
            ["negative prompt", "prompt engineering", "keyword", "weight", "parameters"],
            ["style", "aesthetic", "cinematic", "hyperrealistic", "artstation", "render"],
            ["detailed", "intricate", "8k", "highly detailed", "masterpiece", "quality"],
        ],
        "exclude": [],
    },
    "13_角色扮演": {
        "groups": [
            ["roleplay", "character", "act as", "role play", "imagine you are"],
            ["story", "screenplay", "narrative", "plot", "storytelling", "fiction", "novel"],
            ["persona", "immerse", "in character", "dialogue", "scene", "worldbuilding"],
            ["simulate", "pretend", "stay in character", "continue the story", "writer"],
        ],
        "exclude": [],
    },
}

result = {}
for role, cfg in ROLES.items():
    scored = []
    for i, item in enumerate(data):
        blob = (item.get("a", "") + " " + item.get("p", "")).lower()
        if cfg.get("exclude") and matches(item, [cfg["exclude"]]):
            # only exclude when it has no positive group match
            if not matches(item, cfg["groups"]):
                continue
        s = score(item, cfg["groups"])
        if s > 3.0:
            scored.append((s, i, item))
    scored.sort(key=lambda x: (-x[0], x[1]))
    top = scored[:40]
    result[role] = [
        {"rank": r + 1, "score": round(sc, 2), "title": it.get("a", ""), "prompt": it.get("p", "")}
        for r, (sc, i, it) in enumerate(top)
    ]
    with io.open(os.path.join(OUT, role + "_candidates.json"), "w", encoding="utf-8") as f:
        f.write(json.dumps(result[role], ensure_ascii=False, indent=2))

summary = []
for role, items in result.items():
    summary.append("%s: 候选 %d 条 | top1=%s (%.2f)" % (role, len(items), items[0]["title"][:40] if items else "-", items[0]["score"] if items else 0))
with io.open(os.path.join(OUT, "00_summary.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(summary))

print("DONE")
