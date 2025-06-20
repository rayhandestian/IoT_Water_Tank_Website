import { useState, useEffect } from 'react';
import axios from 'axios';
import Switch from 'react-switch';
import './App.css';
import WaterLevelChart from './components/WaterLevelChart';

function App() {
  const [data, setData] = useState({
    level_cm: 0,
    timestamp: new Date().toISOString(),
    pump_on: false,
    auto_mode: true,
    tank_height_cm: 100, // Default value, will be updated from API
    refresh_interval_ms: 5000, // Default value, will be updated from API
    max_history_minutes_ago: 60 // Default value, will be updated from API
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
  const [expirationMinutes, setExpirationMinutes] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Fetch latest data from the API
  const fetchData = async () => {
    try {
      const response = await axios.get('/api/latest');
      setData(response.data);
      setError(null);
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

    try {
      await axios.post('/api/temp-passwords', {
        password: password, // Main password for auth
        newPassword: newPassword, // The new temporary password
        expirationMinutes: expirationMinutes ? parseInt(expirationMinutes) : null
      });
      
      setNewPassword('');
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
  }, [data.refresh_interval_ms]); // Re-create interval when refresh_interval_ms changes

  // Calculate water level percentage based on tank height from API
  const calculateWaterHeight = () => {
    const tankHeight = data.tank_height_cm;
    const percentage = (data.level_cm / tankHeight) * 100;
    return Math.min(percentage, 100) + '%';
  };

  // Toggle history chart visibility
  const toggleHistory = () => {
    setShowHistory(!showHistory);
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
                {data.level_cm.toFixed(1)} cm / {data.tank_height_cm} cm
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
                Water Level History
              </h2>
              <WaterLevelChart 
                tankHeight={data.tank_height_cm} 
                maxHistoryMinutesAgo={data.max_history_minutes_ago}
                refreshIntervalMs={data.refresh_interval_ms}
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
                          <span className="password-text">{pwd.password}</span>
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