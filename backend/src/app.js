const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const api = require('./routes/api');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'disaster-response-backend' }));
app.use('/api', api);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
