const db = require('../db');

async function migrateTemporaryPasswords() {
  const pool = db.getPool();
  
  if (!pool) {
    console.error('❌ Database not initialized. Please start the main application first.');
    process.exit(1);
  }

  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Starting temporary passwords table migration...');
    
    // Check if nickname column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'temporary_passwords' 
      AND COLUMN_NAME = 'nickname'
    `);
    
    if (columns.length === 0) {
      // Add nickname column
      await connection.query(`
        ALTER TABLE temporary_passwords 
        ADD COLUMN nickname VARCHAR(100) NOT NULL DEFAULT 'Unnamed Password'
      `);
      console.log('✅ Added nickname column to temporary_passwords table');
      
      // Update existing records with default nicknames
      const [existingPasswords] = await connection.query('SELECT id FROM temporary_passwords');
      if (existingPasswords.length > 0) {
        for (let i = 0; i < existingPasswords.length; i++) {
          await connection.query(
            'UPDATE temporary_passwords SET nickname = ? WHERE id = ?', 
            [`Temp Password ${i + 1}`, existingPasswords[i].id]
          );
        }
        console.log(`✅ Updated ${existingPasswords.length} existing password(s) with default nicknames`);
      }
    } else {
      console.log('ℹ️ Nickname column already exists, skipping addition');
    }
    
    // Check if we need to hash existing plain text passwords
    const [plainTextPasswords] = await connection.query(`
      SELECT id, password, nickname FROM temporary_passwords 
      WHERE password NOT LIKE '$2b$%'
    `);
    
    if (plainTextPasswords.length > 0) {
      console.log(`⚠️ Found ${plainTextPasswords.length} plain text password(s) that need to be hashed`);
      console.log('🔄 Converting plain text passwords to bcrypt hashes...');
      
      const bcrypt = require('bcrypt');
      
      for (const row of plainTextPasswords) {
        const hashedPassword = await bcrypt.hash(row.password, 12);
        await connection.query(
          'UPDATE temporary_passwords SET password = ? WHERE id = ?',
          [hashedPassword, row.id]
        );
        console.log(`   ✅ Hashed password for "${row.nickname}" (ID: ${row.id})`);
      }
      
      console.log('✅ All temporary passwords have been hashed successfully!');
    } else {
      console.log('ℹ️ All temporary passwords are already hashed, no conversion needed');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   • Added nickname column for better password management');
    console.log('   • Converted all plain text passwords to bcrypt hashes');
    console.log('   • Temporary passwords are now secure and identifiable');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;  
  } finally {
    connection.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  const dbModule = require('../db');
  
  (async () => {
    try {
      console.log('🚀 Initializing database connection...');
      await dbModule.init();
      await migrateTemporaryPasswords();
      process.exit(0);
    } catch (error) {
      console.error('❌ Migration error:', error);
      process.exit(1);
    }
  })();
}

module.exports = { migrateTemporaryPasswords }; 