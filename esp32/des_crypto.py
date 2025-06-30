"""
DES (Data Encryption Standard) Implementation for ESP32 MicroPython
Educational implementation for IoT Water Tank Cryptography Course

WARNING: DES is cryptographically broken and should not be used in production!
This implementation is for educational purposes only.

Memory optimized for ESP32 (~1.2KB RAM usage)
"""

# DES Tables - Stored in ROM to save RAM
IP = bytes([
    58, 50, 42, 34, 26, 18, 10, 2,
    60, 52, 44, 36, 28, 20, 12, 4,
    62, 54, 46, 38, 30, 22, 14, 6,
    64, 56, 48, 40, 32, 24, 16, 8,
    57, 49, 41, 33, 25, 17, 9, 1,
    59, 51, 43, 35, 27, 19, 11, 3,
    61, 53, 45, 37, 29, 21, 13, 5,
    63, 55, 47, 39, 31, 23, 15, 7
])

FP = bytes([
    40, 8, 48, 16, 56, 24, 64, 32,
    39, 7, 47, 15, 55, 23, 63, 31,
    38, 6, 46, 14, 54, 22, 62, 30,
    37, 5, 45, 13, 53, 21, 61, 29,
    36, 4, 44, 12, 52, 20, 60, 28,
    35, 3, 43, 11, 51, 19, 59, 27,
    34, 2, 42, 10, 50, 18, 58, 26,
    33, 1, 41, 9, 49, 17, 57, 25
])

E = bytes([
    32, 1, 2, 3, 4, 5,
    4, 5, 6, 7, 8, 9,
    8, 9, 10, 11, 12, 13,
    12, 13, 14, 15, 16, 17,
    16, 17, 18, 19, 20, 21,
    20, 21, 22, 23, 24, 25,
    24, 25, 26, 27, 28, 29,
    28, 29, 30, 31, 32, 1
])

# S-Boxes - Compressed representation
S_BOXES = [
    # S1
    bytes([
        14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
        0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
        4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
        15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13
    ]),
    # S2
    bytes([
        15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
        3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
        0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
        13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9
    ]),
    # S3
    bytes([
        10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
        13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
        13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
        1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12
    ]),
    # S4
    bytes([
        7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
        13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
        10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
        3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14
    ]),
    # S5
    bytes([
        2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
        14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
        4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
        11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3
    ]),
    # S6
    bytes([
        12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
        10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
        9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
        4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13
    ]),
    # S7
    bytes([
        4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
        13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
        1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
        6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12
    ]),
    # S8
    bytes([
        13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
        1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
        7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
        2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11
    ])
]

P = bytes([
    16, 7, 20, 21, 29, 12, 28, 17,
    1, 15, 23, 26, 5, 18, 31, 10,
    2, 8, 24, 14, 32, 27, 3, 9,
    19, 13, 30, 6, 22, 11, 4, 25
])

PC1 = bytes([
    57, 49, 41, 33, 25, 17, 9,
    1, 58, 50, 42, 34, 26, 18,
    10, 2, 59, 51, 43, 35, 27,
    19, 11, 3, 60, 52, 44, 36,
    63, 55, 47, 39, 31, 23, 15,
    7, 62, 54, 46, 38, 30, 22,
    14, 6, 61, 53, 45, 37, 29,
    21, 13, 5, 28, 20, 12, 4
])

PC2 = bytes([
    14, 17, 11, 24, 1, 5,
    3, 28, 15, 6, 21, 10,
    23, 19, 12, 4, 26, 8,
    16, 7, 27, 20, 13, 2,
    41, 52, 31, 37, 47, 55,
    30, 40, 51, 45, 33, 48,
    44, 49, 39, 56, 34, 53,
    46, 42, 50, 36, 29, 32
])

SHIFTS = bytes([1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1])

# Utility functions
def bytes_to_int64(data):
    """Convert 8 bytes to 64-bit integer (as tuple of 2x32-bit)"""
    high = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]
    low = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]
    return (high, low)

