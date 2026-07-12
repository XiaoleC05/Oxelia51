# ============================================================
# 1. migrations/015_briefing_range.up.sql
# ============================================================
New-Item -Path "D:\07_Projects\code\SuperRead\migrations" -ItemType Directory -Force | Out-Null
$migrationContent = @'
-- 015_briefing_range: Add briefing_range column to user_settings

ALTER TABLE superread.user_settings ADD COLUMN IF NOT EXISTS briefing_range VARCHAR(8) DEFAULT '24h';
'@
[System.IO.File]::WriteAllText("D:\07_Projects\code\SuperRead\migrations\015_briefing_range.up.sql", $migrationContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "015_briefing_range.up.sql created"

# ============================================================
# 2. model.go — add BriefingRange to UserSettings + UpdateSettingsRequest
# ============================================================
$modelFile = "D:\07_Projects\code\SuperRead\internal\model\model.go"
$modelLines = [System.IO.File]::ReadAllLines($modelFile)
$modelNew = [System.Collections.ArrayList]::new()
for ($i = 0; $i -lt $modelLines.Count; $i++) {
    [void]$modelNew.Add($modelLines[$i])
    # Add BriefingRange after Email in UserSettings
    if ($modelLines[$i] -match 'Email\s+string.*json:"email"') {
        [void]$modelNew.Add('	BriefingRange   string    `json:"briefing_range"`')
    }
    # Add BriefingRange after Email in UpdateSettingsRequest
    if ($modelLines[$i] -match 'Email\s+\*string.*json:"email') {
        [void]$modelNew.Add('	BriefingRange   *string `json:"briefing_range,omitempty"`')
    }
}
[System.IO.File]::WriteAllLines($modelFile, $modelNew)
Write-Host "model.go: BriefingRange added"

# ============================================================
# 3. db/settings.go — add briefing_range to SELECT + UPSERT
# ============================================================
$dbSettingsContent = @'
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/XiaoleC05/SuperRead/internal/model"
	"github.com/jackc/pgx/v5"
)

