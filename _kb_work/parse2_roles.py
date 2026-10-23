import json, io, os, re
from collections import Counter

SRC = "D:/AI工具/AI工作台_extracted/AI工作台/dist/prompts-chat.json"
OUT = "D:/AI工具/AI工作台/_kb_work"
os.makedirs(OUT, exist_ok=True)

with io.open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

# Role keyword groups, as defined earlier
ROLE_GROUPS = {
    "极速对话助手": {
        "groups": [
            ["concise", "brief", "short answer", "quick answer", "one sentence"],
            ["fast", "quick", "rapid", "instant", "immediately"],
            ["simple", "plain english", "concise", "terse", "elaborate", "short"],
            ["answer directly", "no preamble", "tl;dr", "summary"],
        ],
        "exclude": ["story", "novel", "screenplay", "poem", "long-form", "detailed", "extensive", "comprehensive", "analysis"],
    },
    "业务全能助手": {
        "groups": [
            ["business", "market"],
            ["sales", "customer", "client", "lead", "negotiation", "proposal", "cold call", "follow up", "email", "b2b", "b2c", "crm", "funnel"],
            ["upsell", "cross-sell", "objection", "conversion", "retention", "churn"],
        ],
        "exclude": [],
    },
    "全球翻译互译": {
        "groups": [
            ["translat", "interpret", "translation", "language", "bilingual", "multilingual", "fluent", "native speaker", "idiom"],
            ["proofread", "localiz", "proof", "localiz"],
        ],
        "exclude": [],
    },
    "全能制图": {
        "groups": [
            ["image", "draw", "art", "painting", "midjourney"],
            ["photo", "logo", "icon", "illustration", "render", "visual", "graphic"],
            ["design", "poster", "banner", "thumbnail", "sketch", "concept art"],
            ["background", "wallpaper", "portrait", "landscape", "character art"],
        ],
        "exclude": [],
    },
    "声音克隆": {
        "groups": [
            ["voice", "audio", "clone", "sound"],
            ["tts", "text to speech", "speech", "narrat", "voiceover", "voice over", "dubbing"],
            ["podcast", "audiobook", "vocal", "singing", "music", "sound effect", "sfx"],
        ],
        "exclude": [],
    },
    "素材获取": {
        "groups": [
            ["search", "research", "find", "discover", "collect", "source", "asset", "material", "resource", "library", "stock", "footage", "dataset"],
            ["scrape", "crawl", "list of", "curated", "collection", "directories", "links"],
            ["free", "public domain", "royalty", "license"],
        ],
        "exclude": [],
    },
    "全球股票分析大师": {
        "groups": [
            ["stock", "finance", "investment", "trading", "market"],
            ["fundamental", "technical analysis", "valuation", "dividend", "portfolio"],
            ["ticker", "nasdaq", "nyse", "etf", "earnings", "balance sheet", "dcf", "roe"],
        ],
        "exclude": [],
    },
    "法律顾问": {
        "groups": [
            ["legal", "lawyer", "court"],
            ["contract", "compliance", "regulation", "liability", "jurisdiction", "statute"],
            ["dispute", "litigation", "settlement", "plaintiff", "defendant", "due diligence"],
            ["intellectual property", "privacy", "gdpr", "employment law", "tax law"],
        ],
        "exclude": [],
    },
    "情感大师": {
        "groups": [
            ["relationship", "emotion", "dating", "love"],
            ["communication", "conversation", "conversation starter", "flirt", "tinder", "red flag", "boundaries", "trust", "empathy"],
            ["conflict", "argument", "breakup", "ex", "self-esteem", "listening", "understanding"],
        ],
        "exclude": [],
    },
    "健康专家": {
        "groups": [
            ["health", "medical", "doctor"],
            ["nutrition", "diet", "exercise", "fitness", "symptom", "nutritionist", "wellness"],
            ["sleep", "mental health", "anxiety", "depression", "medication", "chronic", "preventive"],
            ["physician", "clinic", "patient", "diagnosis", "treatment", "supplement"],
        ],
        "exclude": [],
    },
    "算命大师": {
        "groups": [
            ["astrology", "fortune", "tarot"],
            ["zodiac", "horoscope", "bazi", "chart", "palmistry", "numerology"],
            ["feng shui", "bagua", "iching", "divination", "mystic", "tarot reading"],
        ],
        "exclude": [],
    },
    "生图提示词优化": {
        "groups": [
            ["prompt", "midjourney", "stable diffusion", "dall-e", "dalle"],
            ["negative prompt", "prompt engineering", "keyword", "weight", "parameters"],
            ["style", "aesthetic", "cinematic", "hyperrealistic", "artstation", "render"],
            ["detailed", "intricate", "8k", "highly detailed", "masterpiece", "quality"],
        ],
        "exclude": [],
    },
    "角色扮演": {
        "groups": [
            ["roleplay", "character", "act as", "role play", "imagine you are", "story", "screenplay", "plot", "storytelling", "fiction", "novel"],
            ["persona", "immerse", "in character", "dialogue", "scene", "worldbuilding"],
            ["simulate", "pretend", "stay in character", "continue the story", "writer"],
        ],
        "exclude": [],
    },
}