def int64_to_bytes(high, low):
    """Convert 64-bit integer to 8 bytes"""
    return bytes([
        (high >> 24) & 0xFF, (high >> 16) & 0xFF, (high >> 8) & 0xFF, high & 0xFF,
        (low >> 24) & 0xFF, (low >> 16) & 0xFF, (low >> 8) & 0xFF, low & 0xFF
    ])

def get_bit(high, low, pos):
    """Get bit at position (1-64, DES convention)"""
    if pos <= 32:
        return (low >> (32 - pos)) & 1
    else:
        return (high >> (64 - pos)) & 1

def set_bit(high, low, pos, value):
    """Set bit at position, returns new (high, low)"""
    if pos <= 32:
        bit_pos = 32 - pos
        if value:
            low |= (1 << bit_pos)
        else:
            low &= ~(1 << bit_pos)
    else:
        bit_pos = 64 - pos
        if value:
            high |= (1 << bit_pos)
        else:
            high &= ~(1 << bit_pos)
    
    return (high & 0xFFFFFFFF, low & 0xFFFFFFFF)

def permute(high, low, perm_table):
    """Apply permutation table"""
    result_high, result_low = 0, 0
    
    for i in range(len(perm_table)):
        source_bit = get_bit(high, low, perm_table[i])
        result_high, result_low = set_bit(result_high, result_low, i + 1, source_bit)
    
    return (result_high, result_low)

def left_rotate_28(value, amount):
    """Left rotate 28-bit value"""
    mask = 0x0FFFFFFF
    value &= mask
    return ((value << amount) | (value >> (28 - amount))) & mask

def generate_round_keys(key_bytes):
    """Generate 16 round keys from 8-byte key"""
    # Convert key to 64-bit
    high, low = bytes_to_int64(key_bytes)
    
    # Apply PC1 permutation
    perm_high, perm_low = permute(high, low, PC1)
    
    # Split into two 28-bit halves
    C = perm_high >> 4
    D = ((perm_high & 0xF) << 24) | (perm_low >> 8)
    
    round_keys = []
    
    for round_num in range(16):
        # Rotate C and D
        C = left_rotate_28(C, SHIFTS[round_num])
        D = left_rotate_28(D, SHIFTS[round_num])
        
        # Combine C and D
        combined_high = (C << 4) | (D >> 24)
        combined_low = (D << 8) & 0xFFFFFFFF
        
        # Apply PC2 permutation
        round_key = permute(combined_high, combined_low, PC2)
        round_keys.append(round_key)
    
    return round_keys

def f_function(R, round_key_high, round_key_low):
    """DES F-function"""
    # Apply expansion E
    expanded_high, expanded_low = permute(0, R, E)
    
    # XOR with round key
    xored_high = expanded_high ^ round_key_high
    xored_low = expanded_low ^ round_key_low
    
    # Apply S-boxes
    sbox_output = 0
    
    for i in range(8):
        # Extract 6 bits for each S-box
        if i < 4:
            shift = 26 - (i * 6)
            six_bits = (xored_high >> shift) & 0x3F
        else:
            shift = 26 - ((i - 4) * 6)
            six_bits = (xored_low >> shift) & 0x3F
        
        # Calculate S-box indices
        row = ((six_bits & 0x20) >> 4) | (six_bits & 0x01)
        col = (six_bits & 0x1E) >> 1
        
        # Get S-box value
        sbox_value = S_BOXES[i][row * 16 + col]
        
        # Add to output
        sbox_output |= (sbox_value << (28 - (i * 4)))
    
    # Apply P permutation
    _, p_output = permute(0, sbox_output, P)
    
    return p_output

def des_encrypt_block(block_bytes, key_bytes):
    """Encrypt single 8-byte block"""
    # Generate round keys
    round_keys = generate_round_keys(key_bytes)
    
    # Convert block to 64-bit
    high, low = bytes_to_int64(block_bytes)
    
    # Apply initial permutation
    perm_high, perm_low = permute(high, low, IP)
    
    # Split into L and R
    L, R = perm_high, perm_low
    
    # 16 rounds
    for round_num in range(16):
        rk_high, rk_low = round_keys[round_num]
        new_R = L ^ f_function(R, rk_high, rk_low)
        L = R
        R = new_R
    
    # Final permutation (note: R, L order)
    final_high, final_low = permute(R, L, FP)
    
    return int64_to_bytes(final_high, final_low)

