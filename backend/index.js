require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./src/db');
const parkingsRouter = require('./src/routes/parkings');
const sharesRouter = require('./src/routes/shares');
const reportsRouter = require('./src/routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

initDb();

app.use('/api/parkings', parkingsRouter);
app.use('/api/shares', sharesRouter);
app.use('/api/reports', reportsRouter);

// Serve compiled frontend in production
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
