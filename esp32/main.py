import network
import urequests
import ujson
import time
import machine
from machine import Pin, Timer

# Import DES crypto module for educational cryptography
try:
    from des_crypto import des_encrypt, test_des_esp32
    DES_AVAILABLE = True
    print("✅ DES crypto module loaded successfully")
except ImportError:
    DES_AVAILABLE = False
    print("⚠️ DES crypto module not found, falling back to XOR")


# --- Konfigurasi Pengguna ---
WIFI_SSID = "1"  # Ganti dengan nama WiFi Anda
WIFI_PASSWORD = "1"  # Ganti dengan kata sandi WiFi Anda
# SERVER_URL harus menunjuk ke direktori /api di server Anda
SERVER_URL = "https://example.com/api"
API_KEY = "1"  # Ganti dengan API Key Anda

# Tinggi tangki dalam cm (dari dasar sensor ke dasar tangki jika sensor di atas)
# atau ketinggian air maksimum yang bisa diukur sensor dari posisinya.
TANK_HEIGHT_CM = 10  # Ganti dengan tinggi tangki Anda

# --- TAMBAHAN: Konfigurasi Mode Otomatis Lokal ---
# Persentase ketinggian air (dalam format desimal 0.01 - 1.00) di mana pompa akan otomatis MATI
# oleh ESP32 jika mode otomatis di server aktif.
# Contoh: 0.80 artinya pompa akan mati jika tangki terisi 80%.
LOCAL_AUTO_OFF_THRESHOLD_PERCENT = 0.50
# Pompa akan NYALA jika level air di bawah atau sama dengan persentase ini.
LOCAL_AUTO_ON_THRESHOLD_PERCENT = 0.20   # Contoh: Nyala pada 20%

# Timeout untuk permintaan ke server (dalam milidetik)
# Jika server tidak merespons dalam waktu ini, permintaan akan dibatalkan.
REQUEST_TIMEOUT_MS = 3000  # Atur di sini (misal: 3000ms = 3 detik)

# --- KONFIGURASI MODE ENKRIPSI (PENDIDIKAN KRIPTOGRAFI) ---
# Set ke True untuk mengaktifkan mode enkripsi data
USE_ENCRYPTED_MODE = True  # Ubah ke True untuk mode terenkripsi

# Pilihan algoritma enkripsi ('XOR' atau 'DES')
# DES: Data Encryption Standard - Lebih aman tetapi butuh memori lebih besar
# XOR: Simple XOR cipher - Ringan tetapi tidak aman untuk produksi
ENCRYPTION_ALGORITHM = "DES"  # Pilihan: "XOR" atau "DES"

# Kunci enkripsi - HARUS SAMA dengan yang digunakan di web interface
ENCRYPTION_KEY = "MySecretKey123"  # Ganti dengan kunci pilihan Anda
# Tampilkan debug enkripsi (nilai asli vs terenkripsi)
SHOW_ENCRYPTION_DEBUG = True  # Set False untuk mengurangi output

# Definisi Pin GPIO
TRIGGER_PIN_NUMBER = 5
ECHO_PIN_NUMBER = 18
PUMP_PIN_NUMBER = 23 # Pin yang terhubung ke input (IN) relay

# Interval waktu (dalam milidetik)
DATA_SEND_INTERVAL_MS = 4000  # Kirim data ketinggian air setiap X detik
STATUS_CHECK_INTERVAL_MS = 4000  # Periksa status pompa setiap X detik
SENSOR_READ_RETRY_DELAY_MS = 200 # Jeda antar pembacaan sensor jika terjadi error
RECONNECT_WIFI_DELAY_MS = 2000 # Jeda sebelum mencoba menyambung ulang WiFi

# --- Inisialisasi Perangkat Keras ---
trigger_pin = Pin(TRIGGER_PIN_NUMBER, Pin.OUT)
echo_pin = Pin(ECHO_PIN_NUMBER, Pin.IN)
pump_relay_pin = Pin(PUMP_PIN_NUMBER, Pin.OUT)

