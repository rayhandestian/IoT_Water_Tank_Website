/**
 * DES (Data Encryption Standard) Implementation
 * Educational implementation for IoT Water Tank Cryptography Course
 * 
 * WARNING: DES is cryptographically broken and should not be used in production!
 * This implementation is for educational purposes only.
 * 
 * Standard: FIPS 46-3 (withdrawn)
 * Key size: 56 bits (8 bytes with parity)
 * Block size: 64 bits (8 bytes)
 * Rounds: 16
 */

// Initial Permutation (IP) table - maps input bit positions to new positions
const IP = [
    58, 50, 42, 34, 26, 18, 10, 2,
    60, 52, 44, 36, 28, 20, 12, 4,
    62, 54, 46, 38, 30, 22, 14, 6,
    64, 56, 48, 40, 32, 24, 16, 8,
    57, 49, 41, 33, 25, 17, 9, 1,
    59, 51, 43, 35, 27, 19, 11, 3,
    61, 53, 45, 37, 29, 21, 13, 5,
    63, 55, 47, 39, 31, 23, 15, 7
];

// Final Permutation (FP) table - inverse of IP
const FP = [
    40, 8, 48, 16, 56, 24, 64, 32,
    39, 7, 47, 15, 55, 23, 63, 31,
    38, 6, 46, 14, 54, 22, 62, 30,
    37, 5, 45, 13, 53, 21, 61, 29,
    36, 4, 44, 12, 52, 20, 60, 28,
    35, 3, 43, 11, 51, 19, 59, 27,
    34, 2, 42, 10, 50, 18, 58, 26,
    33, 1, 41, 9, 49, 17, 57, 25
];

// Expansion function (E) - expands 32-bit R to 48 bits
const E = [
    32, 1, 2, 3, 4, 5,
    4, 5, 6, 7, 8, 9,
    8, 9, 10, 11, 12, 13,
    12, 13, 14, 15, 16, 17,
    16, 17, 18, 19, 20, 21,
    20, 21, 22, 23, 24, 25,
    24, 25, 26, 27, 28, 29,
    28, 29, 30, 31, 32, 1
];

// S-Boxes (Substitution boxes) - 8 boxes, each 4x16 = 64 entries
const S_BOXES = [
    // S1
    [
        14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
        0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
        4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
        15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13
    ],
    // S2
    [
        15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
        3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
        0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
        13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9
    ],
    // S3
    [
        10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
        13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
        13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
        1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12
    ],
    // S4
    [
        7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
        13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
        10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
        3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14
    ],
    // S5
    [
        2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
        14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
        4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
        11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3
    ],
    // S6
    [
        12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
        10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
        9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
        4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13
    ],
    // S7
    [
        4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
        13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
        1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
        6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12
    ],
    // S8
    [
        13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
        1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
        7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
        2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11
    ]
];

// Permutation function (P) - permutes the output of S-boxes
const P = [
    16, 7, 20, 21, 29, 12, 28, 17,
    1, 15, 23, 26, 5, 18, 31, 10,
    2, 8, 24, 14, 32, 27, 3, 9,
    19, 13, 30, 6, 22, 11, 4, 25
];

// Key schedule permutations
// PC1 - Permuted Choice 1 (64 → 56 bits, removes parity bits)
const PC1 = [
    57, 49, 41, 33, 25, 17, 9,
    1, 58, 50, 42, 34, 26, 18,
    10, 2, 59, 51, 43, 35, 27,
    19, 11, 3, 60, 52, 44, 36,
    63, 55, 47, 39, 31, 23, 15,
    7, 62, 54, 46, 38, 30, 22,
    14, 6, 61, 53, 45, 37, 29,
    21, 13, 5, 28, 20, 12, 4
];

// PC2 - Permuted Choice 2 (56 → 48 bits for round keys)
const PC2 = [
    14, 17, 11, 24, 1, 5,
    3, 28, 15, 6, 21, 10,
    23, 19, 12, 4, 26, 8,
    16, 7, 27, 20, 13, 2,
    41, 52, 31, 37, 47, 55,
    30, 40, 51, 45, 33, 48,
    44, 49, 39, 56, 34, 53,
    46, 42, 50, 36, 29, 32
];

