# Panduan Enkripsi Data Ketinggian Air

## Gambaran Umum

Sistem IoT Tangki Air ini mengimplementasikan kriptografi edukatif untuk melindungi data sensor ketinggian air saat berjalanan dari perangkat ESP32 ke server web. Sistem ini mendukung dua algoritma enkripsi:

- **XOR Cipher**: Enkripsi sederhana dan ringan yang cocok untuk perangkat dengan sumber daya terbatas
- **DES (Data Encryption Standard)**: Block cipher yang lebih canggih dengan kunci 56-bit

> **⚠️ CATATAN KEAMANAN PENTING**: Implementasi ini dirancang untuk **tujuan edukasi saja**. DES telah dibobol secara kriptografis sejak akhir 1990-an dan tidak boleh digunakan dalam sistem produksi. Aplikasi modern harus menggunakan AES atau algoritma kontemporer lainnya.

## Arsitektur Sistem

```
Perangkat ESP32                 Server Web                    Frontend
┌─────────────┐                ┌─────────────┐               ┌─────────────┐
│ Sensor      │  Data          │   Node.js   │   Data        │  Aplikasi   │
│ Ketinggian  │  Terenkripsi   │    API      │  Terenkripsi  │   React     │
│ Air         │ ──────────────>│             │ ──────────────>│  Dashboard  │
│ Enkripsi    │     HTTPS      │ Dekripsi    │     HTTPS     │  Dekripsi   │
│ DES/XOR     │                │ DES/XOR     │               │  DES/XOR    │
└─────────────┘                └─────────────┘               └─────────────┘
```

## Alur Data

1. **ESP32 membaca ketinggian air** (contoh: `12.5` cm)
2. **ESP32 mengenkripsi data** menggunakan DES atau XOR dengan kunci bersama
3. **ESP32 mengirim hex terenkripsi** ke server via HTTPS POST
4. **Server menyimpan data terenkripsi** di database tanpa dekripsi
5. **Frontend meminta data** dari server
6. **Server mengembalikan data terenkripsi** ke frontend
7. **Frontend mendekripsi data** di sisi klien untuk ditampilkan

## Implementasi ESP32

### Konfigurasi

Kode ESP32 mendukung enkripsi yang dapat dikonfigurasi:

```python
# Pengaturan enkripsi dalam main.py
USE_ENCRYPTED_MODE = True           # Aktifkan/nonaktifkan enkripsi
ENCRYPTION_ALGORITHM = "DES"        # "DES" atau "XOR"
ENCRYPTION_KEY = "MySecretKey123"   # Kunci rahasia bersama
```

### Enkripsi DES pada ESP32

ESP32 menggunakan implementasi DES yang dioptimalkan untuk memori (`esp32/des_crypto.py`):

```python
def encrypt_water_level_des(level, key):
    """
    Mengenkripsi ketinggian air menggunakan enkripsi DES
    
    Input:  12.5 (float)
    Output: "A3B2C1D4E5F60708" (string hex)
    """
    # Konversi float ke string dengan 1 tempat desimal
    data_str = "{:.1f}".format(level)  # "12.5"
    
    # Gunakan enkripsi DES dengan padding PKCS#7
    encrypted_hex = des_encrypt(data_str, key)
    return encrypted_hex
```

### Enkripsi XOR pada ESP32 (Fallback)

Untuk perangkat dengan memori terbatas, enkripsi XOR menyediakan alternatif yang ringan:

```python
def encrypt_water_level_xor(level, key):
    """
    Enkripsi XOR sederhana untuk operasi ringan
    
    Input:  12.5 (float)
    Output: "1A2B3C4D" (string hex)
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

### Transmisi Data

ESP32 mengirim data terenkripsi ke server:

```python
def send_encrypted_water_level_to_server():
    water_level = read_water_level_cm()           # 12.5
    encrypted_level = encrypt_water_level(water_level, ENCRYPTION_KEY)  # "A3B2C1D4E5F60708"
    
    data_payload = {'encrypted_level': encrypted_level}
    response = urequests.post(f"{SERVER_URL}/encrypted-data", 
                            headers=headers, json=data_payload)
