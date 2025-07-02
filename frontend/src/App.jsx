import { useState, useEffect } from 'react';
import axios from 'axios';
import Switch from 'react-switch';
import './App.css';
import WaterLevelChart from './components/WaterLevelChart';
import { decryptWaterLevel, getAlgorithmInfo, testAlgorithms } from './utils/crypto';

function App() {
  const [data, setData] = useState({
    level_cm: 0,
    timestamp: new Date().toISOString(),
    pump_on: false,
    auto_mode: true,
    tank_height_cm: 100, // Default value, will be updated from API
    refresh_interval_ms: 5000, // Default value, will be updated from API
    max_history_minutes_ago: 60, // Default value, will be updated from API
    encrypted_mode: false,
    encrypted_level: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMainPassword, setIsMainPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPasswordManager, setShowPasswordManager] = useState(false);
  const [tempPasswords, setTempPasswords] = useState([]);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordNickname, setNewPasswordNickname] = useState('');
  const [expirationMinutes, setExpirationMinutes] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Encrypted mode states
  const [encryptedMode, setEncryptedMode] = useState(false);
  const [decryptionKey, setDecryptionKey] = useState('');
  const [showDecryptionKey, setShowDecryptionKey] = useState(false);
  const [decryptedLevel, setDecryptedLevel] = useState(null);
  const [decryptionError, setDecryptionError] = useState('');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('AUTO');
  const [detectedAlgorithm, setDetectedAlgorithm] = useState('');
  const [showAlgorithmTest, setShowAlgorithmTest] = useState(false);

  // Unified decryption function using crypto utilities
  const performDecryption = (encryptedHex, key, algorithm = 'AUTO') => {
    const result = decryptWaterLevel(encryptedHex, key, algorithm);
    
    if (result.success) {
      setDetectedAlgorithm(result.algorithm);
      return result.value;
    } else {
      setDetectedAlgorithm('');
      return null;
    }
  };

  // Handle decryption key changes
  const handleDecryptionKeyChange = (key) => {
    setDecryptionKey(key);
    setDecryptionError('');
    
    if (key && data.encrypted_level) {
      const decrypted = performDecryption(data.encrypted_level, key, selectedAlgorithm);
      if (decrypted !== null) {
        setDecryptedLevel(decrypted);
        setDecryptionError('');
      } else {
        setDecryptedLevel(null);
        setDecryptionError('Invalid decryption key, corrupted data, or wrong algorithm');
      }
    } else {
      setDecryptedLevel(null);
    }
  };

  // Handle algorithm selection changes
  const handleAlgorithmChange = (algorithm) => {
    setSelectedAlgorithm(algorithm);
    setDetectedAlgorithm('');
    
    // Re-decrypt with new algorithm if we have data and key
    if (decryptionKey && data.encrypted_level) {
      const decrypted = performDecryption(data.encrypted_level, decryptionKey, algorithm);
      if (decrypted !== null) {
        setDecryptedLevel(decrypted);
        setDecryptionError('');
      } else {
        setDecryptedLevel(null);
        setDecryptionError('Invalid decryption key, corrupted data, or wrong algorithm');
      }
    }
  };

  // Fetch latest data from the API
  const fetchData = async () => {
    try {
      const response = await axios.get('/api/latest', {
        params: { encrypted: encryptedMode }
      });
      setData(response.data);
      setError(null);
      
      // Handle encrypted data decryption
      if (encryptedMode && response.data.encrypted_level && decryptionKey) {
        const decrypted = performDecryption(response.data.encrypted_level, decryptionKey, selectedAlgorithm);
        if (decrypted !== null) {
          setDecryptedLevel(decrypted);
          setDecryptionError('');
        } else {
          setDecryptedLevel(null);
          setDecryptionError('Invalid decryption key, corrupted data, or wrong algorithm');
        }
      } else if (!encryptedMode) {
        setDecryptedLevel(null);
        setDecryptionError('');
        setDetectedAlgorithm('');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Validate password
  const validatePassword = async () => {
    if (!password.trim()) {
      setAuthError('Please enter a password');
      return;
    }
    
    try {
      const response = await axios.post('/api/validate-password', { password });
      if (response.data.valid) {
        setIsAuthenticated(true);
        setIsMainPassword(response.data.isMainPassword || false);
        setAuthError('');
      } else {
        setAuthError('Invalid password');
        setPassword('');
      }
    } catch (err) {
      console.error('Error validating password:', err);
      setAuthError('Failed to validate password. Please try again.');
    }
  };

  // Toggle pump status
  const togglePump = async (checked) => {
    if (!isAuthenticated) {
      setError('Please authenticate first to control the pump.');
      return;
    }

    try {
      await axios.post('/api/pump', { is_on: checked, password });
      setData(prev => ({ ...prev, pump_on: checked }));
    } catch (err) {
      console.error('Error toggling pump:', err);
      if (err.response?.status === 401) {
        setError('Authentication failed. Please re-enter your password.');
        setIsAuthenticated(false);
      } else {
        setError('Failed to toggle pump. Please try again.');
      }
      // Revert UI state on error
      fetchData();
    }
  };

  // Toggle auto mode
  const toggleAutoMode = async (checked) => {
    if (!isAuthenticated) {
      setError('Please authenticate first to control the pump.');
      return;
    }

    try {
      await axios.post('/api/auto', { auto_mode: checked, password });
      setData(prev => ({ ...prev, auto_mode: checked }));
    } catch (err) {
      console.error('Error toggling auto mode:', err);
      if (err.response?.status === 401) {
        setError('Authentication failed. Please re-enter your password.');
        setIsAuthenticated(false);
      } else {
        setError('Failed to toggle auto mode. Please try again.');
      }
      // Revert UI state on error
      fetchData();
    }
  };

  // Handle password input keypress
  const handlePasswordKeyPress = (e) => {
    if (e.key === 'Enter') {
      validatePassword();
    }
  };

  // Fetch temporary passwords
  const fetchTempPasswords = async () => {
    if (!isMainPassword) return;
    
    try {
      const response = await axios.post('/api/temp-passwords/list', {
        password: password
      });
      setTempPasswords(response.data.passwords);
    } catch (err) {
      console.error('Error fetching temporary passwords:', err);
      setError('Failed to fetch temporary passwords.');
    }
  };

  // Create temporary password
  const createTempPassword = async () => {
    if (!newPassword.trim()) {
      setPasswordError('Please enter a password');
      return;
    }

    if (newPassword.length < 3) {
      setPasswordError('Password must be at least 3 characters long');
      return;
    }

    if (!newPasswordNickname.trim()) {
      setPasswordError('Please enter a nickname for this password');
      return;
    }

    if (newPasswordNickname.trim().length > 100) {
      setPasswordError('Nickname must be 100 characters or less');
      return;
    }

    try {
      await axios.post('/api/temp-passwords', {
        password: password, // Main password for auth
        newPassword: newPassword, // The new temporary password
        nickname: newPasswordNickname.trim(), // Nickname for the password
        expirationMinutes: expirationMinutes ? parseInt(expirationMinutes) : null
      });
      
      setNewPassword('');
      setNewPasswordNickname('');
      setExpirationMinutes('');
      setPasswordError('');
      fetchTempPasswords();
    } catch (err) {
      console.error('Error creating temporary password:', err);
      setPasswordError(err.response?.data?.error || 'Failed to create password');
    }
  };

  // Delete temporary password
  const deleteTempPassword = async (id) => {
    try {
      await axios.delete(`/api/temp-passwords/${id}`, {
        data: { password }
      });
      fetchTempPasswords();
    } catch (err) {
      console.error('Error deleting temporary password:', err);
      setError('Failed to delete password.');
    }
  };

  // Format expiration time
  const formatExpiration = (expiresAt) => {
    if (!expiresAt) return 'Permanent';
    const expiration = new Date(expiresAt);
    const now = new Date();
    if (expiration <= now) return 'Expired';
    
    const diffMs = expiration - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m remaining`;
    } else {
      return `${diffMins}m remaining`;
    }
  };

  // Format timestamp to local date and time
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Set up polling interval
  useEffect(() => {
    fetchData();
    
    const interval = setInterval(() => {
      fetchData();
    }, data.refresh_interval_ms); // Use refresh interval from API
    
    return () => clearInterval(interval);
  }, [data.refresh_interval_ms, encryptedMode, decryptionKey, selectedAlgorithm]); // Re-create interval when encrypted mode, key, or algorithm changes

  // Calculate water level percentage based on tank height from API
  const calculateWaterHeight = () => {
    const tankHeight = data.tank_height_cm;
    let currentLevel = data.level_cm || 0; // Default to 0 if undefined/null
    
    // Use decrypted level if in encrypted mode
    if (encryptedMode && decryptedLevel !== null) {
      currentLevel = decryptedLevel;
    } else if (encryptedMode && !decryptedLevel) {
      // No valid decrypted data
      return '0%';
    }
    
    const percentage = (currentLevel / tankHeight) * 100;
    return Math.min(percentage, 100) + '%';
  };

  // Toggle history chart visibility
  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  // Toggle encrypted mode
  const toggleEncryptedMode = (checked) => {
    setEncryptedMode(checked);
    setDecryptionKey('');
    setDecryptedLevel(null);
    setDecryptionError('');
    setDetectedAlgorithm('');
    setShowDecryptionKey(checked);
    setShowAlgorithmTest(false);
    
    // Immediately fetch data for the new mode to prevent blank page
    setTimeout(() => {
      fetchData();
    }, 100);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Smart Water Tank Monitor</h1>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <>
          <div className="dashboard">
            <div className="card">
              <h2 className="card-title">
                <span className="icon-water">💧</span>
                Water Level
              </h2>
              
              {/* Encrypted Mode Toggle */}
              <div className="encrypted-mode-section">
                <div className="control-item">
                  <span className="switch-label">🔐 Encrypted Data Mode</span>
                  <Switch
                    checked={encryptedMode}
                    onChange={toggleEncryptedMode}
                    onColor="#8b5cf6"
                    onHandleColor="#ffffff"
                    handleDiameter={28}
                    uncheckedIcon={false}
                    checkedIcon={false}
                    boxShadow="0px 2px 4px rgba(0, 0, 0, 0.1)"
                    activeBoxShadow="0px 0px 0px 3px rgba(139, 92, 246, 0.2)"
                    height={22}
                    width={50}
                    className="custom-switch"
                  />
                </div>
                
                {encryptedMode && (
                  <div className="decryption-section">
                    {/* Algorithm Selection */}
                    <div className="algorithm-selection">
                      <label className="algorithm-label">🔍 Algorithm:</label>
                      <select 
                        value={selectedAlgorithm} 
                        onChange={(e) => handleAlgorithmChange(e.target.value)}
                        className="algorithm-select"
                      >
                        <option value="AUTO">Auto-Detect</option>
                        <option value="DES">DES (Data Encryption Standard)</option>
                        <option value="XOR">XOR (Simple Cipher)</option>
                      </select>
                      <button 
                        onClick={() => setShowAlgorithmTest(!showAlgorithmTest)}
                        className="test-algorithm-button"
                        type="button"
                      >
                        {showAlgorithmTest ? '📚 Hide Info' : '📚 Learn More'}
                      </button>
                    </div>

                    {/* Algorithm Information */}
                    {showAlgorithmTest && (
                      <div className="algorithm-info">
                        {['XOR', 'DES'].map(alg => {
                          const info = getAlgorithmInfo(alg);
                          return (
                            <div key={alg} className="algorithm-card" style={{borderColor: info.color}}>
                              <div className="algorithm-header">
                                <span className="algorithm-emoji">{info.emoji}</span>
                                <span className="algorithm-name">{info.name}</span>
                              </div>
                              <div className="algorithm-details">
                                <div>📝 {info.description}</div>
                                <div>🔐 Security: {info.security}</div>
                                <div>🔑 Key Size: {info.keySize}</div>
                                <div>📦 Block Size: {info.blockSize}</div>
                              </div>
                            </div>
                          );
                                                 })}
                       </div>
                    )}

                    <div className="decryption-key-input">
                      <input
                        type={showDecryptionKey ? "text" : "password"}
                        placeholder="Enter decryption key"
                        value={decryptionKey}
                        onChange={(e) => handleDecryptionKeyChange(e.target.value)}
                        className="key-input"
                      />
                      <button 
                        onClick={() => setShowDecryptionKey(!showDecryptionKey)}
                        className="show-key-button"
                        type="button"
                      >
                        {showDecryptionKey ? '🙈' : '👁️'}
                      </button>
                    </div>
                    
                    {detectedAlgorithm && (
                      <div className="detected-algorithm">
                        <span className="detected-label">✅ Detected Algorithm:</span>
                        <span className="detected-value" style={{color: getAlgorithmInfo(detectedAlgorithm).color}}>
                          {getAlgorithmInfo(detectedAlgorithm).emoji} {getAlgorithmInfo(detectedAlgorithm).name}
                        </span>
                      </div>
                    )}
                    
                    {decryptionError && (
                      <div className="decryption-error">
                        {decryptionError}
                      </div>
                    )}
                    
                    {encryptedMode && data.encrypted_level && (
                      <div className="encrypted-data-info">
                        <span className="encrypted-label">Encrypted:</span>
                        <span className="encrypted-value">{data.encrypted_level}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="tank-container">
                <div className="tank">
                  <div 
                    className="water"
                    style={{ height: calculateWaterHeight() }}
                  ></div>
                  <div className="water-mark" style={{ bottom: '25%' }}>
                    <span>25%</span>
                  </div>
                  <div className="water-mark" style={{ bottom: '50%' }}>
                    <span>50%</span>
                  </div>
                  <div className="water-mark" style={{ bottom: '75%' }}>
                    <span>75%</span>
                  </div>
                </div>
              </div>
              <div className="water-level">
                {encryptedMode ? (
                  decryptedLevel !== null ? (
                    `${decryptedLevel.toFixed(1)} cm / ${data.tank_height_cm} cm (Decrypted)`
                  ) : (
                    `??? cm / ${data.tank_height_cm} cm (Encrypted - Enter Key)`
                  )
                ) : (
                  `${(data.level_cm || 0).toFixed(1)} cm / ${data.tank_height_cm} cm`
                )}
              </div>
              <div className="timestamp">
                Last updated: {formatTimestamp(data.timestamp)}
              </div>
              <div className="refresh-info">
                Refresh interval: {data.refresh_interval_ms / 1000} seconds
              </div>
              <button 
                className="history-button" 
                onClick={toggleHistory}
              >
                {showHistory ? 'Hide History' : 'Show History'}
              </button>
            </div>

            <div className="card">
              <h2 className="card-title">
                <span className="icon-pump">⚙️</span>
                Pump Control
              </h2>
              
              {!isAuthenticated && (
                <div className="auth-section">
                  <div className="password-input-container">
                    <input
                      type="password"
                      placeholder="Enter password to control pump"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handlePasswordKeyPress}
                      className="password-input"
                    />
                    <button 
                      onClick={validatePassword}
                      className="auth-button"
                    >
                      Authenticate
                    </button>
                  </div>
                  {authError && (
                    <div className="auth-error">
                      {authError}
                    </div>
                  )}
                </div>
              )}

              {isAuthenticated && (
                <div className="authenticated-indicator">
                  <div className="indicator-dot status-on"></div>
                  <span>Authenticated - Controls Enabled</span>
                  <div className="auth-buttons">
                    {isMainPassword && (
                      <button 
                        onClick={() => { setShowPasswordManager(true); fetchTempPasswords(); }}
                        className="manage-passwords-button"
                      >
                        Manage Passwords
                      </button>
                    )}
                    <button 
                      onClick={() => { 
                        setIsAuthenticated(false); 
                        setIsMainPassword(false); 
                        setPassword(''); 
                        setShowPasswordManager(false);
                      }}
                      className="logout-button"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}

              <div className="controls">
                <div className="control-item">
                  <span className="switch-label">Auto Mode</span>
                  <Switch
                    checked={data.auto_mode}
                    onChange={toggleAutoMode}
                    disabled={!isAuthenticated}
                    onColor="#3b82f6"
                    onHandleColor="#ffffff"
                    handleDiameter={28}
                    uncheckedIcon={false}
                    checkedIcon={false}
                    boxShadow="0px 2px 4px rgba(0, 0, 0, 0.1)"
                    activeBoxShadow="0px 0px 0px 3px rgba(59, 130, 246, 0.2)"
                    height={22}
                    width={50}
                    className="custom-switch"
                  />
                </div>
                
                <div className="control-item">
                  <span className="switch-label">Manual Pump Control</span>
                  <Switch
                    checked={data.pump_on}
                    onChange={togglePump}
                    disabled={data.auto_mode || !isAuthenticated}
                    onColor="#3b82f6"
                    onHandleColor="#ffffff"
                    handleDiameter={28}
                    uncheckedIcon={false}
                    checkedIcon={false}
                    boxShadow="0px 2px 4px rgba(0, 0, 0, 0.1)"
                    activeBoxShadow="0px 0px 0px 3px rgba(59, 130, 246, 0.2)"
                    height={22}
                    width={50}
                    className="custom-switch"
                  />
                </div>
                
                <div className="status-indicator">
                  <div className={`indicator-dot ${data.pump_on ? 'status-on' : 'status-off'}`}></div>
                  <span>Pump is currently {data.pump_on ? 'ON' : 'OFF'}</span>
                </div>
                
                <div className="status-indicator">
                  <div className={`indicator-dot ${data.auto_mode ? 'status-on' : 'status-off'}`}></div>
                  <span>Auto mode is {data.auto_mode ? 'ENABLED' : 'DISABLED'}</span>
                </div>
              </div>
            </div>
          </div>

          {showHistory && (
            <div className="card history-card">
              <h2 className="card-title">
                <span className="icon-chart">📊</span>
                Water Level History {encryptedMode ? '(Encrypted Mode)' : ''}
              </h2>
              <WaterLevelChart 
                tankHeight={data.tank_height_cm} 
                maxHistoryMinutesAgo={data.max_history_minutes_ago}
                refreshIntervalMs={data.refresh_interval_ms}
                encryptedMode={encryptedMode}
                decryptionKey={decryptionKey}
                selectedAlgorithm={selectedAlgorithm}
              />
            </div>
          )}
        </>
      )}

      {/* Password Manager Modal */}
      {showPasswordManager && (
        <div className="modal-overlay" onClick={() => setShowPasswordManager(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Temporary Passwords</h2>
              <button 
                className="modal-close"
                onClick={() => setShowPasswordManager(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="create-password-section">
                <h3>Create New Password</h3>
                {passwordError && (
                  <div className="password-error">
                    {passwordError}
                  </div>
                )}
                <div className="create-password-form">
                  <input
                    type="text"
                    placeholder="Nickname/description (required)"
                    value={newPasswordNickname}
                    onChange={(e) => setNewPasswordNickname(e.target.value)}
                    className="new-password-input"
                    maxLength="100"
                  />
                  <input
                    type="text"
                    placeholder="New password (min 3 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="new-password-input"
                  />
                  <input
                    type="number"
                    placeholder="Minutes to expire (blank = permanent)"
                    value={expirationMinutes}
                    onChange={(e) => setExpirationMinutes(e.target.value)}
                    className="expiration-input"
                    min="1"
                  />
                  <button 
                    onClick={createTempPassword}
                    className="create-password-button"
                  >
                    Create Password
                  </button>
                </div>
              </div>

              <div className="existing-passwords-section">
                <h3>Existing Temporary Passwords</h3>
                {tempPasswords.length === 0 ? (
                  <p className="no-passwords">No temporary passwords created yet.</p>
                ) : (
                  <div className="passwords-list">
                    {tempPasswords.map((pwd) => (
                      <div key={pwd.id} className="password-item">
                        <div className="password-info">
                          <span className="password-text">🔑 {pwd.nickname}</span>
                          <span className="password-expiry">{formatExpiration(pwd.expires_at)}</span>
                          <span className="password-created">
                            Created: {new Date(pwd.created_at).toLocaleString()}
                          </span>
                        </div>
                        <button 
                          onClick={() => deleteTempPassword(pwd.id)}
                          className="delete-password-button"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 