// Key rotation schedule (number of left shifts per round)
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

/**
 * ==========================================
 * STEP 2: BIT MANIPULATION UTILITIES
 * ==========================================
 * Cross-platform bit operations for DES implementation
 */

/**
 * Convert a string to array of bytes
 * @param {string} str - Input string
 * @returns {Array<number>} Array of byte values (0-255)
 */
function stringToBytes(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
    }
    return bytes;
}

/**
 * Convert array of bytes to string
 * @param {Array<number>} bytes - Array of byte values
 * @returns {string} Resulting string
 */
function bytesToString(bytes) {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i] & 0xFF);
    }
    return str;
}

/**
 * Convert bytes to 64-bit integer representation (as array of 2 x 32-bit)
 * JavaScript doesn't have true 64-bit integers, so we use two 32-bit parts
 * @param {Array<number>} bytes - 8 bytes
 * @returns {Array<number>} [high32, low32]
 */
function bytesToInt64(bytes) {
    let high = 0, low = 0;
    
    // High 32 bits (bytes 0-3)
    for (let i = 0; i < 4; i++) {
        high = (high << 8) | (bytes[i] & 0xFF);
    }
    
    // Low 32 bits (bytes 4-7)
    for (let i = 4; i < 8; i++) {
        low = (low << 8) | (bytes[i] & 0xFF);
    }
    
    // Ensure values are treated as unsigned 32-bit
    return [high >>> 0, low >>> 0];
}

/**
 * Convert 64-bit integer (as array) back to bytes
 * @param {Array<number>} int64 - [high32, low32]
 * @returns {Array<number>} 8 bytes
 */
function int64ToBytes(int64) {
    const bytes = [];
    const [high, low] = int64;
    
    // Extract high 32 bits to bytes 0-3
    for (let i = 3; i >= 0; i--) {
        bytes[3 - i] = (high >>> (i * 8)) & 0xFF;
    }
    
    // Extract low 32 bits to bytes 4-7
    for (let i = 3; i >= 0; i--) {
        bytes[7 - i] = (low >>> (i * 8)) & 0xFF;
    }
    
    return bytes;
}

/**
 * Get bit at specific position in 64-bit value
 * @param {Array<number>} int64 - [high32, low32]
 * @param {number} position - Bit position (1-64, DES convention)
 * @returns {number} 0 or 1
 */
function getBit(int64, position) {
    const [high, low] = int64;
    
    if (position >= 1 && position <= 32) {
        // Bit in low 32 bits (positions 1-32)
        return (low >>> (32 - position)) & 1;
    } else if (position >= 33 && position <= 64) {
        // Bit in high 32 bits (positions 33-64)
        return (high >>> (64 - position)) & 1;
    }
    
    throw new Error(`Invalid bit position: ${position} (must be 1-64)`);
}

/**
 * Set bit at specific position in 64-bit value
 * @param {Array<number>} int64 - [high32, low32] (modified in place)
 * @param {number} position - Bit position (1-64, DES convention)
 * @param {number} value - 0 or 1
 */
function setBit(int64, position, value) {
    if (position >= 1 && position <= 32) {
        // Bit in low 32 bits
        const bitPos = 32 - position;
        if (value) {
            int64[1] |= (1 << bitPos);
        } else {
            int64[1] &= ~(1 << bitPos);
        }
        int64[1] >>>= 0; // Ensure unsigned
    } else if (position >= 33 && position <= 64) {
        // Bit in high 32 bits
        const bitPos = 64 - position;
        if (value) {
            int64[0] |= (1 << bitPos);
        } else {
            int64[0] &= ~(1 << bitPos);
        }
        int64[0] >>>= 0; // Ensure unsigned
    } else {
        throw new Error(`Invalid bit position: ${position} (must be 1-64)`);
    }
}

/**
 * Perform permutation on 64-bit value using given permutation table
 * @param {Array<number>} int64 - [high32, low32]
 * @param {Array<number>} permTable - Permutation table
 * @returns {Array<number>} Permuted [high32, low32]
 */