# Pastikan pompa mati saat program dimulai
# Asumsi relay active-HIGH: LOW berarti mati, HIGH berarti nyala.
# Jika relay Anda active-LOW, balikkan logikanya ( pump_relay_pin.value(1) untuk mati)
pump_relay_pin.value(0)
print("Pompa diinisialisasi ke OFF.")

# --- Koneksi WiFi ---
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        print(f"Menyambungkan ke WiFi {WIFI_SSID}...")
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)

        max_wait = 15 # Tunggu maksimal 15 detik
        while max_wait > 0:
            if wlan.isconnected():
                break
            max_wait -= 1
            print(".")
            time.sleep(1)

    if wlan.isconnected():
        print("Terhubung ke WiFi!")
        print(f"Alamat IP: {wlan.ifconfig()[0]}")
        return True
    else:
        print("Gagal terhubung ke WiFi.")
        return False

# --- Pembacaan Sensor Ultrasonik HC-SR04 ---
def measure_raw_distance_cm():
    """
    Mengukur jarak mentah menggunakan sensor HC-SR04.
    Mengembalikan jarak dalam cm, atau kode error negatif.
    -1: Timeout menunggu echo HIGH
    -2: Timeout menunggu echo LOW
    -3: Pembacaan di luar jangkauan sensor (terlalu dekat atau terlalu jauh)
    """
    trigger_pin.value(0)
    time.sleep_us(5) # Penundaan yang lebih aman

    # Kirim pulsa 10us untuk memicu sensor
    trigger_pin.value(1)
    time.sleep_us(10)
    trigger_pin.value(0)

    # Tunggu echo pin menjadi HIGH (awal gema)
    timeout_start_echo = time.ticks_us()
    pulse_start_time = 0 # Inisialisasi
    while echo_pin.value() == 0:
        pulse_start_time = time.ticks_us()
        if time.ticks_diff(pulse_start_time, timeout_start_echo) > 30000:  # Timeout 30ms
            return -1

    # Tunggu echo pin kembali menjadi LOW (akhir gema)
    timeout_end_echo = time.ticks_us()
    pulse_end_time = 0 # Inisialisasi
    while echo_pin.value() == 1:
        pulse_end_time = time.ticks_us()
        if time.ticks_diff(pulse_end_time, timeout_end_echo) > 30000:  # Timeout 30ms
            return -2

    if pulse_start_time == 0 or pulse_end_time == 0:
        return -1

    pulse_duration = time.ticks_diff(pulse_end_time, pulse_start_time)
    distance_cm = (pulse_duration * 0.0343) / 2

    if distance_cm < 2 or distance_cm > 400:
        return -3
    return distance_cm

def read_water_level_cm():
    """
    Membaca ketinggian air dari sensor ultrasonik.
    Mengambil beberapa sampel dan mengembalikan rata-rata jika valid.
    Mengembalikan -1 jika pembacaan gagal secara konsisten.
    """
    valid_readings = []
    for _ in range(5): # Ambil 5 sampel
        dist = measure_raw_distance_cm()
        if dist >= 0: # Hanya jika pembacaan valid
            valid_readings.append(dist)
        time.sleep_ms(60)

    if not valid_readings:
        print("Gagal mendapatkan pembacaan sensor yang valid.")
        return -1

    avg_distance_cm = sum(valid_readings) / len(valid_readings)
    water_level = TANK_HEIGHT_CM - avg_distance_cm

    if water_level < 0:
        water_level = 0
    elif water_level > TANK_HEIGHT_CM:
        water_level = TANK_HEIGHT_CM

    # Hapus print di sini agar tidak terlalu ramai di log utama
    # print(f"Jarak terukur (rata-rata): {avg_distance_cm:.2f} cm, Ketinggian Air: {water_level:.2f} cm")
    return water_level

