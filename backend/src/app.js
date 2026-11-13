const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const api = require('./routes/api');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
const allowedOrigins = new Set([
  'http://localhost:3000',
  ...(process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin && origin !== '*')
]);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'disaster-response-backend' }));
app.use('/api', api);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
