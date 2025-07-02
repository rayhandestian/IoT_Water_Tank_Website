# Water Level Data Encryption Guide

## Overview

This IoT Water Tank system implements educational cryptography to protect water level sensor data as it travels from the ESP32 device to the web server. The system supports two encryption algorithms:

- **XOR Cipher**: Simple, lightweight encryption suitable for resource-constrained devices
- **DES (Data Encryption Standard)**: More sophisticated block cipher with 56-bit keys

> **⚠️ IMPORTANT SECURITY NOTE**: This implementation is designed for **educational purposes only**. DES has been cryptographically broken since the late 1990s and should never be used in production systems. Modern applications should use AES or other contemporary algorithms.

## Architecture Overview

```
ESP32 Device                    Web Server                    Frontend
┌─────────────┐                ┌─────────────┐               ┌─────────────┐
│ Water Level │  Encrypted     │   Node.js   │   Encrypted   │  React App  │
│   Sensor    │     Data       │    API      │     Data      │  Dashboard  │
│             │ ──────────────>│             │ ──────────────>│             │
│ DES/XOR     │     HTTPS      │ DES/XOR     │     HTTPS     │ DES/XOR     │
│ Encryption  │                │ Decryption  │               │ Decryption  │
└─────────────┘                └─────────────┘               └─────────────┘
```

## Data Flow

1. **ESP32 reads water level** (e.g., `12.5` cm)
2. **ESP32 encrypts data** using DES or XOR with shared key
3. **ESP32 sends encrypted hex** to server via HTTPS POST
4. **Server stores encrypted data** in database without decryption
5. **Frontend requests data** from server
6. **Server returns encrypted data** to frontend
7. **Frontend decrypts data** client-side for display

## ESP32 Implementation

### Configuration

The ESP32 code supports configurable encryption:

```python
# Encryption settings in main.py
USE_ENCRYPTED_MODE = True           # Enable/disable encryption
ENCRYPTION_ALGORITHM = "DES"        # "DES" or "XOR"
ENCRYPTION_KEY = "MySecretKey123"   # Shared secret key
```

### DES Encryption on ESP32

The ESP32 uses a memory-optimized DES implementation (`esp32/des_crypto.py`):

```python
def encrypt_water_level_des(level, key):
    """
    Encrypts water level using DES encryption
    
    Input:  12.5 (float)
    Output: "A3B2C1D4E5F60708" (hex string)
    """
    # Convert float to string with 1 decimal place
    data_str = "{:.1f}".format(level)  # "12.5"
    
    # Use DES encryption with PKCS#7 padding
    encrypted_hex = des_encrypt(data_str, key)
    return encrypted_hex
```

### XOR Encryption on ESP32 (Fallback)

For devices with limited memory, XOR encryption provides a lightweight alternative:

```python
def encrypt_water_level_xor(level, key):
    """
    Simple XOR encryption for lightweight operation
    
    Input:  12.5 (float)
    Output: "1A2B3C4D" (hex string)
    """
    data_str = "{:.1f}".format(level)
    result = ""
    
    for i, char in enumerate(data_str):
        data_byte = ord(char)
        key_byte = ord(key[i % len(key)])
        encrypted_byte = data_byte ^ key_byte
        result += "{:02X}".format(encrypted_byte)
    
    return result
```

### Data Transmission

The ESP32 sends encrypted data to the server:

```python
def send_encrypted_water_level_to_server():
    water_level = read_water_level_cm()           # 12.5
    encrypted_level = encrypt_water_level(water_level, ENCRYPTION_KEY)  # "A3B2C1D4E5F60708"
    
    data_payload = {'encrypted_level': encrypted_level}
    response = urequests.post(f"{SERVER_URL}/encrypted-data", 
                            headers=headers, json=data_payload)
```

## DES Algorithm Implementation

### Core DES Components

The DES implementation includes all standard components:

#### 1. **Initial Permutation (IP)**
Rearranges the 64-bit input block according to a fixed table:
```python
IP = [58, 50, 42, 34, 26, 18, 10, 2, ...]  # 64 positions
```