# --- Enkripsi untuk Pendidikan Kriptografi ---
def encrypt_water_level_xor(level, key):
    """
    Mengenkripsi nilai ketinggian air menggunakan XOR cipher sederhana.
    Hanya untuk tujuan pendidikan - JANGAN gunakan untuk produksi!
    
    Args:
        level (float): Ketinggian air dalam cm
        key (str): Kunci enkripsi (string)
    
    Returns:
        str: Data terenkripsi dalam format hex (huruf besar)
    """
    try:
        # Konversi ke string dengan 1 angka desimal
        data_str = "{:.1f}".format(level)
        result = ""
        
        # Enkripsi setiap karakter dengan XOR
        for i, char in enumerate(data_str):
            data_byte = ord(char)  # Konversi karakter ke nilai ASCII
            key_byte = ord(key[i % len(key)])  # Ulangi kunci jika lebih pendek dari data
            encrypted_byte = data_byte ^ key_byte  # Operasi XOR
            
            # Konversi ke hex (2 karakter per byte)
            result += "{:02X}".format(encrypted_byte)
        
        return result
    except Exception as e:
        print(f"Error dalam enkripsi XOR: {e}")
        return None

def encrypt_water_level_des(level, key):
    """
    Mengenkripsi nilai ketinggian air menggunakan DES encryption.
    Implementasi pendidikan - untuk produksi gunakan algoritma modern seperti AES!
    
    Args:
        level (float): Ketinggian air dalam cm
        key (str): Kunci enkripsi (string)
    
    Returns:
        str: Data terenkripsi dalam format hex (huruf besar)
    """
    try:
        # Konversi ke string dengan 1 angka desimal
        data_str = "{:.1f}".format(level)
        
        # Gunakan DES encryption
        encrypted_hex = des_encrypt(data_str, key)
        return encrypted_hex
    except Exception as e:
        print(f"Error dalam enkripsi DES: {e}")
        return None

def encrypt_water_level(level, key):
    """
    Mengenkripsi nilai ketinggian air dengan algoritma yang dipilih.
    
    Args:
        level (float): Ketinggian air dalam cm
        key (str): Kunci enkripsi (string)
    
    Returns:
        str: Data terenkripsi dalam format hex (huruf besar)
    """
    if ENCRYPTION_ALGORITHM == "DES" and DES_AVAILABLE:
        return encrypt_water_level_des(level, key)
    else:
        # Fallback ke XOR jika DES tidak tersedia atau dipilih XOR
        if ENCRYPTION_ALGORITHM == "DES" and not DES_AVAILABLE:
            print("⚠️ DES tidak tersedia, menggunakan XOR sebagai fallback")
        return encrypt_water_level_xor(level, key)

# --- Kontrol Pompa ---
def control_pump(turn_on):
    """
    Mengontrol relay pompa. turn_on: True untuk menyalakan, False untuk mematikan.
    Menggunakan logika ACTIVE-LOW sesuai dengan hardware yang umum.
    """
    target_state = 1 if turn_on else 0

    # Cek status pin saat ini untuk menghindari penulisan yang tidak perlu
    if pump_relay_pin.value() != target_state:
        pump_relay_pin.value(target_state)
        print(f"POMPA: Status diubah menjadi -> {'DINYALAKAN' if turn_on else 'DIMATIKAN'}")
    # else:
    #     print(f"POMPA: Sudah dalam kondisi {'ON' if turn_on else 'OFF'}")

