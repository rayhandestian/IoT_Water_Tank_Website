const mysql = require('mysql2/promise');

// Database connection pool
let pool;

const createTables = async () => {
  const connection = await pool.getConnection();
  try {
    // Create sensor_data table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level_cm FLOAT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create encrypted_sensor_data table for encrypted mode
    await connection.query(`
      CREATE TABLE IF NOT EXISTS encrypted_sensor_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        encrypted_level VARCHAR(255) NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create pump_status table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pump_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        is_on BOOLEAN NOT NULL,
        auto_mode BOOLEAN NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create temporary_passwords table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS temporary_passwords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        password VARCHAR(255) NOT NULL,
        nickname VARCHAR(100) NOT NULL DEFAULT 'Unnamed Password',
        expires_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100) DEFAULT 'admin'
      )
    `);

    // Check if pump_status has data, if not seed with default values
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM pump_status');
    if (rows[0].count === 0) {
      await connection.query(`
        INSERT INTO pump_status (is_on, auto_mode) 
        VALUES (false, true)
      `);
      console.log('Inserted default pump status');
    }
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// Try to connect with retry logic
const connectWithRetry = async (retries = 5, delay = 5000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'smart_tank',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 30000 // Longer timeout
      });

      // Test connection
      const connection = await pool.getConnection();
      console.log('MySQL connection established');
      connection.release();
      
      return pool;
    } catch (error) {
      lastError = error;
      console.error(`MySQL connection attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt < retries) {
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to connect to MySQL after ${retries} attempts: ${lastError.message}`);
};

// Initialize database connection
const init = async () => {
  try {
    await connectWithRetry();

    // Create tables if they don't exist
    await createTables();
    console.log('Database tables ready');
    
    return pool;
  } catch (error) {
    console.error('MySQL initialization error:', error);
    
    // Continue with a mock database for development
    console.log('Starting with mock database in memory');
    pool = createMockPool();
    return pool;
  }
};

