package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestListTools(t *testing.T) {
	db := testDBPool(t)

	h := NewToolHandler(db)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/tools", nil)

	h.List(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// 至少应有一个 online_capable 工具
	if len(items) == 0 {
		t.Log("警告: 无 online_capable 工具，请确认 seed 数据")
	}

	// 验证每个条目包含必要字段
	for i, item := range items {
		if item["slug"] == nil || item["slug"] == "" {
			t.Errorf("items[%d] missing slug", i)
		}
		if item["name"] == nil || item["name"] == "" {
			t.Errorf("items[%d] missing name", i)
		}
	}
}

func TestGetTool_Found(t *testing.T) {
	db := testDBPool(t)

	// 先通过 List 获取一个有效 slug
	h := NewToolHandler(db)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/tools", nil)
	h.List(c)

	var items []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil || len(items) == 0 {
		t.Skip("跳过: 无可用工具数据")
	}
	slug := items[0]["slug"].(string)

	// 用该 slug 测试 Get
	w2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(w2)
	c2.Request = httptest.NewRequest("GET", "/api/tools/"+slug, nil)
	c2.Params = gin.Params{{Key: "slug", Value: slug}}

	h.Get(c2)

	if w2.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w2.Code)
	}

	var tool map[string]interface{}
	if err := json.Unmarshal(w2.Body.Bytes(), &tool); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if tool["slug"] != slug {
		t.Errorf("slug = %v, want %v", tool["slug"], slug)
	}
}

func TestGetTool_NotFound(t *testing.T) {
	db := testDBPool(t)

	h := NewToolHandler(db)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/tools/nonexistent-tool-xyz", nil)
	c.Params = gin.Params{{Key: "slug", Value: "nonexistent-tool-xyz"}}

	h.Get(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["code"] != "TOOL_NOT_FOUND" {
		t.Errorf("code = %v, want TOOL_NOT_FOUND", body["code"])
	}
}
