const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
// In production, this should be a 32-byte string from process.env.ENCRYPTION_KEY
// Fallback is purely for local dev structure purposes (though you should always provide a real one)
const rawKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32); 
const SECRET_KEY = Buffer.isBuffer(rawKey) ? rawKey : Buffer.from(rawKey, 'hex'); 

function encrypt(text) {
    if (!text) return text;
    
    // Generate a 12-byte initialization vector for GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the auth tag (16 bytes)
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return iv:authTag:encrypted payload
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText) {
    if (!encryptedText) return encryptedText;
    
    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) throw new Error('Invalid encrypted text format');
        
        const [ivHex, authTagHex, encryptedHex] = parts;
        
        const decipher = crypto.createDecipheriv(
            ALGORITHM, 
            SECRET_KEY, 
            Buffer.from(ivHex, 'hex')
        );
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error.message);
        throw new Error('Failed to decrypt data');
    }
}

module.exports = {
    encrypt,
    decrypt
};