# --- BARU: Logika Pengambilan Keputusan ---
def handle_server_response(pump_on_from_server, auto_mode_from_server):
    """
    Fungsi ini memutuskan tindakan pompa berdasarkan respons dari server.
    - Jika auto_mode True, ESP32 menjalankan kontrol histeresis lokal (ON/OFF otomatis).
    - Jika auto_mode False, ESP32 mengikuti perintah pump_on dari server (mode manual).
    """
    print(f"Server state: pump_on={pump_on_from_server}, auto_mode={auto_mode_from_server}")

    if auto_mode_from_server:
        # --- LOGIKA OTOMATIS LOKAL (HISTERESIS) AKTIF ---
        print(f"-> Mode Otomatis LOKAL aktif. Logika: ON <= {LOCAL_AUTO_ON_THRESHOLD_PERCENT*100:.0f}%, OFF >= {LOCAL_AUTO_OFF_THRESHOLD_PERCENT*100:.0f}%")

        # Baca ketinggian air saat ini untuk membuat keputusan
        current_level = read_water_level_cm()
        if current_level < 0:
            print("   [Peringatan] Gagal membaca sensor, tidak dapat menjalankan logika otomatis lokal. Tidak ada perubahan status pompa.")
            return # Jangan lakukan apa-apa jika sensor gagal

        print(f"   Level air saat ini: {current_level:.2f} cm")

        # Hitung ambang batas dalam CM
        on_threshold_cm = TANK_HEIGHT_CM * LOCAL_AUTO_ON_THRESHOLD_PERCENT
        off_threshold_cm = TANK_HEIGHT_CM * LOCAL_AUTO_OFF_THRESHOLD_PERCENT

        # Implementasi Logika Histeresis
        if current_level <= on_threshold_cm:
            # Jika level air rendah, nyalakan pompa
            print(f"   Level ({current_level:.2f}cm) di bawah atau sama dengan ambang batas ON ({on_threshold_cm:.2f}cm). Menyalakan pompa.")
            control_pump(True)
        elif current_level >= off_threshold_cm:
            # Jika level air tinggi, matikan pompa
            print(f"   Level ({current_level:.2f}cm) di atas atau sama dengan ambang batas OFF ({off_threshold_cm:.2f}cm). Mematikan pompa.")
            control_pump(False)
        else:
            # Jika level air berada di antara dua ambang batas, JANGAN UBAH STATUS POMPA.
            # Ini adalah "zona mati" yang mencegah pompa bergetar (cycling).
            print(f"   Level ({current_level:.2f}cm) di antara ambang batas. Status pompa dipertahankan.")

    else:
        # --- LOGIKA MANUAL (MENGIKUTI PERINTAH SERVER) ---
        print("-> Mode Manual aktif. Mengikuti status pompa dari server.")
        control_pump(pump_on_from_server)

# --- Komunikasi Server ---
def send_water_level_to_server():
    water_level = read_water_level_cm()
    if water_level < 0:
        print("Gagal mengirim data: tidak dapat membaca ketinggian air.")
        handle_server_or_sensor_error(is_server_error=False)
        return

    print(f"Ketinggian Air Terukur: {water_level:.2f} cm")
    headers = {'Content-Type': 'application/json', 'X-API-KEY': API_KEY}
    data_payload = {'level_cm': water_level}
    url = f"{SERVER_URL}/data"
    print(f"Mengirim data ke {url}: {data_payload}")

    try:
        timeout_sec = REQUEST_TIMEOUT_MS / 1000
        response = urequests.post(url, headers=headers, json=data_payload, timeout=timeout_sec)
        
        if response.status_code == 200:
            response_data = response.json()
            # Ekstrak data dari server
            pump_on = response_data.get('pump_on', False)
            auto_mode = response_data.get('auto_mode', True)
            # Serahkan keputusan ke handler
            handle_server_response(pump_on, auto_mode)
        else:
            print(f"Error mengirim data: HTTP {response.status_code} - {response.text}")
            handle_server_or_sensor_error(is_server_error=True)
        response.close()
    except Exception as e:
        print(f"Pengecualian saat mengirim data: {e}")
        handle_server_or_sensor_error(is_server_error=True)

