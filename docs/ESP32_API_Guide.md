# ESP32 API Guide for IoT Water Tank

This document provides instructions for interfacing an ESP32 microcontroller with the IoT Water Tank monitoring system.

## API Overview

The IoT Water Tank system provides a RESTful API specifically designed for ESP32 devices to:

1. Send water level readings to the server (regular or encrypted mode)
2. Receive pump control commands
3. Query the current status of the pump

All ESP32 API endpoints require authentication using an API key.

## Encrypted Data Mode

The system supports an **Encrypted Data Mode** for educational cryptography purposes. In this mode:

- Water level data is encrypted before transmission
- Data is stored encrypted in a separate database table
- Simple XOR-based encryption is used for educational demonstration
- The web interface requires a decryption key to view the data

### Encryption Algorithm

We use a simple XOR cipher with key expansion for educational purposes:

1. **Key Expansion**: Repeat/truncate the key to match data length
2. **XOR Operation**: Each byte of data is XORed with corresponding key byte
3. **Hex Encoding**: Result is encoded as hexadecimal string for transmission

**Important**: This is for educational purposes only and should not be used in production systems.

## Authentication

Every request to the ESP32 API must include an API key in the header:

```
X-API-KEY: your-api-key-here
```

The API key is configured in the server's `.env` file as `ESP32_API_KEY`. Requests without a valid API key will receive a 401 Unauthorized response.

## API Endpoints

### 1. Send Water Level Data

**Endpoint:** `POST /api/data`

**Description:** Send the current water level measurement to the server.

**Request Headers:**
- `Content-Type: application/json`
- `X-API-KEY: your-api-key-here`

**Request Body:**
```json
{
  "level_cm": 75.5
}
```

**Response:**
```json
{
  "pump_on": true,
  "auto_mode": false
}
```

**Response Fields:**
- `pump_on`: Boolean indicating if the pump should be turned on (true) or off (false)
- `auto_mode`: Boolean indicating if the system is in automatic mode

### 1b. Send Encrypted Water Level Data

**Endpoint:** `POST /api/encrypted-data`

**Description:** Send encrypted water level measurement to the server for cryptography demonstration.

**Request Headers:**
- `Content-Type: application/json`
- `X-API-KEY: your-api-key-here`

**Request Body:**
```json
{
  "encrypted_level": "4D5E2F1A3B4C"
}
```

**Response:**
```json
{
  "pump_on": true,
  "auto_mode": false
}
```

**Encryption Implementation:**

```cpp
// Simple XOR encryption for educational purposes
String encryptWaterLevel(float level, String key) {
  String dataStr = String(level, 1); // Convert to string with 1 decimal place
  String result = "";
  
  for (int i = 0; i < dataStr.length(); i++) {
    char dataChar = dataStr.charAt(i);
    char keyChar = key.charAt(i % key.length()); // Repeat key if shorter than data
    char encrypted = dataChar ^ keyChar;
    
    // Convert to hex (2 characters per byte)
    if (encrypted < 16) {
      result += "0";
    }
    result += String(encrypted, HEX);
  }
  
  result.toUpperCase(); // Convert to uppercase hex
  return result;
}

// Usage in your main loop:
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    float waterLevel = readWaterLevelSensor();
    
    // For encrypted mode, encrypt the water level
    String encryptionKey = "MySecretKey123"; // Use your chosen key
    String encryptedLevel = encryptWaterLevel(waterLevel, encryptionKey);
    
    // Send encrypted data
    HTTPClient http;
    http.begin("http://your-server-ip:3000/api/encrypted-data");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-KEY", apiKey);
    
    // Prepare JSON payload with encrypted data
    DynamicJsonDocument doc(200);
    doc["encrypted_level"] = encryptedLevel;
    String requestBody;
    serializeJson(doc, requestBody);
    
    // Send POST request
    int httpResponseCode = http.POST(requestBody);
    
    // Handle response same as regular mode...
    
    http.end();
    delay(30000); // 30 seconds
  }
}
```

**MicroPython Implementation:**

