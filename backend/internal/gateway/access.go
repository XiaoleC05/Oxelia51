package gateway

import "fmt"

// AccessError 网关鉴权/工具状态错误
type AccessError struct {
	Status int
	Code   string
	Msg    string
}

func (e *AccessError) Error() string {
	return fmt.Sprintf("%s (%s)", e.Msg, e.Code)
}

func newAccessErr(status int, code, msg string) *AccessError {
	return &AccessError{Status: status, Code: code, Msg: msg}
}

// CheckAccess 按 gateway-contract v1.1 校验调用权限
func CheckAccess(role string, userAccessible, onlineCapable bool, status string) error {
	if !onlineCapable {
		return newAccessErr(404, "TOOL_NOT_ONLINE", "该工具未接入在线服务")
	}
	if status == "disabled" {
		return newAccessErr(503, "TOOL_OFFLINE", "工具已下线")
	}
	if role == "admin" {
		return nil
	}
	if !userAccessible {
		return newAccessErr(403, "TOOL_NOT_ACCESSIBLE", "该工具暂未对普通用户开放")
	}
	return nil
}
