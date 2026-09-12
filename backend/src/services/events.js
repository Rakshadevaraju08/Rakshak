const { createClient } = require('redis');

const clients = new Set();
let publisher;

async function connectRedis() {
  if (!process.env.REDIS_URL || publisher) return;
  publisher = createClient({ url: process.env.REDIS_URL });
  publisher.on('error', (error) => console.warn('Redis unavailable:', error.message));
  try {
    await publisher.connect();
  } catch (error) {
    console.warn('Continuing without Redis:', error.message);
    publisher = undefined;
  }
}

function subscribe(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write(': connected\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

async function publish(type, payload) {
  const event = { type, payload, occurredAt: new Date().toISOString() };
  const serialized = JSON.stringify(event);
  for (const client of clients) client.write(`event: ${type}\ndata: ${serialized}\n\n`);
  if (publisher?.isOpen) {
    try { await publisher.publish('disaster-events', serialized); } catch (error) { console.warn('Redis publish failed:', error.message); }
  }
  return event;
}

module.exports = { connectRedis, publish, subscribe };