// Mock database for development when connection fails
const createMockPool = () => {
  console.log('Using in-memory mock database');
  
  const mockData = {
    sensor_data: [
      {
        id: 1,
        level_cm: 75.5,
        timestamp: new Date(Date.now() - 86400000) // 24 hours ago
      },
      {
        id: 2,
        level_cm: 70.2,
        timestamp: new Date(Date.now() - 72000000) // 20 hours ago
      },
      {
        id: 3,
        level_cm: 65.8,
        timestamp: new Date(Date.now() - 57600000) // 16 hours ago
      },
      {
        id: 4,
        level_cm: 60.3,
        timestamp: new Date(Date.now() - 43200000) // 12 hours ago
      },
      {
        id: 5,
        level_cm: 55.7,
        timestamp: new Date(Date.now() - 28800000) // 8 hours ago
      },
      {
        id: 6,
        level_cm: 50.2,
        timestamp: new Date(Date.now() - 14400000) // 4 hours ago
      },
      {
        id: 7,
        level_cm: 45.0,
        timestamp: new Date(Date.now() - 7200000)  // 2 hours ago
      },
      {
        id: 8,
        level_cm: 75.5,
        timestamp: new Date()
      }
    ],
    encrypted_sensor_data: [
      {
        id: 1,
        encrypted_level: "4D5E2F1A3B",
        timestamp: new Date(Date.now() - 86400000)
      },
      {
        id: 2,
        encrypted_level: "4A5B2E193C",
        timestamp: new Date(Date.now() - 72000000)
      }
    ],
    pump_status: [{
      id: 1,
      is_on: false,
      auto_mode: true,
      timestamp: new Date()
    }],
    temporary_passwords: []
  };
  
  return {
    async query(sql, params) {
      console.log('Mock DB query:', sql);
      
      if (sql.includes('INSERT INTO sensor_data')) {
        const level_cm = params[0];
        const newRecord = {
          id: mockData.sensor_data.length + 1,
          level_cm,
          timestamp: new Date()
        };
        mockData.sensor_data.push(newRecord);
        return [{ insertId: newRecord.id }];
      }
      
      if (sql.includes('INSERT INTO encrypted_sensor_data')) {
        const encrypted_level = params[0];
        const newRecord = {
          id: mockData.encrypted_sensor_data.length + 1,
          encrypted_level,
          timestamp: new Date()
        };
        mockData.encrypted_sensor_data.push(newRecord);
        return [{ insertId: newRecord.id }];
      }
      
      if (sql.includes('INSERT INTO pump_status')) {
        const is_on = params[0];
        const auto_mode = params[1] !== undefined ? params[1] : mockData.pump_status[0].auto_mode;
        const newRecord = {
          id: mockData.pump_status.length + 1,
          is_on,
          auto_mode,
          timestamp: new Date()
        };
        mockData.pump_status.push(newRecord);
        return [{ insertId: newRecord.id }];
      }
      
      if (sql.includes('SELECT') && sql.includes('sensor_data') && sql.includes('ORDER BY id DESC LIMIT 1')) {
        return [mockData.sensor_data.slice(-1)];
      }
      
      if (sql.includes('SELECT') && sql.includes('encrypted_sensor_data') && sql.includes('ORDER BY id DESC LIMIT 1')) {
        return [mockData.encrypted_sensor_data.slice(-1)];
      }
      
      if (sql.includes('SELECT') && sql.includes('sensor_data') && sql.includes('ORDER BY timestamp DESC LIMIT')) {
        const limit = params[0] || 24;
        return [mockData.sensor_data.slice(-limit).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))];
      }
      
      if (sql.includes('SELECT') && sql.includes('encrypted_sensor_data') && sql.includes('ORDER BY timestamp DESC LIMIT')) {
        const limit = params[0] || 24;
        return [mockData.encrypted_sensor_data.slice(-limit).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))];
      }
      
      if (sql.includes('SELECT') && sql.includes('pump_status')) {
        return [mockData.pump_status.slice(-1)];
      }
      
      if (sql.includes('INSERT INTO temporary_passwords')) {
        const password = params[0];
        const nickname = params[1];
        const expiresAt = params[2];
        const newRecord = {
          id: mockData.temporary_passwords.length + 1,
          password,
          nickname: nickname || 'Unnamed Password',
          expires_at: expiresAt,
          created_at: new Date(),
          created_by: 'admin'
        };
        mockData.temporary_passwords.push(newRecord);
        return [{ insertId: newRecord.id }];
      }
      
      if (sql.includes('SELECT') && sql.includes('temporary_passwords')) {
        if (sql.includes('WHERE password = ?')) {
          const password = params[0];
          return [mockData.temporary_passwords.filter(p => p.password === password)];
        }
        if (sql.includes('WHERE nickname = ?')) {
          const nickname = params[0];
          return [mockData.temporary_passwords.filter(p => p.nickname === nickname)];
        }
        return [mockData.temporary_passwords];
      }
      
      if (sql.includes('DELETE FROM temporary_passwords')) {
        if (sql.includes('WHERE id = ?')) {
          const id = params[0];
          const index = mockData.temporary_passwords.findIndex(p => p.id === id);
          if (index !== -1) {
            mockData.temporary_passwords.splice(index, 1);
            return [{ affectedRows: 1 }];
          }
          return [{ affectedRows: 0 }];
        }
        if (sql.includes('WHERE id IN (?)')) {
          const ids = params[0];
          let affected = 0;
          ids.forEach(id => {
            const index = mockData.temporary_passwords.findIndex(p => p.id === id);
            if (index !== -1) {
              mockData.temporary_passwords.splice(index, 1);
              affected++;
            }
          });
          return [{ affectedRows: affected }];
        }
      }
      
      return [[]];
    },
    async getConnection() {
      return {
        query: async (...args) => this.query(...args),
        release: () => {}
      };
    }
  };
};

module.exports = {
  init,
  getPool: () => pool
}; 