def send_encrypted_water_level_to_server():
    """
    Mengirim data ketinggian air yang telah dienkripsi ke server.
    Fungsi ini identik dengan send_water_level_to_server() tetapi mengirim data terenkripsi.
    """
    water_level = read_water_level_cm()
    if water_level < 0:
        print("Gagal mengirim data terenkripsi: tidak dapat membaca ketinggian air.")
        handle_server_or_sensor_error(is_server_error=False)
        return

    # Enkripsi ketinggian air
    encrypted_level = encrypt_water_level(water_level, ENCRYPTION_KEY)
    if encrypted_level is None:
        print("Gagal mengenkripsi data ketinggian air.")
        handle_server_or_sensor_error(is_server_error=False)
        return

    if SHOW_ENCRYPTION_DEBUG:
        algorithm_used = ENCRYPTION_ALGORITHM if DES_AVAILABLE or ENCRYPTION_ALGORITHM == "XOR" else "XOR (fallback)"
        print(f"🔐 ENKRIPSI ({algorithm_used}): {water_level:.2f} cm → {encrypted_level}")
        print(f"🔑 Kunci: {ENCRYPTION_KEY}")

    print(f"Ketinggian Air Terukur: {water_level:.2f} cm (MODE TERENKRIPSI - {ENCRYPTION_ALGORITHM})")
    headers = {'Content-Type': 'application/json', 'X-API-KEY': API_KEY}
    data_payload = {'encrypted_level': encrypted_level}  # Kirim data terenkripsi
    url = f"{SERVER_URL}/encrypted-data"  # Endpoint khusus untuk data terenkripsi
    print(f"Mengirim data terenkripsi ke {url}: {data_payload}")

    try:
        timeout_sec = REQUEST_TIMEOUT_MS / 1000
        response = urequests.post(url, headers=headers, json=data_payload, timeout=timeout_sec)
        
        if response.status_code == 200:
            response_data = response.json()
            # Ekstrak data dari server (sama seperti mode biasa)
            pump_on = response_data.get('pump_on', False)
            auto_mode = response_data.get('auto_mode', True)
            # Serahkan keputusan ke handler
            handle_server_response(pump_on, auto_mode)
        else:
            print(f"Error mengirim data terenkripsi: HTTP {response.status_code} - {response.text}")
            handle_server_or_sensor_error(is_server_error=True)
        response.close()
    except Exception as e:
        print(f"Pengecualian saat mengirim data terenkripsi: {e}")
        handle_server_or_sensor_error(is_server_error=True)

def check_pump_status_from_server():
    headers = {'X-API-KEY': API_KEY}
    url = f"{SERVER_URL}/status"
    print(f"Memeriksa status pompa dari {url}")

    try:
        timeout_sec = REQUEST_TIMEOUT_MS / 1000
        response = urequests.get(url, headers=headers, timeout=timeout_sec)

        if response.status_code == 200:
            response_data = response.json()
            # Ekstrak data dari server
            pump_on = response_data.get('pump_on', False)
            auto_mode = response_data.get('auto_mode', True)
            # Serahkan keputusan ke handler
            handle_server_response(pump_on, auto_mode)
        else:
            print(f"Error memeriksa status: HTTP {response.status_code} - {response.text}")
            handle_server_or_sensor_error(is_server_error=True)
        response.close()
    except Exception as e:
        print(f"Pengecualian saat memeriksa status: {e}")
        handle_server_or_sensor_error(is_server_error=True)

# --- Logika Fallback jika Server Error atau Sensor Error ---
def handle_server_or_sensor_error(is_server_error):
    """
    Logika fallback sederhana jika server tidak dapat dijangkau atau sensor gagal.
    """
    print("Menjalankan logika fallback...")
    current_level = read_water_level_cm()

    if current_level >= 0:
        if current_level < (TANK_HEIGHT_CM * 0.1):
            print("FALLBACK: Ketinggian air kritis RENDAH. Menyalakan pompa.")
            control_pump(True)
        elif current_level > (TANK_HEIGHT_CM * 0.9):
            print("FALLBACK: Ketinggian air kritis TINGGI. Mematikan pompa.")
            control_pump(False)
        else:
            print("FALLBACK: Ketinggian air tidak kritis. Tidak ada perubahan status pompa.")
    elif is_server_error:
        print("FALLBACK: Sensor GAGAL dan Server Error. Mematikan pompa untuk keamanan.")
        control_pump(False)
    else:
        print("FALLBACK: Sensor GAGAL. Tidak dapat membuat keputusan berdasarkan level air.")


# --- Timer Callbacks ---
send_data_flag = False
check_status_flag = False

def data_timer_callback(timer):
    global send_data_flag
    send_data_flag = True

def status_timer_callback(timer):
    global check_status_flag
    check_status_flag = True

