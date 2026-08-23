import crypto from 'crypto';

/**
 * Generate a secure PBKDF2 hash and salt for a password
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  // Generate a random 16-byte salt
  const salt = crypto.randomBytes(16).toString('hex');
  
  // Hash the password with 1000 iterations, 64-byte key length, and SHA-512
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  
  return { hash, salt };
}

/**
 * Verify a password against a stored PBKDF2 hash and salt
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return checkHash === hash;
}