```

## Implementasi Algoritma DES

### Komponen Inti DES

Implementasi DES mencakup semua komponen standar:

#### 1. **Initial Permutation (IP)**
Mengatur ulang blok input 64-bit sesuai tabel tetap:
```python
IP = [58, 50, 42, 34, 26, 18, 10, 2, ...]  # 64 posisi
```

#### 2. **Penjadwalan Kunci (Key Schedule)**
Menghasilkan 16 kunci putaran dari kunci master 64-bit:
- **PC1**: Mengurangi kunci 64-bit menjadi 56-bit (menghapus bit paritas)
- **PC2**: Membuat kunci putaran 48-bit dari bagian yang diputar 56-bit
- **Shifts**: Jadwal rotasi kiri `[1, 1, 2, 2, 2, 2, ...]`

#### 3. **Struktur Feistel (16 putaran)**
Setiap putaran menerapkan fungsi-F:
- **Expansion (E)**: Memperluas setengah 32-bit menjadi 48 bit
- **Key Mixing**: XOR dengan kunci putaran
- **S-Boxes**: 8 kotak substitusi mengurangi 48 bit menjadi 32 bit
- **Permutation (P)**: Pengaturan ulang bit terakhir

#### 4. **S-Boxes (Kotak Substitusi)**
8 tabel lookup yang menyediakan non-linearitas:
```python
# Contoh S-Box 1 (beberapa entri pertama)
S_BOXES[0] = [14, 4, 13, 1, 2, 15, 11, 8, ...]
```

#### 5. **Final Permutation (FP)**
Kebalikan dari permutasi awal.

### Optimasi Memori untuk ESP32

Implementasi ESP32 dioptimalkan untuk mikrokontroler:

- **Operasi 64-bit**: Disimulasikan menggunakan dua integer 32-bit
- **Tabel lookup**: Disimpan di ROM untuk menghemat RAM (~1.2KB total penggunaan)
- **Pemrosesan blok**: Memproses data dalam potongan 8-byte
- **Padding PKCS#7**: Menangani input dengan panjang variabel

### Contoh Proses Enkripsi

```
Plaintext:    "12.5"
Padded:       "12.5\x04\x04\x04\x04"  (padding PKCS#7)
Key:          "MySecretKey123" → 8 bytes
Proses DES:   IP → 16 putaran Feistel → FP
Ciphertext:   [0xA3, 0xB2, 0xC1, 0xD4, 0xE5, 0xF6, 0x07, 0x08]
Output Hex:   "A3B2C1D4E5F60708"
```

## Implementasi Server

### Endpoint API

Server Node.js menyediakan endpoint terpisah untuk data terenkripsi:

```javascript
// Endpoint data reguler
POST /api/data
{
  "level_cm": 12.5
}

// Endpoint data terenkripsi
POST /api/encrypted-data
{
  "encrypted_level": "A3B2C1D4E5F60708"
}
```

### Penyimpanan Database

Server menyimpan data terenkripsi tanpa dekripsi:

```sql
-- Data sensor reguler
CREATE TABLE sensor_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level_cm DECIMAL(5,2),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data sensor terenkripsi
CREATE TABLE encrypted_sensor_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  encrypted_level VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Implementasi DES Sisi Server

Server menyertakan implementasi DES JavaScript (`utils/des_crypto.js`) yang mencerminkan versi ESP32:

```javascript
// Fungsi enkripsi tingkat tinggi
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

## Implementasi Frontend

### Dekripsi Sisi Klien

Frontend React mendekripsi data di browser menggunakan algoritma yang sama:

```javascript
// frontend/src/utils/crypto.js
export const decryptWaterLevel = (encryptedHex, key, algorithm = 'AUTO') => {
  if (algorithm === 'DES') {
    const decryptedString = DES_CRYPTO.desDecrypt(encryptedHex, key);
    return parseFloat(decryptedString);
  }
  
  if (algorithm === 'XOR') {
    // Logika dekripsi XOR
    return decryptedXORValue;
  }
  
  // Auto-detection mencoba kedua algoritma
  // ...
};
```

### Deteksi Algoritma Otomatis

Frontend dapat secara otomatis mendeteksi algoritma enkripsi:

```javascript
// Coba DES dulu (lebih umum untuk data baru)
const desResult = decryptWaterLevelDES(encryptedHex, key);
if (desResult !== null && desResult >= 0 && desResult <= 1000) {
  return { value: desResult, algorithm: 'DES', success: true };
}

// Fallback ke XOR
const xorResult = decryptWaterLevelXOR(encryptedHex, key);
if (xorResult !== null && xorResult >= 0 && xorResult <= 1000) {
  return { value: xorResult, algorithm: 'XOR', success: true };
}
```

## Analisis Keamanan

### Perbandingan Algoritma

| Algoritma | Ukuran Kunci | Ukuran Blok | Tingkat Keamanan | Penggunaan Memori | Kecepatan |
|-----------|--------------|-------------|------------------|-------------------|-----------|
| **XOR**   | Variabel     | Stream      | Sangat Rendah    | Minimal           | Cepat     |
| **DES**   | 56-bit       | 64-bit      | Terpecah         | ~1.2KB RAM        | Sedang    |

### Pertimbangan Keamanan

#### Kerentanan DES:
1. **Ruang kunci kecil**: 2^56 kunci dapat di-brute force
2. **Kelemahan yang diketahui**: Analisis diferensial dan linear
3. **Ukuran blok pendek**: Blok 64-bit memungkinkan serangan statistik

#### Kerentanan XOR:
1. **Penggunaan kunci berulang**: Kunci yang sama mengungkap pola
2. **Tidak ada difusi**: Perubahan bit tunggal tidak menyebar
3. **Analisis frekuensi**: Pola karakter dapat dideteksi

### Nilai Edukatif

Implementasi ini mendemonstrasikan:
- **Konstruksi block cipher** (jaringan Feistel)
- **Algoritma penjadwalan kunci**
- **Jaringan substitusi-permutasi**
- **Skema padding** (PKCS#7)
- **Rekayasa kriptografi** untuk sistem tertanam

## Konfigurasi dan Penggunaan

### Setup ESP32

1. **Konfigurasi enkripsi** dalam `esp32/main.py`:
   ```python
   USE_ENCRYPTED_MODE = True
   ENCRYPTION_ALGORITHM = "DES"  # atau "XOR"
   ENCRYPTION_KEY = "KunciAnda"
   ```

2. **Upload modul DES** ke ESP32:
   ```bash
   # Salin des_crypto.py ke ESP32
   ampy put esp32/des_crypto.py
   ```

### Setup Server

1. **Install dependensi**:
   ```bash
   npm install
   ```

2. **Konfigurasi environment**:
   ```bash
   ESP32_API_KEY=api_key_anda
   ```

### Setup Frontend

1. **Konfigurasi kunci enkripsi** di dashboard
2. **Pilih algoritma**: AUTO, DES, atau XOR
3. **Lihat data terdekripsi** secara real-time

## Pemecahan Masalah

### Masalah Umum

1. **Ketidakcocokan kunci**: Pastikan semua komponen menggunakan kunci yang identik
2. **Ketidakcocokan algoritma**: Periksa pengaturan algoritma ESP32 vs frontend
3. **Masalah memori**: Gunakan XOR pada perangkat ESP32 dengan memori terbatas
4. **Error padding**: Verifikasi konsistensi implementasi PKCS#7

### Output Debug

Aktifkan output debug untuk melihat proses enkripsi:

```python
# Debug ESP32
SHOW_ENCRYPTION_DEBUG = True

# Contoh output:
# 🔐 ENKRIPSI (DES): 12.5 cm → A3B2C1D4E5F60708
# 🔑 Kunci: MySecretKey123
```

## Metrik Kinerja

### Kinerja ESP32
- **Enkripsi DES**: ~50ms per pengukuran
- **Enkripsi XOR**: ~5ms per pengukuran  
- **Penggunaan memori**: DES ~1.2KB, XOR ~0.1KB
- **Konsumsi daya**: Dampak minimal pada masa pakai baterai

### Efisiensi Jaringan
- **Ukuran data terenkripsi**: 16-32 karakter hex
- **Penggunaan bandwidth**: ~100 bytes per transmisi
- **Frekuensi transmisi**: Dapat dikonfigurasi (default 4 detik)

## Kesimpulan

Implementasi kriptografi edukatif ini memberikan pengalaman langsung dengan:
- **Algoritma enkripsi simetris**
- **Tantangan kriptografi tertanam**
- **Arsitektur enkripsi end-to-end**
- **Pertimbangan manajemen kunci**

Meskipun tidak cocok untuk produksi karena penggunaan algoritma yang sudah terpecah, ini secara efektif mendemonstrasikan prinsip kriptografi dan tantangan mengimplementasikan keamanan dalam sistem IoT.

Untuk sistem produksi, pertimbangkan:
- **AES-256** untuk enkripsi simetris
- **ChaCha20-Poly1305** untuk enkripsi terotentikasi
- **TLS/HTTPS** untuk keamanan transport
- **Modul keamanan perangkat keras** untuk penyimpanan kunci
- **Otentikasi berbasis sertifikat** untuk identitas perangkat

## Bacaan Lebih Lanjut

- [Spesifikasi Algoritma DES (FIPS 46-3)](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)
- [Cryptographic Engineering](https://www.schneier.com/books/applied_cryptography/) oleh Bruce Schneier
- [Pustaka Kriptografi ESP32](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/protocols/esp_crypto.html)
- [Praktik Terbaik Kriptografi Modern](https://owasp.org/www-project-cryptographic-storage-cheat-sheet/) 