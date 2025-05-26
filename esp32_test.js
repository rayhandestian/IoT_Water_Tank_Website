/**
 * ESP32 Communication Test Script
 * 
 * This script simulates how an ESP32 would communicate with the server.
 * It sends water level data and receives pump control commands.
 * 
 * Usage: node esp32_test.js
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = `http://localhost:${process.env.PORT || 3000}/api`;
const API_KEY = process.env.ESP32_API_KEY;

// Simulate random water level
function getRandomWaterLevel() {
  return Math.floor(Math.random() * 100);
}

// Send water level data to server
async function sendWaterLevel() {
  const waterLevel = getRandomWaterLevel();
  
  try {
    console.log(`Sending water level: ${waterLevel} cm`);
    
    const response = await axios.post(`${API_URL}/data`, 
      { level_cm: waterLevel }, 
      { headers: { 'X-API-KEY': API_KEY } }
    );
    
    console.log('Server response:', response.data);
    console.log(`Pump should be: ${response.data.pump_on ? 'ON' : 'OFF'}`);
    console.log(`Auto mode is: ${response.data.auto_mode ? 'ENABLED' : 'DISABLED'}`);
    
  } catch (error) {
    console.error('Error sending data:', error.message);
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
    
    console.log('Current pump status:', response.data);
    
  } catch (error) {
    console.error('Error checking pump status:', error.message);
  }
}

// Run the test
async function runTest() {
  console.log('==== ESP32 Test Script ====');
  console.log(`API URL: ${API_URL}`);
  console.log('API Key: ' + (API_KEY ? '****' + API_KEY.substr(-4) : 'NOT SET - CHECK .env FILE'));
  
  if (!API_KEY) {
    console.error('Error: API_KEY not set. Please set ESP32_API_KEY in your .env file.');
    process.exit(1);
  }
  
  // First, check pump status
  await checkPumpStatus();
  
  // Then send water level data
  await sendWaterLevel();
  
  console.log('\nTest completed.');
}

runTest(); 