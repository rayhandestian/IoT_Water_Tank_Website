/**
 * Cryptography Utilities for Water Tank Frontend
 * Educational implementation - includes both XOR and DES algorithms
 */

// Import DES crypto module
import DES_CRYPTO from './des_crypto.js';

/**
 * XOR decryption function (legacy/simple)
 * @param {string} encryptedHex - Hex-encoded encrypted data
 * @param {string} key - Decryption key
 * @returns {number|null} Decrypted water level or null if failed
 */
export const decryptWaterLevelXOR = (encryptedHex, key) => {
  try {
    if (!encryptedHex || !key) return null;
    
    let result = '';
    
    // Convert hex string back to bytes and decrypt
    for (let i = 0; i < encryptedHex.length; i += 2) {
      const hexByte = encryptedHex.substring(i, i + 2);
      const encryptedByte = parseInt(hexByte, 16);
      const keyByte = key.charCodeAt(Math.floor(i/2) % key.length);
      const decryptedByte = encryptedByte ^ keyByte;
      result += String.fromCharCode(decryptedByte);
    }
    
    const decryptedValue = parseFloat(result);
    return isNaN(decryptedValue) ? null : decryptedValue;
  } catch (error) {
    console.error('XOR decryption error:', error);
    return null;
  }
};

/**
 * DES decryption function
 * @param {string} encryptedHex - Hex-encoded encrypted data
 * @param {string} key - Decryption key
 * @returns {number|null} Decrypted water level or null if failed
 */
export const decryptWaterLevelDES = (encryptedHex, key) => {
  try {
    if (!encryptedHex || !key) return null;
    
    // Use DES decryption
    const decryptedString = DES_CRYPTO.desDecrypt(encryptedHex, key);
    const decryptedValue = parseFloat(decryptedString);
    
    return isNaN(decryptedValue) ? null : decryptedValue;
  } catch (error) {
    console.error('DES decryption error:', error);
    return null;
  }
};

/**
 * Auto-detect algorithm and decrypt
 * @param {string} encryptedHex - Hex-encoded encrypted data
 * @param {string} key - Decryption key
 * @param {string} algorithm - 'XOR', 'DES', or 'AUTO'
 * @returns {Object} { value: number|null, algorithm: string, success: boolean }
 */
export const decryptWaterLevel = (encryptedHex, key, algorithm = 'AUTO') => {
  if (!encryptedHex || !key) {
    return { value: null, algorithm: 'none', success: false };
  }

  // If specific algorithm is requested
  if (algorithm === 'XOR') {
    const value = decryptWaterLevelXOR(encryptedHex, key);
    return { value, algorithm: 'XOR', success: value !== null };
  }
  
  if (algorithm === 'DES') {
    const value = decryptWaterLevelDES(encryptedHex, key);
    return { value, algorithm: 'DES', success: value !== null };
  }

  // Auto-detection mode: try both algorithms
  if (algorithm === 'AUTO') {
    // Try DES first (more likely for newer data)
    const desResult = decryptWaterLevelDES(encryptedHex, key);
    if (desResult !== null && desResult >= 0 && desResult <= 1000) { // Reasonable water level range
      return { value: desResult, algorithm: 'DES', success: true };
    }
    
    // Try XOR as fallback
    const xorResult = decryptWaterLevelXOR(encryptedHex, key);
    if (xorResult !== null && xorResult >= 0 && xorResult <= 1000) {
      return { value: xorResult, algorithm: 'XOR', success: true };
    }
    
    return { value: null, algorithm: 'unknown', success: false };
  }

  return { value: null, algorithm: 'invalid', success: false };
};

/**
 * Get algorithm info for educational display
 * @param {string} algorithm - Algorithm name
 * @returns {Object} Algorithm information
 */
export const getAlgorithmInfo = (algorithm) => {
  const info = {
    'XOR': {
      name: 'XOR Cipher',
      description: 'Simple XOR-based encryption',
      security: 'Very Low',
      keySize: 'Variable',
      blockSize: 'Stream',
      emoji: '⚡',
      color: '#f59e0b'
    },
    'DES': {
      name: 'Data Encryption Standard',
      description: 'Block cipher with 56-bit key',
      security: 'Broken (Educational Only)',
      keySize: '56-bit + 8 parity',
      blockSize: '64-bit',
      emoji: '🔐',
      color: '#8b5cf6'
    },
    'AUTO': {
      name: 'Auto-Detection',
      description: 'Automatically detect algorithm',
      security: 'Variable',
      keySize: 'Variable',
      blockSize: 'Variable',
      emoji: '🔍',
      color: '#6b7280'
    }
  };
  
  return info[algorithm] || {
    name: 'Unknown',
    description: 'Unknown algorithm',
    security: 'Unknown',
    keySize: 'Unknown',
    blockSize: 'Unknown',
    emoji: '❓',
    color: '#ef4444'
  };
};

/**
 * Test both algorithms with sample data for educational purposes
 * @param {string} key - Test key
 * @returns {Object} Test results
 */
export const testAlgorithms = (key = 'MySecretKey123') => {
  const testData = '12.5';
  
  try {
    // Test XOR
    const xorEncrypted = testData.split('').map((char, i) => {
      const dataCode = char.charCodeAt(0);
      const keyCode = key.charCodeAt(i % key.length);
      return (dataCode ^ keyCode).toString(16).padStart(2, '0').toUpperCase();
    }).join('');
    
    const xorDecrypted = decryptWaterLevelXOR(xorEncrypted, key);
    
    // Test DES
    const desEncrypted = DES_CRYPTO.desEncrypt(testData, key);
    const desDecrypted = decryptWaterLevelDES(desEncrypted, key);
    
    return {
      success: true,
      testData,
      key,
      results: {
        XOR: {
          encrypted: xorEncrypted,
          decrypted: xorDecrypted,
          success: Math.abs(xorDecrypted - parseFloat(testData)) < 0.01
        },
        DES: {
          encrypted: desEncrypted,
          decrypted: desDecrypted,
          success: Math.abs(desDecrypted - parseFloat(testData)) < 0.01
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}; 