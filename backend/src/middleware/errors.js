function notFound(req, res) { res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }); }
function errorHandler(error, req, res, next) {
  console.error(error);
  const status = error.code === 'P2025' ? 404 : 500;
  res.status(status).json({ error: status === 404 ? 'Record not found' : 'Internal server error' });
}
module.exports = { notFound, errorHandler };
