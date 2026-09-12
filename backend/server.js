require('dotenv').config();
const app = require('./src/app');
const prisma = require('./src/utils/prisma');
const { connectRedis } = require('./src/services/events');

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, async () => {
  console.log(`Backend server running on port ${port}`);
  await connectRedis();
});
async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