# --- Fungsi Utama ---
def main():
    global send_data_flag, check_status_flag

    if not connect_wifi():
        print("Tidak dapat terhubung ke WiFi. Memulai ulang dalam 10 detik...")
        time.sleep(10)
        machine.reset()

    # Tampilkan mode operasi saat startup
    if USE_ENCRYPTED_MODE:
        algorithm_used = ENCRYPTION_ALGORITHM if (ENCRYPTION_ALGORITHM == "XOR" or DES_AVAILABLE) else "XOR (fallback)"
        mode_message = f"MODE TERENKRIPSI ({algorithm_used})"
        print(f"\n🚀 STARTUP: {mode_message}")
        print(f"🔑 Kunci Enkripsi: {ENCRYPTION_KEY}")
        print(f"🔐 Algoritma: {algorithm_used}")
        
        # Test DES jika digunakan
        if ENCRYPTION_ALGORITHM == "DES" and DES_AVAILABLE:
            print("🧪 Testing DES implementation...")
            if test_des_esp32():
                print("✅ DES test berhasil!")
            else:
                print("❌ DES test gagal, fallback ke XOR")
                ENCRYPTION_ALGORITHM = "XOR"
        
        print("🔐 Data akan dikirim dalam format terenkripsi")
    else:
        mode_message = "MODE BIASA"
        print(f"\n🚀 STARTUP: {mode_message}")
    print("")

    print("Mengirim data & status awal...")
    # Pilih mode pengiriman data berdasarkan konfigurasi
    if USE_ENCRYPTED_MODE:
        send_encrypted_water_level_to_server()
    else:
        send_water_level_to_server()

    # Inisialisasi Timer
    data_timer = Timer(0)
    data_timer.init(period=DATA_SEND_INTERVAL_MS, mode=Timer.PERIODIC, callback=data_timer_callback)
    status_timer = Timer(1)
    status_timer.init(period=STATUS_CHECK_INTERVAL_MS, mode=Timer.PERIODIC, callback=status_timer_callback)

    print("\nSistem Monitor Tangki Air IoT berjalan...")
    if USE_ENCRYPTED_MODE:
        algorithm_display = ENCRYPTION_ALGORITHM if (ENCRYPTION_ALGORITHM == "XOR" or DES_AVAILABLE) else "XOR (fallback)"
        print(f"Mode Operasi: TERENKRIPSI ({algorithm_display})")
    else:
        print("Mode Operasi: BIASA")
    print(f"Data akan dikirim setiap {DATA_SEND_INTERVAL_MS / 1000} detik.")
    print(f"Status akan diperiksa setiap {STATUS_CHECK_INTERVAL_MS / 1000} detik.")
    print("-" * 40)


    while True:
        if not network.WLAN(network.STA_IF).isconnected():
            print("Koneksi WiFi terputus. Mencoba menyambung ulang...")
            connect_wifi()
            if not network.WLAN(network.STA_IF).isconnected():
                print("Gagal menyambung ulang WiFi. Menunggu sebelum mencoba lagi...")
                time.sleep(RECONNECT_WIFI_DELAY_MS)
                continue

        if send_data_flag:
            send_data_flag = False
            # Pilih mode pengiriman data berdasarkan konfigurasi
            if USE_ENCRYPTED_MODE:
                algorithm_display = ENCRYPTION_ALGORITHM if (ENCRYPTION_ALGORITHM == "XOR" or DES_AVAILABLE) else "XOR (fallback)"
                print(f"\n[TIMER] Waktunya mengirim data ketinggian air ({algorithm_display})...")
                send_encrypted_water_level_to_server()
            else:
                print("\n[TIMER] Waktunya mengirim data ketinggian air...")
                send_water_level_to_server()
            print("-" * 20)


        if check_status_flag:
            check_status_flag = False
            print("\n[TIMER] Waktunya memeriksa status pompa...")
            check_pump_status_from_server()
            print("-" * 20)

        time.sleep_ms(100)

# --- Jalankan Aplikasi ---
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Terjadi error kritis: {e}")
        print("Memulai ulang perangkat dalam 10 detik...")
        time.sleep(10)
        machine.reset()