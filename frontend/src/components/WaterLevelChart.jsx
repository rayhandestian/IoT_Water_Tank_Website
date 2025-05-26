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

const WaterLevelChart = ({ tankHeight }) => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistoryData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/history');
        setHistoryData(response.data.history);
        setError(null);
      } catch (err) {
        console.error('Error fetching history data:', err);
        setError('Failed to load history data');
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, []);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const chartData = {
    labels: historyData.map(item => formatTimestamp(item.timestamp)),
    datasets: [
      {
        label: 'Water Level (cm)',
        data: historyData.map(item => item.level_cm),
        fill: true,
        backgroundColor: 'rgba(0, 119, 204, 0.2)',
        borderColor: 'rgba(0, 119, 204, 1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: tankHeight * 1.1, // 10% higher than tank height for better visualization
        title: {
          display: true,
          text: 'Water Level (cm)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      title: {
        display: true,
        text: 'Water Level History'
      }
    }
  };

  return (
    <div className="chart-container">
      <Line data={chartData} options={chartOptions} height={300} />
    </div>
  );
};

export default WaterLevelChart; 