# PowerShell script to count keywords and extract role-specific prompts
$src = "D:/AI工具/AI工作台_extracted/AI工作台/dist/prompts-chat.json"
$out = "D:/AI工具/AI工作台/_kb_work"

# Read and parse JSON
$data = Get-Content $src -Raw | ConvertFrom-Json

# Define keyword groups per role
$role_groups = @{
    "01_极速对话助手" = @("concise", "brief", "short", "quick", "fast", "rapid", "simple", "plain", "short answer", "one sentence")
    "02_业务全能助手" = @("business", "market", "sales", "customer", "client", "lead", "negotiation", "proposal", "cold call", "follow up", "email", "b2b", "b2c", "crm", "funnel", "upsell", "cross-sell", "objection", "conversion", "retention", "churn")
    "03_全球翻译互译" = @("translat", "interpret", "language", "bilingual", "multilingual", "fluent", "native speaker", "idiom", "proofread", "localiz")
    "04_全能制图" = @("image", "draw", "art", "painting", "midjourney", "photo", "logo", "icon", "illustration", "render", "visual", "graphic", "design", "poster", "banner", "thumbnail", "sketch", "concept art", "background", "wallpaper", "portrait", "landscape", "character art")
    "05_声音克隆" = @("voice", "audio", "clone", "sound", "tts", "text to speech", "speech", "narrat", "voiceover", "voice over", "dubbing", "podcast", "audiobook", "vocal", "singing", "music", "sound effect", "sfx")
    "06_素材获取" = @("search", "research", "find", "discover", "collect", "source", "asset", "material", "resource", "library", "stock", "footage", "dataset", "scrape", "crawl", "list of", "curated", "collection of", "directories", "links", "free", "public domain", "royalty", "license")
    "07_全球股票分析大师" = @("stock", "finance", "investment", "trading", "market", "fundamental", "technical analysis", "valuation", "dividend", "portfolio", "ticker", "nasdaq", "nyse", "etf", "earnings", "balance sheet", "dcf", "roe")
    "08_法律顾问" = @("legal", "lawyer", "court", "contract", "compliance", "regulation", "liability", "jurisdiction", "statute", "dispute", "litigation", "settlement", "plaintiff", "defendant", "due diligence", "intellectual property", "privacy", "gdpr", "employment law", "tax law")
    "09_情感大师" = @("relationship", "emotion", "dating", "love", "communication", "conversation", "conversation starter", "flirt", "tinder", "red flag", "conflict", "argument", "breakup", "ex", "self-esteem", "boundaries", "trust", "empathy", "listening", "understanding", "reply", "message")
    "10_健康专家" = @("health", "medical", "doctor", "nutrition", "diet", "exercise", "fitness", "symptom", "nutritionist", "wellness", "sleep", "mental health", "anxiety", "depression", "medication", "chronic", "preventive", "physician", "clinic", "patient", "diagnosis", "treatment", "supplement")
    "11_算命大师" = @("astrology", "fortune", "tarot", "zodiac", "horoscope", "bazi", "zodiac sign", "chart", "palmistry", "numerology", "feng shui", "bagua", "iching", "i ching", "divination", "mystic")
    "12_生图提示词优化" = @("prompt", "midjourney", "stable diffusion", "dall-e", "dalle", "negative prompt", "prompt engineering", "keyword", "weight", "parameters", "style", "aesthetic", "cinematic", "hyperrealistic", "artstation", "render", "detailed", "intricate", "8k", "highly detailed", "masterpiece", "quality")
    "13_角色扮演" = @("roleplay", "character", "act as", "role play", "imagine you are", "story", "screenplay", "narrative", "plot", "storytelling", "fiction", "novel", "persona", "immerse", "in character", "dialogue", "scene", "worldbuilding", "simulate", "pretend", "stay in character", "continue the story", "writer")
}

# Initialize results
$keyword_stats = @{}
$role_matches = @{}

# Count keyword occurrences
foreach ($item in $data) {
    $text = ($item.a + " " + $item.p).ToLower()
    foreach ($role in $role_groups.Keys) {
        $matched = $false
        foreach ($group in $role_groups[$role]) {
            foreach ($kw in $group) {
                if ($text -like "*$kw*") {
                    $keyword_stats[$kw] = ($keyword_stats[$kw] ?? 0) + 1
                    $matched = $true
                }
            }
        }
        if ($matched) {
            $role_matches[$role] = ($role_matches[$role] ?? 0) + 1
        }
    }
}

# Write keyword stats
$kw_lines = @()
$kw_lines += "## 关键词出现次数统计（标题+提示词）"
$kw_lines += "| 关键词 | 次数 |"
$kw_lines += "|---|---:|"
foreach ($kw in $keyword_stats.Keys | Sort-Object) {
    $kw_lines += "| %s | %d |" -f $kw, $keyword_stats[$kw]
}
$kw_lines | Set-Content -Path "$out/01_keyword_stats.md" -Encoding utf8

# Write role summary
$role_lines = @()
$role_lines += "## 角色匹配提示词数量统计"
$role_lines += "| 角色 | 总匹配数 |"
$role_lines += "|---|---:|"
foreach ($role in $role_matches.Keys | Sort-Object) {
    $role_lines += "| %s | %d |" -f $role, $role_matches[$role]
}
$role_lines | Set-Content -Path "$out/00_role_summary.md" -Encoding utf8

# Write role-specific candidates (simplified)
foreach ($role in $role_groups.Keys) {
    $candidates = @()
    foreach ($item in $data) {
        $text = ($item.a + " " + $item.p).ToLower()
        $match = $false
        foreach ($group in $role_groups[$role]) {
            foreach ($kw in $group) {
                if ($text -like "*$kw*") {
                    $candidates += [PSCustomObject]@{
                        Rank = 0
                        Score = ($text -like "*$kw*") ? 1 : 0
                        Title = $item.a
                        Prompt = $item.p
                    }
                    $match = $true
                    break
                }
            }
            if ($match) { break }
        }
        if ($match) {
            $candidates += [PSCustomObject]@{
                Rank = 0
                Score = 0.5
                Title = $item.a
                Prompt = $item.p
            }
        }
    }
    # Sort by score
    $candidates = $candidates | Sort-Object Score -Descending
    $top = $candidates | Select-Object -First 10
    $top | ConvertTo-Json -Compress | Set-Content -Path "$out/$role.json" -Encoding utf8
}

Write-Host "✅ 统计完成，生成文件在 $out"