#### 2. **Key Schedule**
Generates 16 round keys from the 64-bit master key:
- **PC1**: Reduces 64-bit key to 56-bit (removes parity bits)
- **PC2**: Creates 48-bit round keys from 56-bit rotated halves
- **Shifts**: Left rotation schedule `[1, 1, 2, 2, 2, 2, ...]`

#### 3. **Feistel Structure (16 rounds)**
Each round applies the F-function:
- **Expansion (E)**: Expands 32-bit half to 48 bits
- **Key Mixing**: XOR with round key
- **S-Boxes**: 8 substitution boxes reduce 48 bits to 32 bits
- **Permutation (P)**: Final bit rearrangement

#### 4. **S-Boxes (Substitution Boxes)**
8 lookup tables that provide non-linearity:
```python
# Example S-Box 1 (first few entries)
S_BOXES[0] = [14, 4, 13, 1, 2, 15, 11, 8, ...]
```

#### 5. **Final Permutation (FP)**
Inverse of the initial permutation.

### Memory Optimization for ESP32

The ESP32 implementation is optimized for microcontrollers:

- **64-bit operations**: Simulated using two 32-bit integers
- **Lookup tables**: Stored in ROM to save RAM (~1.2KB total usage)
- **Block processing**: Processes data in 8-byte chunks
- **PKCS#7 padding**: Handles variable-length input

### Example Encryption Process

```
Plaintext:    "12.5"
Padded:       "12.5\x04\x04\x04\x04"  (PKCS#7 padding)
Key:          "MySecretKey123" → 8 bytes
DES Process:  IP → 16 Feistel rounds → FP
Ciphertext:   [0xA3, 0xB2, 0xC1, 0xD4, 0xE5, 0xF6, 0x07, 0x08]
Hex Output:   "A3B2C1D4E5F60708"
```

## Server Implementation

### API Endpoints

The Node.js server provides separate endpoints for encrypted data:

```javascript
// Regular data endpoint
POST /api/data
{
  "level_cm": 12.5
}

// Encrypted data endpoint  
POST /api/encrypted-data
{
  "encrypted_level": "A3B2C1D4E5F60708"
}
```

### Database Storage

The server stores encrypted data without decryption:

```sql
-- Regular sensor data
CREATE TABLE sensor_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level_cm DECIMAL(5,2),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Encrypted sensor data
CREATE TABLE encrypted_sensor_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  encrypted_level VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Server-Side DES Implementation

The server includes a JavaScript DES implementation (`utils/des_crypto.js`) that mirrors the ESP32 version:

```javascript
// High-level encryption function
function desEncrypt(plaintext, key) {
    const keyBytes = prepareKey(key);
    const dataBytes = addPadding(stringToBytes(plaintext));
    
    const encrypted = [];
    for (let i = 0; i < dataBytes.length; i += 8) {
        const block = dataBytes.slice(i, i + 8);
        const encryptedBlock = desEncryptBlock(block, keyBytes);
        encrypted.push(...encryptedBlock);
    }
    
    return bytesToHex(encrypted);
}
```

## Frontend Implementation

### Client-Side Decryption

The React frontend decrypts data in the browser using the same algorithms:

```javascript
// frontend/src/utils/crypto.js
export const decryptWaterLevel = (encryptedHex, key, algorithm = 'AUTO') => {
  if (algorithm === 'DES') {
    const decryptedString = DES_CRYPTO.desDecrypt(encryptedHex, key);
    return parseFloat(decryptedString);
  }
  
  if (algorithm === 'XOR') {
    // XOR decryption logic
    return decryptedXORValue;
  }
  
  // Auto-detection tries both algorithms
  // ...
};
```

### Algorithm Auto-Detection

The frontend can automatically detect the encryption algorithm:

```javascript
// Try DES first (more common for newer data)
const desResult = decryptWaterLevelDES(encryptedHex, key);
if (desResult !== null && desResult >= 0 && desResult <= 1000) {
  return { value: desResult, algorithm: 'DES', success: true };
}

