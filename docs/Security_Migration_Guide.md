# Security Migration Guide

This guide explains the enhanced security features implemented in the IoT Water Tank Website, including bcrypt password hashing for both the master password and temporary passwords.

## 🔐 Security Improvements

### Master Password Security
- **Before**: Master password stored as plain text in `.env` file
- **After**: Master password stored as bcrypt hash with 12 salt rounds
- **Benefit**: Even if the `.env` file is compromised, the actual password cannot be recovered

### Temporary Password Security  
- **Before**: Temporary passwords stored as plain text in database
- **After**: Temporary passwords hashed with bcrypt and identified by nicknames
- **Benefit**: Database compromise doesn't reveal actual passwords

## 🚀 Migration Steps

### Step 1: Update Master Password

1. **Generate bcrypt hash for your master password:**
   ```bash
   # Interactive mode
   npm run hash-password
   
   # Command line mode  
   node utils/hash-password.js "your-actual-password"
   ```

2. **Update your `.env` file:**
   ```env
   # Replace this line:
   PUMP_CONTROL_PASSWORD=yourplaintextpassword
   
   # With the generated hash:
   PUMP_CONTROL_PASSWORD=$2b$12$your.generated.hash.here
   ```

3. **Restart your server**

### Step 2: Migrate Temporary Passwords  

1. **Run the migration script:**
   ```bash
   npm run migrate-temp-passwords
   ```
   
   This will:
   - Add a `nickname` column to the temporary_passwords table
   - Convert all existing plain text passwords to bcrypt hashes
   - Assign default nicknames to existing passwords

2. **Verify migration success**
   - Check that the script completes without errors
   - Log into your dashboard and verify temporary passwords show nicknames instead of plain text

## 📋 New Features

### Password Nicknames
- Every temporary password now requires a nickname/description
- Nicknames help identify passwords since the actual password is no longer visible
- Maximum 100 characters per nickname
- Must be unique

### Enhanced Password Management
- **Create Password**: Requires nickname, actual password, and optional expiration
- **View Passwords**: Shows nickname, expiration, and creation date (not the actual password)
- **Security**: All passwords are bcrypt hashed with 12 salt rounds

## 🔧 Usage Examples

### Creating Temporary Passwords
```
Nickname: "John's Weekend Access"
Password: "weekend123"
Expiration: 2880 minutes (48 hours)
```

### Password Authentication
- Users still enter their actual passwords
- System compares entered password against stored hash using bcrypt
- No change needed in user behavior

## ⚠️ Important Notes

### Backup Considerations
- **Before migration**: Keep a backup of your database
- **Password recovery**: Store actual passwords securely - hashes cannot be reversed
- **Master password**: If you forget it, you'll need to generate a new hash

### Database Changes
- New column: `temporary_passwords.nickname`
- Modified: All password fields now contain bcrypt hashes
- Compatible: Works with both new installations and migrated databases

### Development vs Production
- Migration script works with both real MySQL and mock database
- Development environment uses in-memory mock data
- Production migration requires database connectivity

## 🔍 Troubleshooting

### Migration Issues
```bash
# If migration fails, check:
1. Database connectivity
2. Proper permissions for ALTER TABLE
3. Existing data integrity

# Re-run migration (safe to run multiple times):
npm run migrate-temp-passwords
```

### Hash Generation Issues
```bash
# If hash generation fails:
1. Ensure bcrypt is installed: npm install bcrypt
2. Check Node.js version compatibility
3. Verify script permissions
```

### Authentication Problems
```bash
# If authentication fails after migration:
1. Verify .env hash is correctly formatted
2. Check that server restarted after .env update
3. Test with a newly generated hash
```

## 📚 Technical Details

### Bcrypt Configuration
- **Salt Rounds**: 12 (good balance of security and performance)
- **Hash Format**: Standard bcrypt format ($2b$12$...)
- **Validation**: Uses `bcrypt.compare()` for secure comparison

### Database Schema Updates
```sql
-- New column added:
ALTER TABLE temporary_passwords 
ADD COLUMN nickname VARCHAR(100) NOT NULL DEFAULT 'Unnamed Password';

-- Password field still VARCHAR(255) but now contains hashes
```

### Security Considerations
- **No plain text storage**: All passwords hashed before database storage
- **Salt per password**: Each password gets unique salt
- **Timing attack resistant**: bcrypt comparison prevents timing attacks
- **Future proof**: Easy to increase salt rounds if needed

## 🎯 Best Practices

### Master Password
- Use a strong, unique password
- Store it securely (password manager)
- Change periodically and regenerate hash

### Temporary Passwords  
- Use descriptive nicknames
- Set appropriate expiration times
- Regular cleanup of expired passwords
- Monitor password usage in logs

### Environment Security
- Protect `.env` file access
- Use proper file permissions (600)
- Keep .env out of version control
- Regularly audit environment variables 