function permute(int64, permTable) {
    const result = [0, 0];
    
    for (let i = 0; i < permTable.length; i++) {
        const sourceBit = getBit(int64, permTable[i]);
        setBit(result, i + 1, sourceBit);
    }
    
    return result;
}

/**
 * Left rotate 28-bit value by specified amount
 * @param {number} value - 28-bit value
 * @param {number} amount - Number of positions to rotate
 * @returns {number} Rotated value
 */
function leftRotate28(value, amount) {
    const mask28 = 0x0FFFFFFF; // 28-bit mask
    value &= mask28;
    return ((value << amount) | (value >>> (28 - amount))) & mask28;
}

/**
 * Split 64-bit value into two 32-bit halves
 * @param {Array<number>} int64 - [high32, low32]
 * @returns {Array<number>} [left32, right32]
 */
function split64(int64) {
    return [int64[0], int64[1]];
}

/**
 * Join two 32-bit halves into 64-bit value
 * @param {number} left32 - Left 32 bits
 * @param {number} right32 - Right 32 bits
 * @returns {Array<number>} [high32, low32]
 */
function join64(left32, right32) {
    return [left32 >>> 0, right32 >>> 0];
}

/**
 * XOR two 64-bit values
 * @param {Array<number>} a - [high32, low32]
 * @param {Array<number>} b - [high32, low32]
 * @returns {Array<number>} a XOR b
 */
function xor64(a, b) {
    return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
}

/**
 * XOR two 32-bit values
 * @param {number} a - 32-bit value
 * @param {number} b - 32-bit value
 * @returns {number} a XOR b
 */
function xor32(a, b) {
    return (a ^ b) >>> 0;
}

/**
 * Convert hex string to bytes
 * @param {string} hex - Hex string
 * @returns {Array<number>} Array of bytes
 */
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

/**
 * Convert bytes to hex string
 * @param {Array<number>} bytes - Array of bytes
 * @returns {string} Hex string
 */
function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += ((bytes[i] & 0xFF) + 0x100).toString(16).substr(1).toUpperCase();
    }
    return hex;
}

/**
 * ==========================================
 * STEP 3: CORE DES ALGORITHM FUNCTIONS
 * ==========================================
 * Main DES encryption/decryption implementation
 */

/**
 * Generate 16 round keys from main key
 * @param {Array<number>} keyBytes - 8-byte key
 * @returns {Array<Array<number>>} Array of 16 round keys (each 48 bits as [high32, low32])
 */
function generateRoundKeys(keyBytes) {
    // Convert key to 64-bit format
    const key64 = bytesToInt64(keyBytes);
    
    // Apply PC1 permutation (64 → 56 bits)
    const permKey = permute(key64, PC1);
    
    // Split into two 28-bit halves
    let [high, low] = permKey;
    let C = high >>> 4; // Get upper 28 bits of high32
    let D = ((high & 0xF) << 24) | (low >>> 8); // Get lower 4 bits of high32 + upper 24 bits of low32
    
    const roundKeys = [];
    
    // Generate 16 round keys
    for (let round = 0; round < 16; round++) {
        // Rotate C and D left by SHIFTS[round] positions
        C = leftRotate28(C, SHIFTS[round]);
        D = leftRotate28(D, SHIFTS[round]);
        
        // Combine C and D into 56-bit value
        const combined = [
            (C << 4) | (D >>> 24),
            (D << 8) >>> 0
        ];
        
        // Apply PC2 permutation (56 → 48 bits)
        const roundKey = permute(combined, PC2);
        roundKeys.push(roundKey);
    }
    
    return roundKeys;
}

/**
 * DES F-function (Feistel function)
 * @param {number} R - 32-bit right half
 * @param {Array<number>} roundKey - 48-bit round key as [high32, low32]
 * @returns {number} 32-bit result
 */