// Fallback to XOR
const xorResult = decryptWaterLevelXOR(encryptedHex, key);
if (xorResult !== null && xorResult >= 0 && xorResult <= 1000) {
  return { value: xorResult, algorithm: 'XOR', success: true };
}
```

## Security Analysis

### Algorithm Comparison

| Algorithm | Key Size | Block Size | Security Level | Memory Usage | Speed |
|-----------|----------|------------|----------------|--------------|-------|
| **XOR**   | Variable | Stream     | Very Low       | Minimal      | Fast  |
| **DES**   | 56-bit   | 64-bit     | Broken         | ~1.2KB RAM   | Moderate |

### Security Considerations

#### DES Vulnerabilities:
1. **Small key space**: 2^56 keys can be brute-forced
2. **Known weaknesses**: Differential and linear cryptanalysis
3. **Short block size**: 64-bit blocks enable statistical attacks

#### XOR Vulnerabilities:
1. **Key reuse**: Same key reveals patterns
2. **No diffusion**: Single bit changes don't cascade
3. **Frequency analysis**: Character patterns detectable

### Educational Value

This implementation demonstrates:
- **Block cipher construction** (Feistel network)
- **Key scheduling** algorithms
- **Substitution-permutation** networks
- **Padding schemes** (PKCS#7)
- **Cryptographic engineering** for embedded systems

## Configuration and Usage

### ESP32 Setup

1. **Configure encryption** in `esp32/main.py`:
   ```python
   USE_ENCRYPTED_MODE = True
   ENCRYPTION_ALGORITHM = "DES"  # or "XOR"
   ENCRYPTION_KEY = "YourSharedKey"
   ```

2. **Upload DES module** to ESP32:
   ```bash
   # Copy des_crypto.py to ESP32
   ampy put esp32/des_crypto.py
   ```

### Server Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   ESP32_API_KEY=your_api_key
   ```

### Frontend Setup

1. **Configure encryption key** in dashboard
2. **Select algorithm**: AUTO, DES, or XOR
3. **View decrypted data** in real-time

## Troubleshooting

### Common Issues

1. **Key mismatch**: Ensure all components use identical keys
2. **Algorithm mismatch**: Check ESP32 vs frontend algorithm settings
3. **Memory issues**: Use XOR on memory-constrained ESP32 devices
4. **Padding errors**: Verify PKCS#7 implementation consistency

### Debug Output

Enable debug output to view encryption process:

```python
# ESP32 debug
SHOW_ENCRYPTION_DEBUG = True

# Output example:
# 🔐 ENKRIPSI (DES): 12.5 cm → A3B2C1D4E5F60708
# 🔑 Kunci: MySecretKey123
```

## Performance Metrics

### ESP32 Performance
- **DES encryption**: ~50ms per measurement
- **XOR encryption**: ~5ms per measurement  
- **Memory usage**: DES ~1.2KB, XOR ~0.1KB
- **Power consumption**: Minimal impact on battery life

### Network Efficiency
- **Encrypted data size**: 16-32 hex characters
- **Bandwidth usage**: ~100 bytes per transmission
- **Transmission frequency**: Configurable (default 4 seconds)

## Conclusion

This educational cryptography implementation provides hands-on experience with:
- **Symmetric encryption** algorithms
- **Embedded cryptography** challenges
- **End-to-end encryption** architecture
- **Key management** considerations

While not suitable for production due to the use of broken algorithms, it effectively demonstrates cryptographic principles and the challenges of implementing security in IoT systems.

For production systems, consider:
- **AES-256** for symmetric encryption
- **ChaCha20-Poly1305** for authenticated encryption
- **TLS/HTTPS** for transport security
- **Hardware security modules** for key storage
- **Certificate-based authentication** for device identity

## Further Reading

- [DES Algorithm Specification (FIPS 46-3)](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)
- [Cryptographic Engineering](https://www.schneier.com/books/applied_cryptography/) by Bruce Schneier
- [ESP32 Cryptography Libraries](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/protocols/esp_crypto.html)
- [Modern Cryptography Best Practices](https://owasp.org/www-project-cryptographic-storage-cheat-sheet/) 