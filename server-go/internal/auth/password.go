package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"strings"

	"golang.org/x/crypto/scrypt"
)

const (
	scryptN   = 16384
	scryptR   = 8
	scryptP   = 1
	keyLength = 64
)

// HashPassword produces a password hash compatible with Node's scrypt implementation: salt_hex:hash_hex
func HashPassword(password string) (string, error) {
	saltBytes := make([]byte, 16)
	if _, err := rand.Read(saltBytes); err != nil {
		return "", err
	}
	saltHex := hex.EncodeToString(saltBytes)

	// Node passes the hex string directly as salt, so we use []byte(saltHex)
	hash, err := scrypt.Key([]byte(password), []byte(saltHex), scryptN, scryptR, scryptP, keyLength)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s:%s", saltHex, hex.EncodeToString(hash)), nil
}

// VerifyPassword checks if a plain password matches the stored salt_hex:hash_hex
func VerifyPassword(password, stored string) bool {
	if stored == "" {
		return false
	}
	parts := strings.Split(stored, ":")
	if len(parts) != 2 {
		return false
	}
	saltHex, origHashHex := parts[0], parts[1]

	origHash, err := hex.DecodeString(origHashHex)
	if err != nil {
		return false
	}

	testHash, err := scrypt.Key([]byte(password), []byte(saltHex), scryptN, scryptR, scryptP, keyLength)
	if err != nil {
		return false
	}

	return subtle.ConstantTimeCompare(origHash, testHash) == 1
}
