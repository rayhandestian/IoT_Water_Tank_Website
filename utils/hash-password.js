const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function generateHash() {
  try {
    rl.question('Enter the password to hash: ', async (password) => {
      if (!password || password.trim().length === 0) {
        console.log('❌ Error: Password cannot be empty');
        rl.close();
        return;
      }

      const saltRounds = 12; // Good balance of security and performance
      
      console.log('\n🔄 Generating bcrypt hash...');
      const hash = await bcrypt.hash(password.trim(), saltRounds);
      
      console.log('\n✅ Bcrypt hash generated successfully!');
      console.log('\n📋 Copy this hash to your .env file:');
      console.log('─'.repeat(60));
      console.log(`PUMP_CONTROL_PASSWORD=${hash}`);
      console.log('─'.repeat(60));
      
      console.log('\n📝 Instructions:');
      console.log('1. Copy the hash above');
      console.log('2. Replace the PUMP_CONTROL_PASSWORD value in your .env file');
      console.log('3. Make sure to keep the hash secret and secure');
      console.log('4. Restart your server after updating the .env file');
      
      console.log('\n🔐 Security Notes:');
      console.log('• This hash is irreversible - store the original password safely');
      console.log('• Each time you run this script, a new hash will be generated');
      console.log('• Only the exact password will match this hash');
      
      rl.close();
    });
  } catch (error) {
    console.error('❌ Error generating hash:', error.message);
    rl.close();
  }
}

// Handle command line argument
if (process.argv[2]) {
  const password = process.argv[2];
  
  if (password.trim().length === 0) {
    console.log('❌ Error: Password cannot be empty');
    process.exit(1);
  }
  
  bcrypt.hash(password.trim(), 12)
    .then(hash => {
      console.log('\n✅ Bcrypt hash generated successfully!');
      console.log('\n📋 Copy this hash to your .env file:');
      console.log('─'.repeat(60));
      console.log(`PUMP_CONTROL_PASSWORD=${hash}`);
      console.log('─'.repeat(60));
      
      console.log('\n📝 Instructions:');
      console.log('1. Copy the hash above');
      console.log('2. Replace the PUMP_CONTROL_PASSWORD value in your .env file');
      console.log('3. Make sure to keep the hash secret and secure');
      console.log('4. Restart your server after updating the .env file');
    })
    .catch(error => {
      console.error('❌ Error generating hash:', error.message);
      process.exit(1);
    });
} else {
  console.log('🔐 Password Hash Generator');
  console.log('═'.repeat(40));
  console.log('This script generates a bcrypt hash for your master password.');
  console.log('You can use it in two ways:');
  console.log('1. Interactive mode: node utils/hash-password.js');
  console.log('2. Command line: node utils/hash-password.js "your-password"');
  console.log('');
  
  generateHash();
} 