```python
def encrypt_water_level(level, key):
    """Simple XOR encryption for educational purposes"""
    data_str = "{:.1f}".format(level)  # Convert to string with 1 decimal
    result = ""
    
    for i, char in enumerate(data_str):
        data_byte = ord(char)
        key_byte = ord(key[i % len(key)])  # Repeat key if shorter
        encrypted_byte = data_byte ^ key_byte
        
        # Convert to hex (2 characters per byte)
        result += "{:02X}".format(encrypted_byte)
    
    return result

def send_encrypted_water_level():
    """Send encrypted water level to server"""
    try:
        water_level = read_water_level()
        encryption_key = "MySecretKey123"  # Use your chosen key
        encrypted_level = encrypt_water_level(water_level, encryption_key)
        
        headers = {
            'Content-Type': 'application/json',
            'X-API-KEY': API_KEY
        }
        
        data = {
            'encrypted_level': encrypted_level
        }
        
        response = urequests.post(
            SERVER_URL + "/encrypted-data", 
            headers=headers,
            json=data
        )
        
        if response.status_code == 200:
            response_data = response.json()
            pump_on = response_data.get('pump_on', False)
            auto_mode = response_data.get('auto_mode', True)
            
            control_pump(pump_on)
            
            print("Encrypted data sent successfully")
            print("Original level:", water_level, "cm")
            print("Encrypted:", encrypted_level)
        else:
            print("Error sending encrypted data:", response.status_code)
            
        response.close()
    except Exception as e:
        print("Exception in send_encrypted_water_level:", e)
```

**Key Selection Guidelines:**
- Use alphanumeric characters for simplicity
- Key should be 8-16 characters long
- Remember the key - you'll need it to decrypt data on the web interface
- Example keys: "MySecretKey123", "CryptoDemo456", "WaterTank2024"

### 2. Check Pump Status

**Endpoint:** `GET /api/status`

**Description:** Get the current status of the pump without sending water level data.

**Request Headers:**
- `X-API-KEY: your-api-key-here`

**Response:**
```json
{
  "pump_on": false,
  "auto_mode": true
}
```

**Example (Arduino/ESP32):**
```cpp
void checkPumpStatus() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin("http://your-server-ip:3000/api/status");
    http.addHeader("X-API-KEY", apiKey);
    
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      
      DynamicJsonDocument doc(200);
      deserializeJson(doc, response);
      
      bool pumpOn = doc["pump_on"];
      bool autoMode = doc["auto_mode"];
      
      // Update pump state
      if (pumpOn) {
        digitalWrite(PUMP_PIN, HIGH);
      } else {
        digitalWrite(PUMP_PIN, LOW);
      }
      
      Serial.println("Pump status: " + String(pumpOn ? "ON" : "OFF"));
    } else {
      Serial.println("Error on GET request");
    }
    
    http.end();
  }
}
```

## MicroPython Implementation

### Setup

MicroPython is an alternative to Arduino for ESP32 programming. Here's how to implement the same functionality using MicroPython:

#### Required Libraries

First, make sure to upload these libraries to your ESP32:
- `urequests.py` - HTTP client
- `ujson.py` - JSON parsing

