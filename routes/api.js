const express = require('express');
const router = express.Router();
const db = require('../db');

// Get tank height from environment variables, default to 100cm
const TANK_HEIGHT_CM = parseInt(process.env.TANK_HEIGHT_CM || '100', 10);

// Middleware to validate ESP32 API key
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.ESP32_API_KEY;
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  
  next();
};

// Error handling middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      success: false 
    });
  });
};

// ESP32 Routes
// POST /api/data - Receive sensor data from ESP32
router.post('/data', validateApiKey, asyncHandler(async (req, res) => {
  const { level_cm } = req.body;
  
  if (level_cm === undefined || isNaN(level_cm)) {
    return res.status(400).json({ error: 'Invalid data: level_cm is required and must be a number' });
  }
  
  // Insert sensor data
  const pool = db.getPool();
  await pool.query('INSERT INTO sensor_data (level_cm) VALUES (?)', [level_cm]);
  
  // Get current pump status
  const [rows] = await pool.query('SELECT is_on, auto_mode FROM pump_status ORDER BY id DESC LIMIT 1');
  const { is_on, auto_mode } = rows[0];
  
  res.json({
    pump_on: is_on,
    auto_mode: auto_mode
  });
}));

// GET /api/status - ESP32 polling for pump status
router.get('/status', validateApiKey, asyncHandler(async (req, res) => {
  const pool = db.getPool();
  const [rows] = await pool.query('SELECT is_on, auto_mode FROM pump_status ORDER BY id DESC LIMIT 1');
  
  res.json({
    pump_on: rows[0].is_on,
    auto_mode: rows[0].auto_mode
  });
}));

// Dashboard Routes
// GET /api/latest - Get latest sensor data and pump status
router.get('/latest', asyncHandler(async (req, res) => {
  const pool = db.getPool();
  
  // Get latest sensor data
  const [sensorRows] = await pool.query('SELECT level_cm, timestamp FROM sensor_data ORDER BY id DESC LIMIT 1');
  
  // Get latest pump status
  const [pumpRows] = await pool.query('SELECT is_on, auto_mode FROM pump_status ORDER BY id DESC LIMIT 1');
  
  // If no data yet, return default values
  if (sensorRows.length === 0) {
    return res.json({
      level_cm: 0,
      timestamp: new Date(),
      pump_on: false,
      auto_mode: true,
      tank_height_cm: TANK_HEIGHT_CM
    });
  }
  
  res.json({
    level_cm: sensorRows[0].level_cm,
    timestamp: sensorRows[0].timestamp,
    pump_on: pumpRows[0].is_on,
    auto_mode: pumpRows[0].auto_mode,
    tank_height_cm: TANK_HEIGHT_CM
  });
}));

// GET /api/history - Get historical sensor data
router.get('/history', asyncHandler(async (req, res) => {
  const pool = db.getPool();
  const limit = parseInt(req.query.limit || '24', 10); // Default to last 24 entries
  
  // Get historical data with a reasonable limit
  const [rows] = await pool.query(
    'SELECT level_cm, timestamp FROM sensor_data ORDER BY timestamp DESC LIMIT ?', 
    [Math.min(limit, 100)] // Cap at 100 entries to prevent excessive data transfer
  );
  
  // Return data in chronological order (oldest first)
  res.json({
    history: rows.reverse(),
    tank_height_cm: TANK_HEIGHT_CM
  });
}));

// POST /api/pump - Update pump status manually
router.post('/pump', asyncHandler(async (req, res) => {
  const { is_on } = req.body;
  
  if (is_on === undefined || typeof is_on !== 'boolean') {
    return res.status(400).json({ error: 'Invalid data: is_on is required and must be a boolean' });
  }
  
  const pool = db.getPool();
  await pool.query('INSERT INTO pump_status (is_on, auto_mode) SELECT ?, auto_mode FROM pump_status ORDER BY id DESC LIMIT 1', [is_on]);
  
  res.json({ success: true, is_on });
}));

// POST /api/auto - Toggle auto mode
router.post('/auto', asyncHandler(async (req, res) => {
  const { auto_mode } = req.body;
  
  if (auto_mode === undefined || typeof auto_mode !== 'boolean') {
    return res.status(400).json({ error: 'Invalid data: auto_mode is required and must be a boolean' });
  }
  
  const pool = db.getPool();
  await pool.query('INSERT INTO pump_status (is_on, auto_mode) SELECT is_on, ? FROM pump_status ORDER BY id DESC LIMIT 1', [auto_mode]);
  
  res.json({ success: true, auto_mode });
}));

// GET /api/config - Get configuration values
router.get('/config', (req, res) => {
  res.json({
    tank_height_cm: TANK_HEIGHT_CM
  });
});

module.exports = router; 