func GetSettings(ctx context.Context, userID int64) (*model.UserSettings, error) {
	query := `
		SELECT user_id, api_key, api_base, model, fetch_interval_min, email, briefing_range, updated_at
		FROM superread.user_settings
		WHERE user_id = $1
	`
	var s model.UserSettings
	err := Pool.QueryRow(ctx, query, userID).Scan(
		&s.UserID, &s.APIKey, &s.APIBase, &s.Model,
		&s.FetchIntervalMin, &s.Email, &s.BriefingRange, &s.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	return &s, nil
}

func UpdateSettings(ctx context.Context, userID int64, req model.UpdateSettingsRequest) (*model.UserSettings, error) {
	current, err := GetSettings(ctx, userID)
	if err != nil {
		return nil, err
	}

	if current == nil {
		current = &model.UserSettings{
			UserID:          userID,
			APIKey:          "",
			APIBase:         "",
			Model:           "gpt-4o-mini",
			FetchIntervalMin: 30,
			Email:           "",
			BriefingRange:   "24h",
		}
	}

	if req.APIKey != nil {
		current.APIKey = *req.APIKey
	}
	if req.APIBase != nil {
		current.APIBase = *req.APIBase
	}
	if req.Model != nil {
		current.Model = *req.Model
	}
	if req.FetchIntervalMin != nil {
		current.FetchIntervalMin = *req.FetchIntervalMin
	}
	if req.Email != nil {
		current.Email = *req.Email
	}
	if req.BriefingRange != nil {
		current.BriefingRange = *req.BriefingRange
	}

	query := `
		INSERT INTO superread.user_settings (user_id, api_key, api_base, model, fetch_interval_min, email, briefing_range)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id) DO UPDATE SET
			api_key = EXCLUDED.api_key,
			api_base = EXCLUDED.api_base,
			model = EXCLUDED.model,
			fetch_interval_min = EXCLUDED.fetch_interval_min,
			email = EXCLUDED.email,
			briefing_range = EXCLUDED.briefing_range,
			updated_at = NOW()
	`
	_, err = Pool.Exec(ctx, query,
		current.UserID, current.APIKey, current.APIBase,
		current.Model, current.FetchIntervalMin, current.Email, current.BriefingRange,
	)
	if err != nil {
		return nil, fmt.Errorf("update settings: %w", err)
	}

	current.UpdatedAt = time.Now()
	return current, nil
}
'@
[System.IO.File]::WriteAllText("D:\07_Projects\code\SuperRead\internal\db\settings.go", $dbSettingsContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "db/settings.go: briefing_range added"

# ============================================================
# 4. handler/settings.go — add BriefingRange to DTO
# ============================================================
$handlerSettingsLines = [System.IO.File]::ReadAllLines("D:\07_Projects\code\SuperRead\internal\handler\settings.go")
$hsNew = [System.Collections.ArrayList]::new()
for ($i = 0; $i -lt $handlerSettingsLines.Count; $i++) {
    [void]$hsNew.Add($handlerSettingsLines[$i])
    # Add BriefingRange after Email in settingsDTO
    if ($handlerSettingsLines[$i] -match 'Email\s+string.*json:"email"') {
        [void]$hsNew.Add('	BriefingRange   string `json:"briefing_range"`')
    }
    # Add BriefingRange after Email in toSettingsDTO
    if ($handlerSettingsLines[$i] -match 'Email:\s*s\.Email,') {
        [void]$hsNew.Add('		BriefingRange:   s.BriefingRange,')
    }
    # Add BriefingRange to default settings
    if ($handlerSettingsLines[$i] -match 'Email:\s*""') {
        [void]$hsNew.Add('			BriefingRange:   "24h",')
    }
}
[System.IO.File]::WriteAllLines("D:\07_Projects\code\SuperRead\internal\handler\settings.go", $hsNew)
Write-Host "handler/settings.go: BriefingRange in DTO"

# ============================================================
# 5. handler/brief.go — rewrite GenerateDailyBrief + add parseRange
# ============================================================
$briefLines = [System.IO.File]::ReadAllLines("D:\07_Projects\code\SuperRead\internal\handler\brief.go")
$briefNew = [System.Collections.ArrayList]::new()

# Add "log" and "summarizer" imports
$logAdded = $false
$summarizerAdded = $false
$inGenerateFunc = $false
$generateDone = $false

for ($i = 0; $i -lt $briefLines.Count; $i++) {
    $line = $briefLines[$i]

    # Add "log" import after "io"
    if (-not $logAdded -and $line -match '"io"') {
        [void]$briefNew.Add($line)
        [void]$briefNew.Add('	"log"')
        $logAdded = $true
        continue
    }

    # Add summarizer import after model
    if (-not $summarizerAdded -and $line -match 'internal/model"') {
        [void]$briefNew.Add($line)
        [void]$briefNew.Add('	"github.com/XiaoleC05/SuperRead/internal/summarizer"')
        $summarizerAdded = $true
        continue
    }

    # Replace GenerateDailyBrief function (lines 100-198 approx)
    if ($line -match '^// GenerateDailyBrief POST') {
        $inGenerateFunc = $true
        # Write new function
        [void]$briefNew.Add('// GenerateDailyBrief POST /api/daily-brief/generate?range=24h')
        [void]$briefNew.Add('func GenerateDailyBrief(c *gin.Context) {')
        [void]$briefNew.Add('	userID, ok := GetUserID(c)')
        [void]$briefNew.Add('	if !ok {')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	settings, err := db.GetSettings(c.Request.Context(), userID)')
        [void]$briefNew.Add('	if err != nil {')
        [void]$briefNew.Add('		respondInternalError(c, err)')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('	if settings == nil || settings.APIKey == "" || settings.APIBase == "" {')
        [void]$briefNew.Add('		c.JSON(http.StatusBadRequest, gin.H{"error": "API key not configured"})')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	// Parse range (default: from settings or 24h)')
        [void]$briefNew.Add('	rangeStr := c.Query("range")')
        [void]$briefNew.Add('	if rangeStr == "" {')
        [void]$briefNew.Add('		rangeStr = settings.BriefingRange')
        [void]$briefNew.Add('		if rangeStr == "" {')
        [void]$briefNew.Add('			rangeStr = "24h"')
        [void]$briefNew.Add('		}')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('	duration, err := parseRange(rangeStr)')
        [void]$briefNew.Add('	if err != nil {')
        [void]$briefNew.Add('		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid range: " + err.Error()})')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	loc, _ := time.LoadLocation("Asia/Shanghai")')
        [void]$briefNew.Add('	now := time.Now().In(loc)')
        [void]$briefNew.Add('	since := now.Add(-duration)')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	// 1. Get unsummarized articles in the time window')
        [void]$briefNew.Add('	unsummarized, err := db.ListUnsummarizedArticles(c.Request.Context(), userID, since)')
        [void]$briefNew.Add('	if err != nil {')
        [void]$briefNew.Add('		respondInternalError(c, err)')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	// 2. Summarize each unsummarized article')
        [void]$briefNew.Add('	s := summarizer.New()')
        [void]$briefNew.Add('	for i := range unsummarized {')
        [void]$briefNew.Add('		summary, err := s.Summarize(c.Request.Context(), settings, &unsummarized[i])')
        [void]$briefNew.Add('		if err != nil {')
        [void]$briefNew.Add('			log.Printf("GenerateDailyBrief: summarize article %d failed: %v", unsummarized[i].ID, err)')
        [void]$briefNew.Add('			continue')
        [void]$briefNew.Add('		}')
        [void]$briefNew.Add('		if summary != "" {')
        [void]$briefNew.Add('			db.UpdateArticleSummary(c.Request.Context(), unsummarized[i].ID, summary)')
        [void]$briefNew.Add('			unsummarized[i].Summary = summary')
        [void]$briefNew.Add('		}')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	// 3. Get all summarized articles in the time window')
        [void]$briefNew.Add('	articles, err := db.ListSummarizedArticles(c.Request.Context(), userID, since, now)')
        [void]$briefNew.Add('	if err != nil {')
        [void]$briefNew.Add('		respondInternalError(c, err)')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	if len(articles) == 0 {')
        [void]$briefNew.Add('		c.JSON(http.StatusOK, gin.H{')
        [void]$briefNew.Add('			"date":    now.Format("2006-01-02"),')
        [void]$briefNew.Add('			"content": "",')
        [void]$briefNew.Add('			"total":   0,')
        [void]$briefNew.Add('		})')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	// 4. Build consolidation prompt')
        [void]$briefNew.Add('	var sb strings.Builder')
        [void]$briefNew.Add('	for _, a := range articles {')
        [void]$briefNew.Add('		sb.WriteString(fmt.Sprintf("- [%s] %s\n", a.Title, a.Summary))')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	prompt := fmt.Sprintf(')
        [void]$briefNew.Add('		"Consolidate the following article summaries into a coherent daily brief. Group by theme, remove duplicates, write in fluent Chinese. One sentence per article. Output plain text only, no more than 800 characters.\n\nArticles:\n%s",')
        [void]$briefNew.Add('		sb.String(),')
        [void]$briefNew.Add('	)')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	content, err := callLLM(c.Request.Context(), settings, prompt)')
        [void]$briefNew.Add('	if err != nil {')
        [void]$briefNew.Add('		c.JSON(http.StatusInternalServerError, gin.H{"error": "LLM call failed: " + err.Error()})')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	// 5. Store in daily_briefs')
        [void]$briefNew.Add('	articleIDs := make([]int64, 0, len(articles))')
        [void]$briefNew.Add('	for _, a := range articles {')
        [void]$briefNew.Add('		articleIDs = append(articleIDs, a.ID)')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	dateStr := now.Format("2006-01-02")')
        [void]$briefNew.Add('	_, err = db.Pool.Exec(c.Request.Context(),')
        [void]$briefNew.Add('		`INSERT INTO superread.daily_briefs (user_id, date, content, article_ids)')
        [void]$briefNew.Add('		 VALUES ($1, $2, $3, $4)')
        [void]$briefNew.Add('		 ON CONFLICT (user_id, date) DO UPDATE SET')
        [void]$briefNew.Add('			content = EXCLUDED.content,')
        [void]$briefNew.Add('			article_ids = EXCLUDED.article_ids,')
        [void]$briefNew.Add('			created_at = NOW()`,')
        [void]$briefNew.Add('		userID, dateStr, content, articleIDs,')
        [void]$briefNew.Add('	)')
        [void]$briefNew.Add('	if err != nil {')
        [void]$briefNew.Add('		respondInternalError(c, err)')
        [void]$briefNew.Add('		return')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	// 6. Build response')
        [void]$briefNew.Add('	brief := make([]BriefArticle, 0, len(articles))')
        [void]$briefNew.Add('	for _, a := range articles {')
        [void]$briefNew.Add('		published := ""')
        [void]$briefNew.Add('		if a.PublishedAt != nil {')
        [void]$briefNew.Add('			published = a.PublishedAt.Format("2006-01-02 15:04")')
        [void]$briefNew.Add('		}')
        [void]$briefNew.Add('		brief = append(brief, BriefArticle{')
        [void]$briefNew.Add('			ID:        a.ID,')
        [void]$briefNew.Add('			FeedID:    a.FeedID,')
        [void]$briefNew.Add('			FeedTitle: a.FeedTitle,')
        [void]$briefNew.Add('			Title:     a.Title,')
        [void]$briefNew.Add('			URL:       a.URL,')
        [void]$briefNew.Add('			Author:    a.Author,')
        [void]$briefNew.Add('			Summary:   a.Summary,')
        [void]$briefNew.Add('			Published: published,')
        [void]$briefNew.Add('		})')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('	c.JSON(http.StatusOK, gin.H{')
        [void]$briefNew.Add('		"date":     dateStr,')
        [void]$briefNew.Add('		"content":  content,')
        [void]$briefNew.Add('		"articles": brief,')
        [void]$briefNew.Add('		"total":    len(brief),')
        [void]$briefNew.Add('	})')
        [void]$briefNew.Add('}')
        [void]$briefNew.Add('')
        [void]$briefNew.Add('func parseRange(s string) (time.Duration, error) {')
        [void]$briefNew.Add('	s = strings.TrimSpace(s)')
        [void]$briefNew.Add('	if len(s) < 2 {')
        [void]$briefNew.Add('		return 0, fmt.Errorf("invalid range format")')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('	unit := s[len(s)-1]')
        [void]$briefNew.Add('	numStr := s[:len(s)-1]')
        [void]$briefNew.Add('	num, err := strconv.Atoi(numStr)')
        [void]$briefNew.Add('	if err != nil {')
        [void]$briefNew.Add('		return 0, fmt.Errorf("invalid number: %s", numStr)')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('	switch unit {')
        [void]$briefNew.Add('	case ''h'':')
        [void]$briefNew.Add('		return time.Duration(num) * time.Hour, nil')
        [void]$briefNew.Add('	case ''d'':')
        [void]$briefNew.Add('		return time.Duration(num) * 24 * time.Hour, nil')
        [void]$briefNew.Add('	default:')
        [void]$briefNew.Add('		return 0, fmt.Errorf("invalid unit: %c (use h or d)", unit)')
        [void]$briefNew.Add('	}')
        [void]$briefNew.Add('}')

        # Skip old GenerateDailyBrief function lines until we reach the next function
        $i++  # move past current line
        while ($i -lt $briefLines.Count) {
            if ($briefLines[$i] -match '^func fetchBriefArticles') {
                $inGenerateFunc = $false
                $generateDone = $true
                [void]$briefNew.Add($briefLines[$i])
                break
            }
            $i++
        }
        continue
    }

    [void]$briefNew.Add($line)
}

[System.IO.File]::WriteAllLines("D:\07_Projects\code\SuperRead\internal\handler\brief.go", $briefNew)
Write-Host "brief.go: GenerateDailyBrief rewritten + parseRange added"
Write-Host "`nAll changes done"
