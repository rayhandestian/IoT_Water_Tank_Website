/**
 * ESP32 Communication Test Script
 * 
 * This script simulates how an ESP32 would communicate with the server.
 * It sends water level data and receives pump control commands.
 * Now supports both regular and encrypted modes with XOR and DES algorithms.
 * 
 * Usage: node esp32_test.js [mode] [algorithm]
 * mode: 'regular' (default) or 'encrypted'
 * algorithm: 'xor' (default) or 'des'
 * 
 * Examples:
 *   node esp32_test.js encrypted xor
 *   node esp32_test.js encrypted des
 *   node esp32_test.js regular
 */

const axios = require('axios');
require('dotenv').config();

// Import DES crypto module
const DES_CRYPTO = require('./utils/des_crypto.js');

const API_URL = `http://localhost:${process.env.PORT || 3000}/api`;
const API_KEY = process.env.ESP32_API_KEY;

// Encryption settings (same as ESP32 would use)
const ENCRYPTION_KEY = "MySecretKey123"; // Must match the key used in web interface
const USE_ENCRYPTED_MODE = process.argv[2] === 'encrypted';
const ENCRYPTION_ALGORITHM = (process.argv[3] || 'xor').toUpperCase(); // XOR or DES

// XOR encryption function (matches ESP32 implementation)
function encryptWaterLevelXOR(level, key) {
  const dataStr = level.toFixed(1); // Convert to string with 1 decimal place
  let result = '';
  
  for (let i = 0; i < dataStr.length; i++) {
    const dataChar = dataStr.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length); // Repeat key if shorter than data
    const encrypted = dataChar ^ keyChar;
    
    // Convert to hex (2 characters per byte)
    result += encrypted.toString(16).padStart(2, '0').toUpperCase();
  }
  
  return result;
}

// DES encryption function (matches ESP32 implementation)
function encryptWaterLevelDES(level, key) {
  const dataStr = level.toFixed(1); // Convert to string with 1 decimal place
  return DES_CRYPTO.desEncrypt(dataStr, key);
}

// Unified encryption function
function encryptWaterLevel(level, key, algorithm = 'XOR') {
  switch (algorithm.toUpperCase()) {
    case 'DES':
      return encryptWaterLevelDES(level, key);
    case 'XOR':
    default:
      return encryptWaterLevelXOR(level, key);
  }
}

// Simulate random water level
function getRandomWaterLevel() {
  return Math.floor(Math.random() * 100) + Math.random();  // Include decimal for better testing
}

