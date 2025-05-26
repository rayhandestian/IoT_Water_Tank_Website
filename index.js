require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Check if frontend/dist directory exists
const frontendDistPath = path.join(__dirname, 'frontend/dist');
const frontendExists = fs.existsSync(frontendDistPath) && 
                      fs.existsSync(path.join(frontendDistPath, 'index.html'));

if (frontendExists) {
  // Serve frontend in production
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
  console.log('Frontend static files found and will be served');
} else {
  console.warn('Warning: Frontend build files not found in frontend/dist');
  console.warn('To build the frontend, run: npm run frontend:install && npm run frontend:build');
  console.warn('Only API routes will be available until frontend is built');
  
  app.get('/', (req, res) => {
    res.send(`
      <h1>IoT Water Tank Server</h1>
      <p>Frontend not built yet. API endpoints are available at /api/*</p>
      <p>Please run the following commands to build the frontend:</p>
      <pre>npm run frontend:install\nnpm run frontend:build</pre>
    `);
  });
}

// Initialize database and start server
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
      if (frontendExists) {
        console.log(`Frontend: http://localhost:${PORT}`);
      }
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }); 