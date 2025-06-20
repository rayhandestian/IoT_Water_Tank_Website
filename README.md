# IoT Water Tank Monitoring Website

A simple IoT monitoring website for a Smart Water Tank based on Node.js, React, and MySQL.

## Features

- Real-time water level monitoring
- Manual pump control
- Automatic mode toggle
- API for ESP32 communication

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- NPM (v6 or higher)

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd IoT_Water_Tank_Website
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up MySQL database:
   ```
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE smart_tank;
   ```

4. Configure environment variables:
   - Rename `.env.example` to `.env` (or use the existing `.env` file)
   - Update MySQL credentials and ESP32 API key

## Running the Application

1. Start the server:
   ```
   npm start
   ```
   or for development:
   ```
   npm run dev
   ```

2. Access the dashboard:
   - Open your browser and navigate to `http://localhost:3000`

## Timezone Configuration

By default, the application uses the system's local timezone. To configure a specific timezone (e.g., for containerized deployments), you can set the `TZ` environment variable in your startup command.

### Example with Asia/Jakarta timezone:
```bash
if [[ -d .git ]] && [[ 0 == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; export TZ=Asia/Jakarta; if [[ "${MAIN_FILE}" == "*.js" ]]; then /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}; else /usr/local/bin/ts-node --esm "/home/container/${MAIN_FILE}" ${NODE_ARGS}; fi
```

### Common timezone values:
- `UTC` (Coordinated Universal Time)
- `Asia/Jakarta` (Western Indonesia Time)
- `America/New_York` (Eastern Time)
- `Europe/London` (Greenwich Mean Time)
- `Asia/Tokyo` (Japan Standard Time)

**Note:** This affects server-side timestamps. Frontend timestamps will still display in the user's browser timezone.

## API Endpoints

### ESP32 Endpoints (require API key)

- `POST /api/data` - Send sensor data (water level)
- `GET /api/status` - Get pump status

### Dashboard Endpoints

- `GET /api/latest` - Get latest sensor data and pump status
- `POST /api/pump` - Update pump status manually
- `POST /api/auto` - Toggle automatic mode

## ESP32 Integration

The ESP32 should:

1. Send water level data to `/api/data` with the `X-API-KEY` header
2. Receive pump control commands in the response
3. Poll `/api/status` for pump status updates

## License

MIT 