package registry

// ComputeBadge 根据 status 与 user_accessible 计算 UI 徽章（platform-api v1.1）
func ComputeBadge(status string, userAccessible bool) string {
	if status == "disabled" {
		return "offline"
	}
	if !userAccessible {
		return "closed_to_users"
	}
	return "open"
}