def text_blob(item):
    """Return lowercased combined title+prompt text."""
    return (item.get("a", "") or "") + " " + (item.get("p", "") or "")


def score_item(item, groups, exclude):
    """Return a numeric score; higher = better match."""
    blob = text_blob(item).lower()
    # Exclude group: skip if any exclude kw matches
    if exclude:
        for g in [exclude] if isinstance(exclude, list) else [exclude]:
            for k in g:
                if k in blob:
                    return -1000  # mark as excluded

    score = 0
    # Title matches weigh more (2x)
    title = item.get("a", "").lower()
    prompt = item.get("p", "").lower()

    for g in groups:
        for k in g:
            if k in title:
                score += 3  # title hit
            if k in prompt:
                score += 1  # prompt hit

    # Bonus for longer substantive prompts (but cap)
    score += min(len(prompt) / 800.0, 1.0)

    return score


# For each role, score and select 5-10 best prompts
role_selections = {}

for role_name, cfg in ROLE_GROUPS.items():
    groups = cfg["groups"]
    exclude = cfg.get("exclude", [])
    scored = []
    for idx, item in enumerate(data):
        s = score_item(item, groups, exclude)
        if s >= 3:  # only include items with meaningful matches
            blob = text_blob(item).lower()
            # Count how many group keywords match
            match_count = sum(
                1 for g in groups for k in g if k in blob
            )
            scored.append((s, match_count, idx, item))

    # Sort by score desc, then by match count desc, then original order
    scored.sort(key=lambda x: (-x[0], -x[1], x[2]))

    # Take top 8-10
    top = scored[:10]
    selections = []
    for rank, (s, mc, idx, item) in enumerate(top, 1):
        prompt_text = (item.get("p") or "").strip()[:500]  # truncate for KB
        selections.append({
            "rank": rank,
            "score": round(s, 2),
            "title": item.get("a", "Unknown")[:100],
            "prompt": prompt_text,
            "keyword_matches": mc,
        })

    role_selections[role_name] = selections

    # Write per-role candidate file
    out_path = os.path.join(OUT, role_name.replace(" ", "_") + "_selections.json")
    with io.open(out_path, "w", encoding="utf-8") as f:
        json.dump(selections, f, ensure_ascii=False, indent=2)

    # Print summary
    print("%s: 选取 %d 条提示词 (最高分 %.2f)" % (role_name, len(selections), selections[0]["score"] if selections else 0))

# Write consolidated summary
summary_path = os.path.join(OUT, "00_role_selections_summary.md")
lines = ["# 13角色提示词筛选汇总", "",
         "数据源：`D:/AI工具/AI工作台_extracted/AI工作台/dist/prompts-chat.json` (2435条)",
         "", "| 角色 | 选取数 | 最高分 | 关键词匹配数 | 示例标题 |", "|---|---:|---:|---:|---|"]
for role_name, selections in role_selections.items():
    if selections:
        s = selections[0]
        title_short = s["title"][:40] + ("..." if len(s["title"]) > 40 else "")
        lines.append("| %s | %d | %.2f | %d | %s |" % (
            role_name, len(selections), s["score"], s["keyword_matches"], title_short))
    else:
        lines.append("| %s | 0 | N/A | N/A | — |" % role_name)

with io.open(summary_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print("\nRole selection complete, output at:" + OUT)

# Also print keyword counts per role (for verification)
print("\n--- 关键角色统计 ---")
for role_name in ROLE_GROUPS:
    sel = role_selections[role_name]
    kw_total = sum(s["keyword_matches"] for s in sel)
    print("%s: %d 条筛选, 总关键词匹配 %d, 最高分 %.2f" % (
        role_name, len(sel), kw_total, sel[0]["score"] if sel else 0))