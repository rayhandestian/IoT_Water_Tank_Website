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

const WaterLevelChart = ({ tankHeight, maxHistoryMinutesAgo = 60, refreshIntervalMs = 5000 }) => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [dataStats, setDataStats] = useState({});
  
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
          max_points: 50 // Limit data points for better performance
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
  }, [maxHistoryMinutesAgo, retryCount]);

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

  // Format timestamp for display (fixed timestamps, not relative)
  const formatTimestamp = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  // Format tooltip timestamp
  const formatTooltipTimestamp = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }, []);

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!historyData.length) return null;

    return {
      labels: historyData.map(item => formatTimestamp(item.timestamp)),
      datasets: [
        {
          label: 'Water Level (cm)',
          data: historyData.map(item => item.level_cm),
          fill: true,
          backgroundColor: createGradient,
          borderColor: '#2563eb',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#2563eb',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#2563eb',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3,
        }
      ]
    };
  }, [historyData, formatTimestamp, createGradient]);

  // Memoized chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    scales: {
      y: {
        beginAtZero: true,
        max: Math.ceil(tankHeight * 1.1),
        title: {
          display: true,
          text: 'Water Level (cm)',
          font: {
            size: 14,
            weight: 600,
          },
          color: '#1e293b',
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          borderColor: '#e2e8f0',
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 12,
          },
        },
      },
      x: {
        title: {
          display: true,
          text: `Time (Last ${maxHistoryMinutesAgo} minutes)`,
          font: {
            size: 14,
            weight: 600,
          },
          color: '#1e293b',
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          borderColor: '#e2e8f0',
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 12,
          },
          maxTicksLimit: 8,
        },
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          font: {
            size: 14,
            weight: 500,
          },
          color: '#1e293b',
          usePointStyle: true,
          pointStyle: 'circle',
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
        cornerRadius: 8,
        displayColors: true,
        titleFont: {
          size: 14,
          weight: 600,
        },
        bodyFont: {
          size: 13,
        },
        padding: 12,
        boxPadding: 6,
        callbacks: {
          title: function(context) {
            const dataIndex = context[0].dataIndex;
            const originalTimestamp = historyData[dataIndex].timestamp;
            return formatTooltipTimestamp(originalTimestamp);
          }
        }
      },
    },
    elements: {
      line: {
        borderJoinStyle: 'round',
      },
      point: {
        hoverBorderWidth: 3,
      },
    },
  }), [tankHeight, maxHistoryMinutesAgo, historyData, formatTooltipTimestamp]);

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

  return (
    <div className="chart-container">
      {/* Chart status bar */}
      <div className="chart-status-bar">
        <div className="chart-info">
          <span className="data-points">
            {dataStats.filteredPoints || historyData.length} data points
            {dataStats.totalPoints && dataStats.totalPoints > dataStats.filteredPoints && (
              <span className="reduced-notice">
                (reduced from {dataStats.totalPoints})
              </span>
            )}
          </span>
          {lastFetchTime && (
            <span className="last-update">
              Last updated: {lastFetchTime.toLocaleTimeString()}
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
        
        {loading && historyData.length > 0 && (
          <div className="chart-refreshing">
            <div className="refreshing-spinner"></div>
            <span>Refreshing...</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="chart-wrapper">
        <Line data={chartData} options={chartOptions} height={300} />
      </div>
    </div>
  );
};

export default WaterLevelChart; 