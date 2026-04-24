/**
 * Shared validation utilities for ISP Billing Platform
 */

/**
 * Validates Kenyan phone numbers (Safaricom, Airtel, Telkom)
 * Supports formats: 07..., 01..., 254..., +254...
 */
export const validatePhone = (num: string): boolean => {
    if (!num) return false;
    const clean = num.replace(/\s+/g, '').replace(/-/g, '');
    return /^(?:254|\+254|0)?(7|1)\d{8}$/.test(clean);
};

/**
 * Validates standard email addresses
 */
export const validateEmail = (email: string): boolean => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Normalizes a Kenyan phone number to 254... format for backend consistency
 */
export const normalizePhone = (num: string): string => {
    let clean = num.replace(/\s+/g, '').replace(/-/g, '').replace(/\+/g, '');
    if (clean.startsWith('0')) {
        clean = '254' + clean.slice(1);
    } else if (clean.startsWith('7') || clean.startsWith('1')) {
        clean = '254' + clean;
    }
    return clean;
};