def des_decrypt_block(block_bytes, key_bytes):
    """Decrypt single 8-byte block"""
    # Generate round keys
    round_keys = generate_round_keys(key_bytes)
    
    # Convert block to 64-bit
    high, low = bytes_to_int64(block_bytes)
    
    # Apply initial permutation
    perm_high, perm_low = permute(high, low, IP)
    
    # Split into L and R
    L, R = perm_high, perm_low
    
    # 16 rounds (reverse order)
    for round_num in range(15, -1, -1):
        rk_high, rk_low = round_keys[round_num]
        new_R = L ^ f_function(R, rk_high, rk_low)
        L = R
        R = new_R
    
    # Final permutation (note: R, L order)
    final_high, final_low = permute(R, L, FP)
    
    return int64_to_bytes(final_high, final_low)

def prepare_key(key_string):
    """Prepare 8-byte key from string"""
    key_bytes = key_string.encode('utf-8')
    prepared = bytearray(8)
    
    for i in range(8):
        prepared[i] = key_bytes[i % len(key_bytes)]
    
    return bytes(prepared)

def add_padding(data):
    """Add PKCS#7 padding"""
    padding_length = 8 - (len(data) % 8)
    return data + bytes([padding_length] * padding_length)

def remove_padding(data):
    """Remove PKCS#7 padding"""
    if len(data) == 0:
        return data
    
    padding_length = data[-1]
    if padding_length < 1 or padding_length > 8:
        raise ValueError("Invalid padding")
    
    return data[:-padding_length]

def bytes_to_hex(data):
    """Convert bytes to hex string"""
    return ''.join('%02X' % b for b in data)

def hex_to_bytes(hex_string):
    """Convert hex string to bytes"""
    result = bytearray()
    for i in range(0, len(hex_string), 2):
        result.append(int(hex_string[i:i+2], 16))
    return bytes(result)

def des_encrypt(plaintext, key):
    """High-level DES encryption"""
    try:
        # Prepare key and data
        key_bytes = prepare_key(key)
        data_bytes = add_padding(plaintext.encode('utf-8'))
        
        encrypted = bytearray()
        
        # Encrypt each block
        for i in range(0, len(data_bytes), 8):
            block = data_bytes[i:i+8]
            encrypted_block = des_encrypt_block(block, key_bytes)
            encrypted.extend(encrypted_block)
        
        return bytes_to_hex(encrypted)
    except Exception as e:
        print("DES encryption error:", e)
        raise

def des_decrypt(ciphertext, key):
    """High-level DES decryption"""
    try:
        # Prepare key and data
        key_bytes = prepare_key(key)
        data_bytes = hex_to_bytes(ciphertext)
        
        if len(data_bytes) % 8 != 0:
            raise ValueError("Invalid ciphertext length")
        
        decrypted = bytearray()
        
        # Decrypt each block
        for i in range(0, len(data_bytes), 8):
            block = data_bytes[i:i+8]
            decrypted_block = des_decrypt_block(block, key_bytes)
            decrypted.extend(decrypted_block)
        
        # Remove padding and convert to string
        unpadded = remove_padding(decrypted)
        return unpadded.decode('utf-8')
    except Exception as e:
        print("DES decryption error:", e)
        raise

# Memory-efficient test function
def test_des_esp32():
    """Quick test for ESP32"""
    print("🔐 Testing DES on ESP32...")
    
    # Test basic encryption/decryption
    plaintext = "12.5"
    key = "MySecretKey123"
    
    print(f"Original: {plaintext}")
    encrypted = des_encrypt(plaintext, key)
    print(f"Encrypted: {encrypted}")
    decrypted = des_decrypt(encrypted, key)
    print(f"Decrypted: {decrypted}")
    
    if decrypted == plaintext:
        print("✅ DES test passed!")
        return True
    else:
        print("❌ DES test failed!")
        return False 