function fFunction(R, roundKey) {
    // Convert R to 64-bit format for expansion
    const R64 = [0, R];
    
    // Apply expansion function E (32 → 48 bits)
    const expanded = permute(R64, E);
    
    // XOR with round key
    const xored = xor64(expanded, roundKey);
    
    // Apply S-boxes (48 → 32 bits)
    let sboxOutput = 0;
    
    for (let i = 0; i < 8; i++) {
        // Extract 6 bits for each S-box
        let sixBits;
        if (i < 4) {
            // Bits from high 32-bit word
            const shift = 26 - (i * 6);
            sixBits = (xored[0] >>> shift) & 0x3F;
        } else {
            // Bits from low 32-bit word
            const shift = 26 - ((i - 4) * 6);
            sixBits = (xored[1] >>> shift) & 0x3F;
        }
        
        // Calculate S-box row and column
        const row = ((sixBits & 0x20) >>> 4) | (sixBits & 0x01); // First and last bits
        const col = (sixBits & 0x1E) >>> 1; // Middle 4 bits
        
        // Get S-box value (4 bits)
        const sboxValue = S_BOXES[i][row * 16 + col];
        
        // Shift into position (4 bits per S-box)
        sboxOutput |= (sboxValue << (28 - (i * 4)));
    }
    
    // Apply P permutation
    const pInput = [0, sboxOutput];
    const pOutput = permute(pInput, P);
    
    return pOutput[1]; // Return low 32 bits
}

/**
 * Encrypt single 64-bit block with DES
 * @param {Array<number>} blockBytes - 8-byte block to encrypt
 * @param {Array<number>} keyBytes - 8-byte encryption key
 * @returns {Array<number>} 8-byte encrypted block
 */
function desEncryptBlock(blockBytes, keyBytes) {
    // Generate round keys
    const roundKeys = generateRoundKeys(keyBytes);
    
    // Convert block to 64-bit format
    const block64 = bytesToInt64(blockBytes);
    
    // Apply initial permutation (IP)
    const permuted = permute(block64, IP);
    
    // Split into left and right halves
    let [L, R] = split64(permuted);
    
    // 16 rounds of Feistel structure
    for (let round = 0; round < 16; round++) {
        const newR = xor32(L, fFunction(R, roundKeys[round]));
        L = R;
        R = newR;
    }
    
    // Combine final halves (note: R, L order for DES)
    const combined = join64(R, L);
    
    // Apply final permutation (FP)
    const finalPermuted = permute(combined, FP);
    
    // Convert back to bytes
    return int64ToBytes(finalPermuted);
}

/**
 * Decrypt single 64-bit block with DES
 * @param {Array<number>} blockBytes - 8-byte block to decrypt
 * @param {Array<number>} keyBytes - 8-byte decryption key
 * @returns {Array<number>} 8-byte decrypted block
 */
function desDecryptBlock(blockBytes, keyBytes) {
    // Generate round keys
    const roundKeys = generateRoundKeys(keyBytes);
    
    // Convert block to 64-bit format
    const block64 = bytesToInt64(blockBytes);
    
    // Apply initial permutation (IP)
    const permuted = permute(block64, IP);
    
    // Split into left and right halves
    let [L, R] = split64(permuted);
    
    // 16 rounds of Feistel structure (reverse order for decryption)
    for (let round = 15; round >= 0; round--) {
        const newR = xor32(L, fFunction(R, roundKeys[round]));
        L = R;
        R = newR;
    }
    
    // Combine final halves (note: R, L order for DES)
    const combined = join64(R, L);
    
    // Apply final permutation (FP)
    const finalPermuted = permute(combined, FP);
    
    // Convert back to bytes
    return int64ToBytes(finalPermuted);
}

/**
 * ==========================================
 * STEP 4: DATA WRAPPER LAYER
 * ==========================================
 * High-level functions that maintain current interface
 */

/**
 * Prepare key from string (pad/truncate to 8 bytes)
 * @param {string} keyString - Key as string
 * @returns {Array<number>} 8-byte key
 */
function prepareKey(keyString) {
    const keyBytes = stringToBytes(keyString);
    const prepared = new Array(8).fill(0);
    
    // Copy up to 8 bytes
    for (let i = 0; i < Math.min(8, keyBytes.length); i++) {
        prepared[i] = keyBytes[i];
    }
    
    // If key is shorter than 8 bytes, repeat it
    if (keyBytes.length < 8) {
        for (let i = keyBytes.length; i < 8; i++) {
            prepared[i] = keyBytes[i % keyBytes.length];
        }
    }
    
    return prepared;
}

