package handler

import "github.com/gin-gonic/gin"

func apiError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": message, "code": code})
}
