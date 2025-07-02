import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import axios from 'axios';
import { decryptWaterLevel } from '../utils/crypto';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Hook to detect mobile screen size
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize with current window size to prevent hydration mismatch
    return typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  });
  
  useEffect(() => {
    const checkMobile = () => {
      const newIsMobile = window.innerWidth <= 768;
      setIsMobile(prev => {
        // Only update if the value actually changed to prevent unnecessary re-renders
        return prev !== newIsMobile ? newIsMobile : prev;
      });
    };
    
    // Debounce resize events to prevent excessive re-renders
    let timeoutId;
    const debouncedCheckMobile = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkMobile, 100);
    };
    
    window.addEventListener('resize', debouncedCheckMobile);
    
    return () => {
      window.removeEventListener('resize', debouncedCheckMobile);
      clearTimeout(timeoutId);
    };
  }, []);
  
  return isMobile;
};

const WaterLevelChart = ({ 
  tankHeight, 
  maxHistoryMinutesAgo = 60, 
  refreshIntervalMs = 5000,
  encryptedMode = false,
  decryptionKey = '',
  selectedAlgorithm = 'AUTO'
}) => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [dataStats, setDataStats] = useState({});
  const [decryptedData, setDecryptedData] = useState([]);
  
  // Mobile detection
  const isMobile = useIsMobile();
  
  // Use refs to prevent unnecessary re-renders
  const intervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  
  // Memoized refresh interval (matches environment setting exactly)
  const refreshInterval = useMemo(() => {
    return refreshIntervalMs; // Use exact env setting
  }, [refreshIntervalMs]);

  // Memoized gradient function to prevent recreation on every render
  const createGradient = useCallback((context) => {
    const chart = context.chart;
    const { ctx, chartArea } = chart;
    
    if (!chartArea) {
      return null;
    }
    
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.3)');
    gradient.addColorStop(0.5, 'rgba(37, 99, 235, 0.2)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.05)');
    return gradient;
  }, []);

  // Use crypto utilities for consistent decryption
  const performDecryption = useCallback((encryptedHex, key, algorithm = 'AUTO') => {
    const result = decryptWaterLevel(encryptedHex, key, algorithm);
    return result.success ? result.value : null;
  }, []);

  // Process encrypted data when key changes
  useEffect(() => {
    if (encryptedMode && decryptionKey && historyData.length > 0) {
      const processed = historyData.map(item => {
        if (item.encrypted_level) {
          const decrypted = performDecryption(item.encrypted_level, decryptionKey, selectedAlgorithm);
          return {
            ...item,
            level_cm: decrypted,
            decryption_success: decrypted !== null
          };
        }
        return { ...item, decryption_success: false };
      }).filter(item => item.decryption_success);
      
      setDecryptedData(processed);
    } else {
      setDecryptedData([]);
    }
  }, [historyData, encryptedMode, decryptionKey, selectedAlgorithm, performDecryption]);

  // Fetch history data with error recovery
  const fetchHistoryData = useCallback(async (isRetry = false) => {
    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      if (!isRetry) {
        setLoading(true);
        setError(null);
      }
      
      const response = await axios.get('/api/history', {
        params: {
          minutes_ago: maxHistoryMinutesAgo,
          max_points: isMobile ? 30 : 50, // Reduce data points on mobile for better performance
          encrypted: encryptedMode
        },
        signal: abortControllerRef.current.signal
      });
      
      setHistoryData(response.data.history);
      setDataStats({
        totalPoints: response.data.total_points,
        filteredPoints: response.data.filtered_points,
        timeRangeMinutes: response.data.time_range_minutes
      });
      setLastFetchTime(new Date());
      setError(null);
      setRetryCount(0);
      
    } catch (err) {
      if (err.name === 'CanceledError') {
        return; // Request was canceled, ignore
      }
      
      console.error('Error fetching history data:', err);
      
      const errorMessage = err.response?.status === 500 
        ? 'Server error. Retrying...' 
        : 'Failed to load history data';
      
      setError(errorMessage);
      
      // Implement exponential backoff for retries
      if (retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        setRetryCount(prev => prev + 1);
        
        retryTimeoutRef.current = setTimeout(() => {
          fetchHistoryData(true);
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [maxHistoryMinutesAgo, retryCount, isMobile, encryptedMode]);

  // Manual retry function
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    fetchHistoryData();
  }, [fetchHistoryData]);

  // Set up polling with proper cleanup
  useEffect(() => {
    // Clear any existing intervals/timeouts
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    // Initial fetch
    fetchHistoryData();

    // Set up interval for periodic refresh
    intervalRef.current = setInterval(() => {
      fetchHistoryData();
    }, refreshInterval);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchHistoryData, refreshInterval]);

  // Format timestamp for display (mobile-friendly)
  const formatTimestamp = useCallback((timestamp) => {
    const date = new Date(timestamp);
    if (isMobile) {
      // Shorter format for mobile
      return date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit'
      });
    }
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }, [isMobile]);

  // Format tooltip timestamp
  const formatTooltipTimestamp = useCallback((timestamp) => {
    const date = new Date(timestamp);
    if (isMobile) {
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleString();
  }, [isMobile]);

  // Memoized chart data
  const chartData = useMemo(() => {
    const dataToUse = encryptedMode ? decryptedData : historyData;
    
    if (!dataToUse.length) return null;

    return {
      labels: dataToUse.map(item => formatTimestamp(item.timestamp)),
      datasets: [
        {
          label: `Water Level (cm)${encryptedMode ? ' - Decrypted' : ''}`,
          data: dataToUse.map(item => item.level_cm),
          fill: true,
          backgroundColor: createGradient,
          borderColor: encryptedMode ? '#8b5cf6' : '#2563eb',
          borderWidth: isMobile ? 2 : 3,
          tension: 0.4,
          pointRadius: isMobile ? 2 : 3,
          pointHoverRadius: isMobile ? 4 : 6,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: encryptedMode ? '#8b5cf6' : '#2563eb',
          pointBorderWidth: isMobile ? 1 : 2,
          pointHoverBackgroundColor: encryptedMode ? '#8b5cf6' : '#2563eb',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: isMobile ? 2 : 3,
        }
      ]
    };
  }, [historyData, decryptedData, encryptedMode, formatTimestamp, createGradient, isMobile]);

  // Memoized chart options with mobile responsiveness
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    animation: {
      duration: isMobile ? 500 : 750,
      easing: 'easeInOutQuart'
    },
    scales: {
      y: {
        beginAtZero: true,
        max: Math.ceil(tankHeight * 1.1),
        title: {
          display: !isMobile, // Hide title on mobile to save space
          text: 'Water Level (cm)',
          font: {
            size: isMobile ? 10 : 14,
            weight: 600,
          },
          color: '#1e293b',
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          borderColor: '#e2e8f0',
          lineWidth: isMobile ? 0.5 : 1,
        },
        ticks: {
          color: '#64748b',
          font: {
            size: isMobile ? 10 : 12,
          },
          maxTicksLimit: isMobile ? 5 : 8,
          padding: isMobile ? 4 : 8,
        },
      },
      x: {
        title: {
          display: !isMobile, // Hide title on mobile to save space
          text: `Time (Last ${maxHistoryMinutesAgo} minutes)`,
          font: {
            size: isMobile ? 10 : 14,
            weight: 600,
          },
          color: '#1e293b',
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          borderColor: '#e2e8f0',
          lineWidth: isMobile ? 0.5 : 1,
        },
        ticks: {
          color: '#64748b',
          font: {
            size: isMobile ? 9 : 12,
          },
          maxTicksLimit: isMobile ? 4 : 8,
          maxRotation: isMobile ? 45 : 0,
          padding: isMobile ? 2 : 8,
        },
      }
    },
    plugins: {
      legend: {
        display: !isMobile, // Hide legend on mobile to save space
        position: 'top',
        labels: {
          font: {
            size: isMobile ? 12 : 14,
            weight: 500,
          },
          color: '#1e293b',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: isMobile ? 10 : 20,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#64748b',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        cornerRadius: isMobile ? 6 : 8,
        displayColors: !isMobile, // Hide color box on mobile
        titleFont: {
          size: isMobile ? 12 : 14,
          weight: 600,
        },
        bodyFont: {
          size: isMobile ? 11 : 13,
        },
        padding: isMobile ? 8 : 12,
        boxPadding: isMobile ? 4 : 6,
        caretSize: isMobile ? 4 : 6,
        callbacks: {
          title: function(context) {
            const dataIndex = context[0].dataIndex;
            const dataToUse = encryptedMode ? decryptedData : historyData;
            const originalTimestamp = dataToUse[dataIndex]?.timestamp;
            return originalTimestamp ? formatTooltipTimestamp(originalTimestamp) : '';
          },
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toFixed(1)} cm`;
          }
        }
      },
    },
    elements: {
      line: {
        borderJoinStyle: 'round',
      },
      point: {
        hoverBorderWidth: isMobile ? 2 : 3,
      },
    },
    // Mobile-specific optimizations
    devicePixelRatio: isMobile ? 1 : undefined, // Reduce pixel ratio on mobile for better performance
  }), [tankHeight, maxHistoryMinutesAgo, historyData, decryptedData, encryptedMode, formatTooltipTimestamp, isMobile]);

  // Render loading state
  if (loading && !historyData.length) {
    return (
      <div className="chart-container">
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <span>Loading history data...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !historyData.length) {
    return (
      <div className="chart-container">
        <div className="chart-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button onClick={handleRetry} className="retry-button">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!historyData.length) {
    return (
      <div className="chart-container">
        <div className="chart-empty">
          <span className="empty-icon">📊</span>
          <span>No data available for the last {maxHistoryMinutesAgo} minutes</span>
          <button onClick={handleRetry} className="retry-button">
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Encrypted mode specific empty state
  if (encryptedMode && (!decryptionKey || decryptedData.length === 0)) {
    return (
      <div className="chart-container">
        <div className="chart-empty">
          <span className="empty-icon">🔐</span>
          <span>
            {!decryptionKey 
              ? 'Enter decryption key to view encrypted data' 
              : 'No valid decrypted data available'
            }
          </span>
          <button onClick={handleRetry} className="retry-button">
            Refresh Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      {/* Chart status bar */}
      <div className="chart-status-bar">
        <div className="chart-info">
          <span className="data-points">
            {encryptedMode ? (
              `${decryptedData.length} decrypted points${dataStats.totalPoints ? ` (${dataStats.totalPoints} encrypted)` : ''}`
            ) : (
              `${dataStats.filteredPoints || historyData.length} data points${dataStats.totalPoints && dataStats.totalPoints > dataStats.filteredPoints ? ` (reduced from ${dataStats.totalPoints})` : ''}`
            )}
          </span>
          {lastFetchTime && (
            <span className="last-update">
              {isMobile ? 'Updated: ' : 'Last updated: '}{lastFetchTime.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          )}
          {encryptedMode && (
            <span className="encryption-status">
              🔐 {decryptionKey ? 'Encrypted Mode - Key Active' : 'Encrypted Mode - No Key'}
            </span>
          )}
        </div>
        
        {error && (
          <div className="chart-error-banner">
            <span>{error}</span>
            <button onClick={handleRetry} className="retry-button-small">
              Retry
            </button>
          </div>
        )}
        
        {loading && historyData.length > 0 && !isMobile && (
          <div className="chart-refreshing">
            <div className="refreshing-spinner"></div>
            <span>Refreshing...</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="chart-wrapper">
        <Line 
          data={chartData} 
          options={chartOptions} 
          height={isMobile ? 250 : 300}
        />
      </div>
    </div>
  );
};

export default WaterLevelChart; 