package infra

import "github.com/gin-gonic/gin"

// ApiError sends a JSON error response with the given status code, error code, and message.
func ApiError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": message, "code": code})
}
