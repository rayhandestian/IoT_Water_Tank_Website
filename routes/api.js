const express = require('express');
const router = express.Router();
const db = require('../db');

// Get configuration from environment variables, with defaults
const TANK_HEIGHT_CM = parseInt(process.env.TANK_HEIGHT_CM || '100', 10);
const REFRESH_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL_MS || '5000', 10);
const MAX_HISTORY_MINUTES_AGO = parseInt(process.env.MAX_HISTORY_MINUTES_AGO || '60', 10);

// Middleware to validate ESP32 API key
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.ESP32_API_KEY;
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  
  next();
};

// Helper function to check if temporary password has expired
const isPasswordExpired = (expiresAt) => {
  if (!expiresAt) return false; // Permanent password
  return new Date() > new Date(expiresAt);
};

// Middleware to validate main admin password (for managing temporary passwords)
const validateMainPassword = (req, res, next) => {
  const password = req.body.password;
  const validPassword = process.env.PUMP_CONTROL_PASSWORD;
  
  if (!password || password !== validPassword) {
    return res.status(401).json({ error: 'Unauthorized: Invalid main password' });
  }
  
  next();
};

// Middleware to validate pump control password (main or temporary)
const validatePumpPassword = async (req, res, next) => {
  const password = req.body.password;
  const mainPassword = process.env.PUMP_CONTROL_PASSWORD;
  
  if (!password) {
    return res.status(401).json({ error: 'Unauthorized: Password required' });
  }
  
  // Check main password first
  if (password === mainPassword) {
    req.isMainPassword = true;
    return next();
  }
  
  // Check temporary passwords
  try {
    const pool = db.getPool();
    const [rows] = await pool.query(
      'SELECT id, expires_at FROM temporary_passwords WHERE password = ?',
      [password]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Invalid password' });
    }
    
    const tempPassword = rows[0];
    if (isPasswordExpired(tempPassword.expires_at)) {
      // Clean up expired password
      await pool.query('DELETE FROM temporary_passwords WHERE id = ?', [tempPassword.id]);
      return res.status(401).json({ error: 'Unauthorized: Password has expired' });
    }
    
    req.isMainPassword = false;
    next();
  } catch (error) {
    console.error('Error validating temporary password:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
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
      tank_height_cm: TANK_HEIGHT_CM,
      refresh_interval_ms: REFRESH_INTERVAL_MS,
      max_history_minutes_ago: MAX_HISTORY_MINUTES_AGO
    });
  }
  
  res.json({
    level_cm: sensorRows[0].level_cm,
    timestamp: sensorRows[0].timestamp,
    pump_on: pumpRows[0].is_on,
    auto_mode: pumpRows[0].auto_mode,
    tank_height_cm: TANK_HEIGHT_CM,
    refresh_interval_ms: REFRESH_INTERVAL_MS,
    max_history_minutes_ago: MAX_HISTORY_MINUTES_AGO
  });
}));

// GET /api/history - Get historical sensor data with time-based filtering
router.get('/history', asyncHandler(async (req, res) => {
  const pool = db.getPool();
  const minutesAgo = parseInt(req.query.minutes_ago || MAX_HISTORY_MINUTES_AGO.toString(), 10);
  const maxDataPoints = parseInt(req.query.max_points || '100', 10);
  
  // Calculate cutoff time
  const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  
  // Get historical data within time range
  const [rows] = await pool.query(
    `SELECT level_cm, timestamp 
     FROM sensor_data 
     WHERE timestamp >= ? 
     ORDER BY timestamp DESC 
     LIMIT ?`, 
    [cutoffTime, Math.min(maxDataPoints, 200)] // Cap at 200 entries
  );
  
  // For dense data, reduce points to improve performance
  let processedData = rows.reverse(); // Chronological order
  
  if (processedData.length > maxDataPoints) {
    // Simple data reduction: take every nth point to reach target count
    const step = Math.ceil(processedData.length / maxDataPoints);
    processedData = processedData.filter((_, index) => index % step === 0);
    
    // Always include the last data point
    if (processedData[processedData.length - 1] !== rows[0]) {
      processedData.push(rows[0]);
    }
  }
  
  res.json({
    history: processedData,
    tank_height_cm: TANK_HEIGHT_CM,
    max_history_minutes_ago: MAX_HISTORY_MINUTES_AGO,
    refresh_interval_ms: REFRESH_INTERVAL_MS,
    total_points: rows.length,
    filtered_points: processedData.length,
    time_range_minutes: minutesAgo
  });
}));