/**
 * Pad data to multiple of 8 bytes using PKCS#7 padding
 * @param {Array<number>} data - Input data bytes
 * @returns {Array<number>} Padded data
 */
function addPadding(data) {
    const paddingLength = 8 - (data.length % 8);
    const padded = data.slice(); // Copy original data
    
    // Add padding bytes (each byte contains the padding length)
    for (let i = 0; i < paddingLength; i++) {
        padded.push(paddingLength);
    }
    
    return padded;
}

/**
 * Remove PKCS#7 padding
 * @param {Array<number>} data - Padded data bytes
 * @returns {Array<number>} Unpadded data
 */
function removePadding(data) {
    if (data.length === 0) {
        return data;
    }
    
    const paddingLength = data[data.length - 1];
    
    // Validate padding
    if (paddingLength < 1 || paddingLength > 8 || paddingLength > data.length) {
        throw new Error('Invalid padding');
    }
    
    // Check all padding bytes are correct
    for (let i = data.length - paddingLength; i < data.length; i++) {
        if (data[i] !== paddingLength) {
            throw new Error('Invalid padding');
        }
    }
    
    return data.slice(0, data.length - paddingLength);
}

/**
 * Encrypt string data with DES
 * @param {string} plaintext - Data to encrypt
 * @param {string} key - Encryption key
 * @returns {string} Hex-encoded encrypted data
 */
function desEncrypt(plaintext, key) {
    try {
        // Prepare key and data
        const keyBytes = prepareKey(key);
        const dataBytes = addPadding(stringToBytes(plaintext));
        
        const encrypted = [];
        
        // Encrypt each 8-byte block
        for (let i = 0; i < dataBytes.length; i += 8) {
            const block = dataBytes.slice(i, i + 8);
            const encryptedBlock = desEncryptBlock(block, keyBytes);
            encrypted.push(...encryptedBlock);
        }
        
        return bytesToHex(encrypted);
    } catch (error) {
        console.error('DES encryption error:', error);
        throw error;
    }
}

/**
 * Decrypt hex-encoded DES data
 * @param {string} ciphertext - Hex-encoded encrypted data
 * @param {string} key - Decryption key
 * @returns {string} Decrypted plaintext
 */
function desDecrypt(ciphertext, key) {
    try {
        // Prepare key and data
        const keyBytes = prepareKey(key);
        const dataBytes = hexToBytes(ciphertext);
        
        if (dataBytes.length % 8 !== 0) {
            throw new Error('Invalid ciphertext length (must be multiple of 8 bytes)');
        }
        
        const decrypted = [];
        
        // Decrypt each 8-byte block
        for (let i = 0; i < dataBytes.length; i += 8) {
            const block = dataBytes.slice(i, i + 8);
            const decryptedBlock = desDecryptBlock(block, keyBytes);
            decrypted.push(...decryptedBlock);
        }
        
        // Remove padding and convert to string
        const unpadded = removePadding(decrypted);
        return bytesToString(unpadded);
    } catch (error) {
        console.error('DES decryption error:', error);
        throw error;
    }
}

// Export tables for cross-platform use
const DES_TABLES = {
    IP,
    FP,
    E,
    S_BOXES,
    P,
    PC1,
    PC2,
    SHIFTS
};

// Export all functions and utilities
const DES_CRYPTO = {
    // Tables
    ...DES_TABLES,
    
    // Bit utilities
    stringToBytes,
    bytesToString,
    bytesToInt64,
    int64ToBytes,
    getBit,
    setBit,
    permute,
    leftRotate28,
    split64,
    join64,
    xor64,
    xor32,
    hexToBytes,
    bytesToHex,
    
    // Core DES functions
    generateRoundKeys,
    fFunction,
    desEncryptBlock,
    desDecryptBlock,
    
    // High-level interface
    prepareKey,
    addPadding,
    removePadding,
    desEncrypt,
    desDecrypt
};

// For Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DES_CRYPTO;
}

// For browser environment
if (typeof window !== 'undefined') {
    window.DES_CRYPTO = DES_CRYPTO;
}

// For ES6 modules (Vite build)
export default DES_CRYPTO; 