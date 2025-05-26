# ESP32 API Guide for IoT Water Tank

This document provides instructions for interfacing an ESP32 microcontroller with the IoT Water Tank monitoring system.

## API Overview

The IoT Water Tank system provides a RESTful API specifically designed for ESP32 devices to:

1. Send water level readings to the server
2. Receive pump control commands
3. Query the current status of the pump

All ESP32 API endpoints require authentication using an API key.

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

**Example (Arduino/ESP32):**
```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YourWiFiSSID";
const char* password = "YourWiFiPassword";
const char* serverUrl = "http://your-server-ip:3000/api/data";
const char* apiKey = "your-api-key-here";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  
  Serial.println("Connected to WiFi");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // Read water level from your sensor
    float waterLevel = readWaterLevelSensor();
    
    // Create HTTP client
    HTTPClient http;
    http.begin(serverUrl);
    
    // Set headers
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-KEY", apiKey);
    
    // Prepare JSON payload
    DynamicJsonDocument doc(200);
    doc["level_cm"] = waterLevel;
    String requestBody;
    serializeJson(doc, requestBody);
    
    // Send POST request
    int httpResponseCode = http.POST(requestBody);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      
      // Parse response
      DynamicJsonDocument responseDoc(200);
      deserializeJson(responseDoc, response);
      
      bool pumpOn = responseDoc["pump_on"];
      bool autoMode = responseDoc["auto_mode"];
      
      // Control pump based on response
      if (pumpOn) {
        // Turn pump ON
        digitalWrite(PUMP_PIN, HIGH);
      } else {
        // Turn pump OFF
        digitalWrite(PUMP_PIN, LOW);
      }
      
      Serial.println("Pump status: " + String(pumpOn ? "ON" : "OFF"));
      Serial.println("Auto mode: " + String(autoMode ? "ENABLED" : "DISABLED"));
    } else {
      Serial.print("Error on sending POST: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
    
    // Wait before next reading
    delay(30000); // 30 seconds
  }
}

float readWaterLevelSensor() {
  // Replace with your actual sensor reading code
  // Example: using ultrasonic sensor to measure distance to water surface
  // and converting to water level in cm
  return 75.5;
}
```

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