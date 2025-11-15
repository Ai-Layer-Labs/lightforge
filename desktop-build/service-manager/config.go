package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// ensureValidEnv checks .env file and generates KEK if needed
func ensureValidEnv() error {
	envPath := filepath.Join(basePath, ".env")
	
	// Read .env file
	data, err := os.ReadFile(envPath)
	if err != nil {
		log.Printf("⚠️  Could not read .env: %v", err)
		return nil // Non-fatal
	}
	
	content := string(data)
	
	// Check if KEK needs to be generated
	if strings.Contains(content, "LOCAL_KEK_BASE64=your-base64-encoded-key-here") ||
	   strings.Contains(content, "LOCAL_KEK_BASE64=your-") {
		log.Println("Generating encryption key for secrets...")
		
		// Generate 32 random bytes
		key := make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			return fmt.Errorf("failed to generate key: %w", err)
		}
		
		// Encode to base64
		keyBase64 := base64.StdEncoding.EncodeToString(key)
		
		// Replace placeholder in content
		content = strings.ReplaceAll(content, 
			"LOCAL_KEK_BASE64=your-base64-encoded-key-here",
			"LOCAL_KEK_BASE64="+keyBase64)
		content = strings.ReplaceAll(content,
			"LOCAL_KEK_BASE64=your-",
			"LOCAL_KEK_BASE64="+keyBase64)
		
		// Write updated .env
		if err := os.WriteFile(envPath, []byte(content), 0644); err != nil {
			return fmt.Errorf("failed to write .env: %w", err)
		}
		
		log.Println("✓ Encryption key generated and saved to .env")
		log.Printf("   Key: %s... (saved to .env)", keyBase64[:20])
	}
	
	return nil
}