You can download these from the [MicroPython libraries repository](https://github.com/micropython/micropython-lib).

### Example Implementation

```python
import network
import urequests
import ujson
import time
import machine
from machine import Pin, Timer

# Configuration
WIFI_SSID = "YourWiFiSSID"
WIFI_PASSWORD = "YourWiFiPassword"
SERVER_URL = "http://your-server-ip:3000/api"
API_KEY = "your-api-key-here"
TANK_HEIGHT = 100  # cm

# Pin definitions
TRIGGER_PIN = 5
ECHO_PIN = 18
PUMP_PIN = 23

# Initialize pump control pin
pump = Pin(PUMP_PIN, Pin.OUT)
pump.off()  # Start with pump off

# Connect to WiFi
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if not wlan.isconnected():
        print("Connecting to WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        
        # Wait for connection with timeout
        max_wait = 10
        while max_wait > 0:
            if wlan.isconnected():
                break
            max_wait -= 1
            print("Waiting for connection...")
            time.sleep(1)
            
    if wlan.isconnected():
        print("Connected to WiFi")
        print("IP:", wlan.ifconfig()[0])
        return True
    else:
        print("Failed to connect to WiFi")
        return False

# Ultrasonic sensor reading
def read_water_level():
    # Initialize ultrasonic sensor pins
    trigger = Pin(TRIGGER_PIN, Pin.OUT)
    echo = Pin(ECHO_PIN, Pin.IN)
    
    # Send pulse
    trigger.off()
    time.sleep_us(2)
    trigger.on()
    time.sleep_us(10)
    trigger.off()
    
    # Wait for echo
    while echo.value() == 0:
        start = time.ticks_us()
    
    while echo.value() == 1:
        end = time.ticks_us()
    
    # Calculate distance
    duration = time.ticks_diff(end, start)
    distance_cm = (duration * 0.0343) / 2
    
    # Convert to water level
    water_level = TANK_HEIGHT - distance_cm
    
    # Validate readings
    if water_level < 0:
        water_level = 0
    if water_level > TANK_HEIGHT:
        water_level = TANK_HEIGHT
        
    print("Water level:", water_level, "cm")
    return water_level

# Control the pump
def control_pump(turn_on):
    if turn_on:
        pump.on()
        print("Pump turned ON")
    else:
        pump.off()
        print("Pump turned OFF")

# Send water level data to server
def send_water_level():
    try:
        water_level = read_water_level()
        
        headers = {
            'Content-Type': 'application/json',
            'X-API-KEY': API_KEY
        }
        
        data = {
            'level_cm': water_level
        }
        
        response = urequests.post(
            SERVER_URL + "/data", 
            headers=headers,
            json=data
        )
        
        if response.status_code == 200:
            response_data = response.json()
            pump_on = response_data.get('pump_on', False)
            auto_mode = response_data.get('auto_mode', True)
            
            control_pump(pump_on)
            
            print("Data sent successfully")
            print("Pump status:", "ON" if pump_on else "OFF")
            print("Auto mode:", "ENABLED" if auto_mode else "DISABLED")
        else:
            print("Error sending data:", response.status_code)
            handle_server_error()
            
        response.close()
    except Exception as e:
        print("Exception in send_water_level:", e)
        handle_server_error()

# Check pump status
def check_pump_status():
    try:
        headers = {
            'X-API-KEY': API_KEY
        }
        
        response = urequests.get(
            SERVER_URL + "/status", 
            headers=headers
        )
        
        if response.status_code == 200:
            response_data = response.json()
            pump_on = response_data.get('pump_on', False)
            auto_mode = response_data.get('auto_mode', True)
            
            control_pump(pump_on)
            
            print("Status check successful")
            print("Pump status:", "ON" if pump_on else "OFF")
            print("Auto mode:", "ENABLED" if auto_mode else "DISABLED")
        else:
            print("Error checking status:", response.status_code)
            handle_server_error()
            
        response.close()
    except Exception as e:
        print("Exception in check_pump_status:", e)
        handle_server_error()

# Handle server errors with local fallback logic
def handle_server_error():
    water_level = read_water_level()
    
    # Simple local fallback logic
    if water_level < 10.0:
        # Critical low level - turn on pump
        control_pump(True)
        print("SERVER ERROR: Running emergency mode - PUMP ON")
    elif water_level > 90.0:
        # High level - turn off pump
        control_pump(False)
        print("SERVER ERROR: Running emergency mode - PUMP OFF")

# Main application
def main():
    # Connect to WiFi
    if not connect_wifi():
        return
    
    # Send initial data
    send_water_level()
    
    # Setup periodic tasks
    data_timer = Timer(0)
    status_timer = Timer(1)
    
    # Send data every 60 seconds
    data_timer.init(
        period=60000, 
        mode=Timer.PERIODIC, 
        callback=lambda t: send_water_level()
    )
    
    # Check status every 10 seconds
    status_timer.init(
        period=10000, 
        mode=Timer.PERIODIC, 
        callback=lambda t: check_pump_status()
    )
    
    print("IoT Water Tank Monitor running")

# Start the application
if __name__ == "__main__":
    main()
```

### Installing on ESP32

To use this code on your ESP32 with MicroPython:

1. **Flash MicroPython firmware** to your ESP32 using tools like `esptool.py`
2. **Connect to the ESP32** using a tool like `ampy`, `rshell`, or the WebREPL
3. **Upload the code** as `main.py` so it runs automatically on boot
4. **Upload required libraries** (`urequests.py` and `ujson.py`)

For example, using `ampy`:
```bash
ampy --port /dev/ttyUSB0 put urequests.py
ampy --port /dev/ttyUSB0 put ujson.py
ampy --port /dev/ttyUSB0 put main.py
```

### Alternative Sensor Implementation (HC-SR04 Library)

For more reliable ultrasonic sensor readings, you can use the HCSR04 library:

```python
# First, upload the hcsr04.py library to your ESP32
from hcsr04 import HCSR04
import time

# Initialize sensor
sensor = HCSR04(trigger_pin=5, echo_pin=18)

def read_water_level():
    # Take multiple readings for better accuracy
    distance_sum = 0
    valid_readings = 0
    
    for _ in range(3):
        try:
            distance = sensor.distance_cm()
            if 0 < distance < 400:  # Filter out invalid readings
                distance_sum += distance
                valid_readings += 1
        except Exception as e:
            print("Sensor reading error:", e)
        
        time.sleep(0.1)
    
    # Calculate average if we have valid readings
    if valid_readings > 0:
        distance_cm = distance_sum / valid_readings
        water_level = TANK_HEIGHT - distance_cm
        
        # Validate water level
        if water_level < 0:
            water_level = 0
        if water_level > TANK_HEIGHT:
            water_level = TANK_HEIGHT
            
        print("Water level:", water_level, "cm")
        return water_level
    
    # Return last known valid reading or default
    print("No valid readings")
    return 0
```

## Implementation Tips

### Water Level Sensing

There are several methods to measure water level with an ESP32:

1. **Ultrasonic Sensor (HC-SR04)**: Measures distance from sensor to water surface.
2. **Capacitive Water Level Sensor**: Uses capacitance to detect water level.
3. **Float Switch**: Basic binary detection at specific levels.
4. **Pressure Sensor**: Measures water pressure at bottom of tank.

Example for ultrasonic sensor:

```cpp
#include <NewPing.h>

#define TRIGGER_PIN 5
#define ECHO_PIN 18
#define MAX_DISTANCE 200 // Maximum distance in cm
#define TANK_HEIGHT 100  // Tank height in cm

NewPing sonar(TRIGGER_PIN, ECHO_PIN, MAX_DISTANCE);

float readWaterLevelSensor() {
  delay(50);
  float distance = sonar.ping_cm();
  
  // Convert distance to water level
  float waterLevel = TANK_HEIGHT - distance;
  
  // Check for valid readings
  if (waterLevel < 0) waterLevel = 0;
  if (waterLevel > TANK_HEIGHT) waterLevel = TANK_HEIGHT;
  
  return waterLevel;
}
```

### Pump Control

Use a relay module to control the water pump:

```cpp
#define PUMP_PIN 23 // GPIO pin connected to relay

void setup() {
  // ... other setup code
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW); // Start with pump off
}

void controlPump(bool turnOn) {
  digitalWrite(PUMP_PIN, turnOn ? HIGH : LOW);
}
```

### Error Handling

Implement robust error handling for network issues:

```cpp
// Reconnect to WiFi if connection is lost
void ensureWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost. Reconnecting...");
    WiFi.begin(ssid, password);
    
    // Wait up to 20 seconds for connection
    int timeout = 20;
    while (WiFi.status() != WL_CONNECTED && timeout > 0) {
      delay(1000);
      Serial.print(".");
      timeout--;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Reconnected to WiFi");
    } else {
      Serial.println("Failed to reconnect. Will try again later.");
    }
  }
}

// Handle server connection errors
void handleServerError() {
  // If server is unreachable, operate in fallback mode
  // Example: Use local thresholds for pump control
  float waterLevel = readWaterLevelSensor();
  
  // Simple local control logic
  if (waterLevel < 10.0) {
    // Water level critically low, turn on pump
    digitalWrite(PUMP_PIN, HIGH);
  } else if (waterLevel > 90.0) {
    // Water level high enough, turn off pump
    digitalWrite(PUMP_PIN, LOW);
  }
}
```

## Complete ESP32 Example Code

A complete example implementing both sending data and checking status:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NewPing.h>

// WiFi and server settings
const char* ssid = "YourWiFiSSID";
const char* password = "YourWiFiPassword";
const char* serverUrl = "http://your-server-ip:3000/api";
const char* apiKey = "your-api-key-here";

// Pins
#define TRIGGER_PIN 5
#define ECHO_PIN 18
#define PUMP_PIN 23

// Tank parameters
#define TANK_HEIGHT 100  // Tank height in cm
#define MAX_DISTANCE 200 // Maximum sensor distance in cm

// Timing
unsigned long lastDataSend = 0;
const unsigned long DATA_SEND_INTERVAL = 60000; // 1 minute
unsigned long lastStatusCheck = 0;
const unsigned long STATUS_CHECK_INTERVAL = 10000; // 10 seconds

// Initialize ultrasonic sensor
NewPing sonar(TRIGGER_PIN, ECHO_PIN, MAX_DISTANCE);

void setup() {
  Serial.begin(115200);
  
  // Set up pump control pin
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW); // Start with pump off
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  
  Serial.println("\nConnected to WiFi");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Ensure WiFi is connected
  ensureWiFiConnection();
  
  // Send water level data every DATA_SEND_INTERVAL
  if (currentMillis - lastDataSend >= DATA_SEND_INTERVAL) {
    lastDataSend = currentMillis;
    sendWaterLevelData();
  }
  
  // Check pump status more frequently
  if (currentMillis - lastStatusCheck >= STATUS_CHECK_INTERVAL) {
    lastStatusCheck = currentMillis;
    checkPumpStatus();
  }
}

void ensureWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost. Reconnecting...");
    WiFi.begin(ssid, password);
    
    // Wait up to 20 seconds for connection
    int timeout = 20;
    while (WiFi.status() != WL_CONNECTED && timeout > 0) {
      delay(1000);
      Serial.print(".");
      timeout--;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Reconnected to WiFi");
    } else {
      Serial.println("Failed to reconnect. Will try again later.");
      handleServerError();
    }
  }
}

float readWaterLevelSensor() {
  delay(50);
  float distance = sonar.ping_cm();
  
  // Convert distance to water level
  float waterLevel = TANK_HEIGHT - distance;
  
  // Check for valid readings
  if (waterLevel < 0) waterLevel = 0;
  if (waterLevel > TANK_HEIGHT) waterLevel = TANK_HEIGHT;
  
  Serial.print("Water level: ");
  Serial.print(waterLevel);
  Serial.println(" cm");
  
  return waterLevel;
}

void sendWaterLevelData() {
  if (WiFi.status() == WL_CONNECTED) {
    float waterLevel = readWaterLevelSensor();
    
    HTTPClient http;
    http.begin(String(serverUrl) + "/data");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-KEY", apiKey);
    
    DynamicJsonDocument doc(200);
    doc["level_cm"] = waterLevel;
    String requestBody;
    serializeJson(doc, requestBody);
    
    int httpResponseCode = http.POST(requestBody);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("HTTP Response: " + response);
      
      DynamicJsonDocument responseDoc(200);
      deserializeJson(responseDoc, response);
      
      bool pumpOn = responseDoc["pump_on"];
      bool autoMode = responseDoc["auto_mode"];
      
      controlPump(pumpOn);
      
      Serial.println("Data sent successfully");
      Serial.println("Pump status: " + String(pumpOn ? "ON" : "OFF"));
      Serial.println("Auto mode: " + String(autoMode ? "ENABLED" : "DISABLED"));
    } else {
      Serial.print("Error on sending POST: ");
      Serial.println(httpResponseCode);
      handleServerError();
    }
    
    http.end();
  }
}

