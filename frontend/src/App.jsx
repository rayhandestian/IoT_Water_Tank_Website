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
    tank_height_cm: 100 // Default value, will be updated from API
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

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

  // Toggle pump status
  const togglePump = async (checked) => {
    try {
      await axios.post('/api/pump', { is_on: checked });
      setData(prev => ({ ...prev, pump_on: checked }));
    } catch (err) {
      console.error('Error toggling pump:', err);
      setError('Failed to toggle pump. Please try again.');
      // Revert UI state on error
      fetchData();
    }
  };

  // Toggle auto mode
  const toggleAutoMode = async (checked) => {
    try {
      await axios.post('/api/auto', { auto_mode: checked });
      setData(prev => ({ ...prev, auto_mode: checked }));
    } catch (err) {
      console.error('Error toggling auto mode:', err);
      setError('Failed to toggle auto mode. Please try again.');
      // Revert UI state on error
      fetchData();
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
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

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
              <h2 className="card-title">Water Level</h2>
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
              <button 
                className="history-button" 
                onClick={toggleHistory}
              >
                {showHistory ? 'Hide History' : 'Show History'}
              </button>
            </div>

            <div className="card">
              <h2 className="card-title">Pump Controls</h2>
              <div className="controls">
                <div className="control-item">
                  <span className="switch-label">Auto Mode</span>
                  <Switch
                    checked={data.auto_mode}
                    onChange={toggleAutoMode}
                    onColor="#86d3ff"
                    onHandleColor="#2693e6"
                    handleDiameter={30}
                    uncheckedIcon={false}
                    checkedIcon={false}
                    boxShadow="0px 1px 5px rgba(0, 0, 0, 0.6)"
                    activeBoxShadow="0px 0px 1px 10px rgba(0, 0, 0, 0.2)"
                    height={20}
                    width={48}
                  />
                </div>
                
                <div className="control-item">
                  <span className="switch-label">Manual Pump Control</span>
                  <Switch
                    checked={data.pump_on}
                    onChange={togglePump}
                    disabled={data.auto_mode}
                    onColor="#86d3ff"
                    onHandleColor="#2693e6"
                    handleDiameter={30}
                    uncheckedIcon={false}
                    checkedIcon={false}
                    boxShadow="0px 1px 5px rgba(0, 0, 0, 0.6)"
                    activeBoxShadow="0px 0px 1px 10px rgba(0, 0, 0, 0.2)"
                    height={20}
                    width={48}
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
              <h2 className="card-title">Water Level History</h2>
              <WaterLevelChart tankHeight={data.tank_height_cm} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App; 