// POST /api/validate-password - Validate pump control password
router.post('/validate-password', asyncHandler(async (req, res) => {
  const { password } = req.body;
  const mainPassword = process.env.PUMP_CONTROL_PASSWORD;
  
  if (password === mainPassword) {
    res.json({ success: true, valid: true, isMainPassword: true });
    return;
  }
  
  // Check temporary passwords
  try {
    const pool = db.getPool();
    const [rows] = await pool.query(
      'SELECT id, expires_at FROM temporary_passwords WHERE password = ?',
      [password]
    );
    
    if (rows.length === 0) {
      res.json({ success: true, valid: false });
      return;
    }
    
    const tempPassword = rows[0];
    if (isPasswordExpired(tempPassword.expires_at)) {
      // Clean up expired password
      await pool.query('DELETE FROM temporary_passwords WHERE id = ?', [tempPassword.id]);
      res.json({ success: true, valid: false });
      return;
    }
    
    res.json({ success: true, valid: true, isMainPassword: false });
  } catch (error) {
    console.error('Error validating temporary password:', error);
    res.json({ success: true, valid: false });
  }
}));

// POST /api/pump - Update pump status manually
router.post('/pump', validatePumpPassword, asyncHandler(async (req, res) => {
  const { is_on } = req.body;
  
  if (is_on === undefined || typeof is_on !== 'boolean') {
    return res.status(400).json({ error: 'Invalid data: is_on is required and must be a boolean' });
  }
  
  const pool = db.getPool();
  await pool.query('INSERT INTO pump_status (is_on, auto_mode) SELECT ?, auto_mode FROM pump_status ORDER BY id DESC LIMIT 1', [is_on]);
  
  res.json({ success: true, is_on });
}));

// POST /api/auto - Toggle auto mode
router.post('/auto', validatePumpPassword, asyncHandler(async (req, res) => {
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
    tank_height_cm: TANK_HEIGHT_CM,
    refresh_interval_ms: REFRESH_INTERVAL_MS
  });
});

// Temporary Password Management Routes (requires main password)

// GET /api/temp-passwords - Get all temporary passwords
router.get('/temp-passwords', validateMainPassword, asyncHandler(async (req, res) => {
  const pool = db.getPool();
  const [rows] = await pool.query(
    'SELECT id, password, expires_at, created_at, created_by FROM temporary_passwords ORDER BY created_at DESC'
  );
  
  // Clean up expired passwords
  const now = new Date();
  const expiredIds = rows.filter(row => isPasswordExpired(row.expires_at)).map(row => row.id);
  if (expiredIds.length > 0) {
    await pool.query('DELETE FROM temporary_passwords WHERE id IN (?)', [expiredIds]);
  }
  
  // Return non-expired passwords
  const validPasswords = rows.filter(row => !isPasswordExpired(row.expires_at));
  res.json({ success: true, passwords: validPasswords });
}));

// POST /api/temp-passwords/list - Get all temporary passwords (alternative endpoint for frontend)
router.post('/temp-passwords/list', validateMainPassword, asyncHandler(async (req, res) => {
  const pool = db.getPool();
  const [rows] = await pool.query(
    'SELECT id, password, expires_at, created_at, created_by FROM temporary_passwords ORDER BY created_at DESC'
  );
  
  // Clean up expired passwords
  const now = new Date();
  const expiredIds = rows.filter(row => isPasswordExpired(row.expires_at)).map(row => row.id);
  if (expiredIds.length > 0) {
    await pool.query('DELETE FROM temporary_passwords WHERE id IN (?)', [expiredIds]);
  }
  
  // Return non-expired passwords
  const validPasswords = rows.filter(row => !isPasswordExpired(row.expires_at));
  res.json({ success: true, passwords: validPasswords });
}));

// POST /api/temp-passwords - Create new temporary password
router.post('/temp-passwords', validateMainPassword, asyncHandler(async (req, res) => {
  const { newPassword, expirationMinutes } = req.body;
  const password = newPassword;
  
  if (!password || password.trim().length < 3) {
    return res.status(400).json({ error: 'Password must be at least 3 characters long' });
  }
  
  if (password === process.env.PUMP_CONTROL_PASSWORD) {
    return res.status(400).json({ error: 'Temporary password cannot be the same as main password' });
  }
  
  let expiresAt = null;
  if (expirationMinutes && expirationMinutes > 0) {
    expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
  }
  
  const pool = db.getPool();
  
  // Check if password already exists
  const [existing] = await pool.query('SELECT id FROM temporary_passwords WHERE password = ?', [password]);
  if (existing.length > 0) {
    return res.status(400).json({ error: 'This password already exists' });
  }
  
  await pool.query(
    'INSERT INTO temporary_passwords (password, expires_at) VALUES (?, ?)',
    [password, expiresAt]
  );
  
  res.json({ success: true, message: 'Temporary password created successfully' });
}));

// DELETE /api/temp-passwords/:id - Delete temporary password
router.delete('/temp-passwords/:id', validateMainPassword, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid password ID' });
  }
  
  const pool = db.getPool();
  const [result] = await pool.query('DELETE FROM temporary_passwords WHERE id = ?', [parseInt(id)]);
  
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Password not found' });
  }
  
  res.json({ success: true, message: 'Temporary password deleted successfully' });
}));

module.exports = router; 