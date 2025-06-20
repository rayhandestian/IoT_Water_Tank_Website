import { useEffect, useState } from 'react';
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

const WaterLevelChart = ({ tankHeight, maxHistoryMinutesAgo = 60 }) => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30000); // Default 30 seconds

  useEffect(() => {
    const fetchHistoryData = async () => {
      try {
        if (loading) setLoading(true);
        const response = await axios.get('/api/history');
        setHistoryData(response.data.history);
        
        // Get refresh interval from the response if available
        if (response.data.refresh_interval_ms) {
          // Use the same interval as the main dashboard, but with a minimum of 10 seconds for chart
          const chartRefreshInterval = Math.max(response.data.refresh_interval_ms, 10000);
          setRefreshInterval(chartRefreshInterval);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching history data:', err);
        setError('Failed to load history data');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchHistoryData();

    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchHistoryData();
    }, refreshInterval);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [refreshInterval]); // Re-create interval when refresh interval changes

  const formatMinutesAgo = (timestamp) => {
    const now = new Date();
    const dataTime = new Date(timestamp);
    const diffMs = now - dataTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'now';
    } else if (diffMinutes === 1) {
      return '1 min ago';
    } else {
      return `${diffMinutes} min ago`;
    }
  };

  const filterAndFormatData = () => {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - maxHistoryMinutesAgo * 60 * 1000);
    
    // Filter data to only include entries within the configured time range
    const filteredData = historyData.filter(item => {
      const dataTime = new Date(item.timestamp);
      return dataTime >= cutoffTime;
    });
    
    return filteredData;
  };

  if (loading) {
    return <div className="chart-loading">Loading history data...</div>;
  }

  if (error) {
    return <div className="chart-error">{error}</div>;
  }

  if (historyData.length === 0) {
    return <div className="chart-empty">No historical data available</div>;
  }

  const filteredData = filterAndFormatData();

  if (filteredData.length === 0) {
    return <div className="chart-empty">No data available for the last {maxHistoryMinutesAgo} minutes</div>;
  }

  const chartData = {
    labels: filteredData.map(item => formatMinutesAgo(item.timestamp)),
    datasets: [
      {
        label: 'Water Level (cm)',
        data: filteredData.map(item => item.level_cm),
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          
          if (!chartArea) {
            return null;
          }
          
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(37, 99, 235, 0.3)');
          gradient.addColorStop(0.5, 'rgba(37, 99, 235, 0.2)');
          gradient.addColorStop(1, 'rgba(37, 99, 235, 0.05)');
          return gradient;
        },
        borderColor: '#2563eb',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    scales: {
      y: {
        beginAtZero: true,
        max: tankHeight * 1.1,
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
          maxTicksLimit: 8, // Limit number of labels to prevent overcrowding
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
            const originalTimestamp = filteredData[dataIndex].timestamp;
            return new Date(originalTimestamp).toLocaleString();
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
  };

  return (
    <div className="chart-container">
      <Line data={chartData} options={chartOptions} height={300} />
    </div>
  );
};

export default WaterLevelChart; 