void checkPumpStatus() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(serverUrl) + "/status");
    http.addHeader("X-API-KEY", apiKey);
    
    int httpResponseCode = http.GET();
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      
      DynamicJsonDocument doc(200);
      deserializeJson(doc, response);
      
      bool pumpOn = doc["pump_on"];
      bool autoMode = doc["auto_mode"];
      
      controlPump(pumpOn);
      
      Serial.println("Status check successful");
      Serial.println("Pump status: " + String(pumpOn ? "ON" : "OFF"));
      Serial.println("Auto mode: " + String(autoMode ? "ENABLED" : "DISABLED"));
    } else {
      Serial.print("Error on status check: ");
      Serial.println(httpResponseCode);
      handleServerError();
    }
    
    http.end();
  }
}

void controlPump(bool turnOn) {
  digitalWrite(PUMP_PIN, turnOn ? HIGH : LOW);
}

void handleServerError() {
  // Local fallback logic when server is unreachable
  float waterLevel = readWaterLevelSensor();
  
  // Example thresholds - adjust based on your needs
  if (waterLevel < 10.0) {
    // Critical low level - turn on pump
    controlPump(true);
    Serial.println("SERVER ERROR: Running emergency mode - PUMP ON");
  } else if (waterLevel > 90.0) {
    // High level - turn off pump
    controlPump(false);
    Serial.println("SERVER ERROR: Running emergency mode - PUMP OFF");
  }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors (HTTP 401)**
   - Verify the API key in your ESP32 code matches the one in the server's `.env` file
   - Check that the header is properly formatted as `X-API-KEY`

2. **Connection Failures**
   - Ensure the server is running and accessible from the ESP32's network
   - Check that the server URL and port are correct
   - Verify network connectivity (WiFi signal strength, etc.)

3. **Sensor Reading Issues**
   - Calibrate sensors properly for your tank dimensions
   - Filter out invalid readings (negative values, values exceeding tank height)
   - Add debouncing or averaging for more stable readings

4. **Pump Control Problems**
   - Test the relay separately to ensure it's working properly
   - Verify wiring between ESP32, relay, and pump
   - Implement safeguards against rapid on/off cycling

### Debugging Tips

1. Enable detailed serial output for troubleshooting
2. Implement fallback logic for when the server is unreachable
3. Use status LEDs to indicate connection status and pump state
4. Consider adding a small display (OLED) for local status monitoring

## Further Enhancements

1. **OTA Updates**: Implement over-the-air firmware updates
2. **Deep Sleep**: Use ESP32 deep sleep between readings to save power
3. **Additional Sensors**: Add temperature, pressure, or flow rate sensors
4. **Local Control**: Implement a local web interface for when the main server is down
5. **Battery Monitoring**: Add battery level monitoring for battery-powered setups

## Complete Implementation Example

Here's a complete Arduino/ESP32 implementation that supports both regular and encrypted modes:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Configuration
const char* ssid = "YourWiFiSSID";
const char* password = "YourWiFiPassword";
const char* serverUrl = "http://your-server-ip:3000/api";
const char* apiKey = "your-api-key-here";

// Encryption settings
const String encryptionKey = "MySecretKey123"; // Your encryption key
const bool USE_ENCRYPTED_MODE = false; // Set to true for encrypted mode

// Pin definitions
#define PUMP_PIN 23
#define TRIGGER_PIN 5
#define ECHO_PIN 18
#define TANK_HEIGHT 100

void setup() {
  Serial.begin(115200);
  
  // Initialize pins
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
  
  // Print mode
  Serial.println("Mode: " + String(USE_ENCRYPTED_MODE ? "ENCRYPTED" : "REGULAR"));
  if (USE_ENCRYPTED_MODE) {
    Serial.println("Encryption Key: " + encryptionKey);
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    float waterLevel = readWaterLevelSensor();
    
    if (USE_ENCRYPTED_MODE) {
      sendEncryptedData(waterLevel);
    } else {
      sendRegularData(waterLevel);
    }
    
    // Wait before next reading
    delay(30000); // 30 seconds
  }
}

// Regular mode data transmission
void sendRegularData(float waterLevel) {
  HTTPClient http;
  http.begin(String(serverUrl) + "/data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-KEY", apiKey);
  
  DynamicJsonDocument doc(200);
  doc["level_cm"] = waterLevel;
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  handleResponse(httpResponseCode, http.getString(), waterLevel, "REGULAR");
  
  http.end();
}

// Encrypted mode data transmission
void sendEncryptedData(float waterLevel) {
  String encryptedLevel = encryptWaterLevel(waterLevel, encryptionKey);
  
  HTTPClient http;
  http.begin(String(serverUrl) + "/encrypted-data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-KEY", apiKey);
  
  DynamicJsonDocument doc(200);
  doc["encrypted_level"] = encryptedLevel;
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  handleResponse(httpResponseCode, http.getString(), waterLevel, "ENCRYPTED");
  
  http.end();
}

// Handle server response
void handleResponse(int httpCode, String response, float originalLevel, String mode) {
  if (httpCode > 0) {
    DynamicJsonDocument responseDoc(200);
    deserializeJson(responseDoc, response);
    
    bool pumpOn = responseDoc["pump_on"];
    bool autoMode = responseDoc["auto_mode"];
    
    // Control pump
    digitalWrite(PUMP_PIN, pumpOn ? HIGH : LOW);
    
    // Log results
    Serial.println("=== " + mode + " MODE TRANSMISSION ===");
    Serial.println("Water Level: " + String(originalLevel, 1) + " cm");
    if (mode == "ENCRYPTED") {
      Serial.println("Encrypted: " + encryptWaterLevel(originalLevel, encryptionKey));
    }
    Serial.println("Pump Status: " + String(pumpOn ? "ON" : "OFF"));
    Serial.println("Auto Mode: " + String(autoMode ? "ENABLED" : "DISABLED"));
    Serial.println("HTTP Code: " + String(httpCode));
    Serial.println("===============================");
  } else {
    Serial.println("Error: HTTP " + String(httpCode));
    handleServerError(originalLevel);
  }
}

// XOR encryption function
String encryptWaterLevel(float level, String key) {
  String dataStr = String(level, 1); // Convert to string with 1 decimal place
  String result = "";
  
  for (int i = 0; i < dataStr.length(); i++) {
    char dataChar = dataStr.charAt(i);
    char keyChar = key.charAt(i % key.length()); // Repeat key if shorter than data
    char encrypted = dataChar ^ keyChar;
    
    // Convert to hex (2 characters per byte)
    if (encrypted < 16) {
      result += "0";
    }
    result += String(encrypted, HEX);
  }
  
  result.toUpperCase(); // Convert to uppercase hex
  return result;
}

// Water level sensor reading
float readWaterLevelSensor() {
  // Ultrasonic sensor implementation
  digitalWrite(TRIGGER_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIGGER_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIGGER_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH);
  float distance = (duration * 0.034) / 2; // Convert to cm
  
  // Convert distance to water level
  float waterLevel = TANK_HEIGHT - distance;
  
  // Validate readings
  if (waterLevel < 0) waterLevel = 0;
  if (waterLevel > TANK_HEIGHT) waterLevel = TANK_HEIGHT;
  
  return waterLevel;
}

// Emergency pump control when server is unavailable
void handleServerError(float waterLevel) {
  Serial.println("SERVER ERROR: Using local emergency control");
  
  // Simple emergency thresholds
  if (waterLevel < 10.0) {
    digitalWrite(PUMP_PIN, HIGH); // Turn on pump
    Serial.println("Emergency: PUMP ON (Low water)");
  } else if (waterLevel > 90.0) {
    digitalWrite(PUMP_PIN, LOW); // Turn off pump
    Serial.println("Emergency: PUMP OFF (High water)");
  }
}
```

## Testing Your Implementation

1. **Start with Regular Mode**: Set `USE_ENCRYPTED_MODE = false` and test basic functionality
2. **Switch to Encrypted Mode**: Set `USE_ENCRYPTED_MODE = true` and verify data transmission
3. **Monitor Serial Output**: Check the serial monitor for encryption debugging information
4. **Test Web Interface**: Use the web dashboard to verify data is being received correctly

## Security Considerations (Educational)

This implementation demonstrates basic encryption concepts but has several educational limitations:

1. **Key Management**: The key is hardcoded (in production, use secure key exchange)
2. **Algorithm Strength**: XOR is educational but not cryptographically secure
3. **Key Reuse**: The same key is used repeatedly (vulnerable to pattern analysis)
4. **No Authentication**: No message authentication or integrity checking

For production systems, consider:
- AES encryption with proper key management
- Message authentication codes (MAC)
- Secure key distribution protocols
- Regular key rotation

## Decryption Function (For Reference)

Here's the corresponding decryption function for completeness:

```cpp
String decryptWaterLevel(String encryptedHex, String key) {
  String result = "";
  
  // Convert hex string back to bytes and decrypt
  for (int i = 0; i < encryptedHex.length(); i += 2) {
    String hexByte = encryptedHex.substring(i, i + 2);
    char encryptedByte = (char)strtol(hexByte.c_str(), NULL, 16);
    char keyByte = key.charAt((i/2) % key.length());
    char decryptedByte = encryptedByte ^ keyByte;
    result += decryptedByte;
  }
  
  return result;
}
```

**Note**: This decryption function is for educational reference only. In the actual system, decryption happens on the web interface where users enter their decryption key. 