// Send regular water level data to server
async function sendRegularWaterLevel() {
  const waterLevel = getRandomWaterLevel();
  
  try {
    console.log(`📊 Sending regular water level: ${waterLevel.toFixed(1)} cm`);
    
    const response = await axios.post(`${API_URL}/data`, 
      { level_cm: waterLevel }, 
      { headers: { 'X-API-KEY': API_KEY } }
    );
    
    console.log('✅ Server response:', response.data);
    console.log(`🔌 Pump should be: ${response.data.pump_on ? 'ON' : 'OFF'}`);
    console.log(`⚙️  Auto mode is: ${response.data.auto_mode ? 'ENABLED' : 'DISABLED'}`);
    
  } catch (error) {
    console.error('❌ Error sending regular data:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

// Send encrypted water level data to server
async function sendEncryptedWaterLevel() {
  const waterLevel = getRandomWaterLevel();
  const encryptedLevel = encryptWaterLevel(waterLevel, ENCRYPTION_KEY, ENCRYPTION_ALGORITHM);
  
  try {
    console.log(`📊 Original water level: ${waterLevel.toFixed(1)} cm`);
    console.log(`🔐 Algorithm: ${ENCRYPTION_ALGORITHM}`);
    console.log(`🔐 Encrypted data: ${encryptedLevel}`);
    console.log(`🔑 Encryption key: ${ENCRYPTION_KEY}`);
    
    const response = await axios.post(`${API_URL}/encrypted-data`, 
      { encrypted_level: encryptedLevel }, 
      { headers: { 'X-API-KEY': API_KEY } }
    );
    
    console.log('✅ Server response:', response.data);
    console.log(`🔌 Pump should be: ${response.data.pump_on ? 'ON' : 'OFF'}`);
    console.log(`⚙️  Auto mode is: ${response.data.auto_mode ? 'ENABLED' : 'DISABLED'}`);
    
  } catch (error) {
    console.error('❌ Error sending encrypted data:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

// Poll for pump status
async function checkPumpStatus() {
  try {
    const response = await axios.get(`${API_URL}/status`, 
      { headers: { 'X-API-KEY': API_KEY } }
    );
    
    console.log('📋 Current pump status:', response.data);
    
  } catch (error) {
    console.error('❌ Error checking pump status:', error.message);
  }
}

// Demonstrate encryption/decryption
function demonstrateEncryption() {
  console.log('\n🔐 === ENCRYPTION DEMONSTRATION ===');
  console.log(`Algorithm: ${ENCRYPTION_ALGORITHM}`);
  console.log(`Key: ${ENCRYPTION_KEY}`);
  
  const testValues = [12.5, 25.0, 50.5, 75.8, 99.9];
  
  console.log('\n📊 Test Data Encryption:');
  testValues.forEach(value => {
    const encrypted = encryptWaterLevel(value, ENCRYPTION_KEY, ENCRYPTION_ALGORITHM);
    console.log(`   ${value.toFixed(1)} cm → ${encrypted}`);
  });
  
  // Show comparison between algorithms
  if (ENCRYPTION_ALGORITHM === 'XOR') {
    console.log('\n🔍 DES Comparison (same key):');
    const sampleValue = 12.5;
    const xorEncrypted = encryptWaterLevelXOR(sampleValue, ENCRYPTION_KEY);
    const desEncrypted = encryptWaterLevelDES(sampleValue, ENCRYPTION_KEY);
    console.log(`   XOR: ${sampleValue.toFixed(1)} cm → ${xorEncrypted}`);
    console.log(`   DES: ${sampleValue.toFixed(1)} cm → ${desEncrypted}`);
    console.log('   Notice: DES produces longer, more complex ciphertext');
  }
  
  console.log('\n💡 To decrypt in the web interface:');
  console.log(`   1. Toggle "🔐 Encrypted Data Mode" ON`);
  console.log(`   2. Select algorithm: "${ENCRYPTION_ALGORITHM}" (or use Auto-Detect)`);
  console.log(`   3. Enter decryption key: "${ENCRYPTION_KEY}"`);
  console.log(`   4. View decrypted water levels and history`);
  
  console.log('\n📚 Algorithm Information:');
  if (ENCRYPTION_ALGORITHM === 'XOR') {
    console.log('   ⚡ XOR Cipher: Simple stream cipher, very fast but not secure');
    console.log('   🔧 Complexity: Low | Speed: Very Fast | Security: Very Low');
  } else {
    console.log('   🔐 DES: Block cipher with 56-bit keys (educational use only)');
    console.log('   🔧 Complexity: High | Speed: Moderate | Security: Broken');
  }
  
  console.log('   ⚠️  Both algorithms are for EDUCATIONAL purposes only!');
  console.log('=====================================\n');
}

// Run the test
async function runTest() {
  console.log('🔬 ==== ESP32 Cross-Platform Cryptography Test ====');
  console.log(`📡 API URL: ${API_URL}`);
  console.log('🔑 API Key: ' + (API_KEY ? '****' + API_KEY.substr(-4) : 'NOT SET - CHECK .env FILE'));
  console.log(`📊 Mode: ${USE_ENCRYPTED_MODE ? '🔐 ENCRYPTED' : '📊 REGULAR'}`);
  
  if (USE_ENCRYPTED_MODE) {
    console.log(`🔐 Algorithm: ${ENCRYPTION_ALGORITHM}`);
    console.log(`🔑 Key: ${ENCRYPTION_KEY}`);
  }
  
  if (!API_KEY) {
    console.error('❌ Error: API_KEY not set. Please set ESP32_API_KEY in your .env file.');
    process.exit(1);
  }
  
  // Validate algorithm
  if (USE_ENCRYPTED_MODE && !['XOR', 'DES'].includes(ENCRYPTION_ALGORITHM)) {
    console.error(`❌ Error: Invalid algorithm "${ENCRYPTION_ALGORITHM}". Use 'xor' or 'des'.`);
    process.exit(1);
  }
  
  if (USE_ENCRYPTED_MODE) {
    demonstrateEncryption();
  }
  
  console.log('\n📡 Starting data transmission...\n');
  
  // First, check pump status
  await checkPumpStatus();
  console.log(''); // Add spacing
  
  // Send data based on mode
  if (USE_ENCRYPTED_MODE) {
    await sendEncryptedWaterLevel();
  } else {
    await sendRegularWaterLevel();
  }
  
  console.log('\n✅ Test completed successfully!');
  
  if (USE_ENCRYPTED_MODE) {
    console.log('\n🌐 Next steps:');
    console.log('   1. Open the web dashboard');
    console.log('   2. Enable "Encrypted Data Mode"');
    console.log(`   3. Select algorithm: "${ENCRYPTION_ALGORITHM}" (or use Auto-Detect)`);
    console.log(`   4. Enter key: "${ENCRYPTION_KEY}"`);
    console.log('   5. View the decrypted data and charts');
    
    console.log('\n🧪 Test other algorithms:');
    console.log(`   node esp32_test.js encrypted ${ENCRYPTION_ALGORITHM === 'XOR' ? 'des' : 'xor'}`);
  }
  
  console.log('\n🎓 Educational Notes:');
  console.log('   - This implementation demonstrates basic cryptographic concepts');
  console.log('   - Both XOR and DES are considered broken for real-world use');
  console.log('   - Modern systems should use AES-256 or similar algorithms');
  console.log('   - Always use proper key management in production systems');
  console.log('====================================================');
}

runTest(); 