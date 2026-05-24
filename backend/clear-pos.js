const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.posItem.deleteMany()
  .then(r => console.log('Deleted', r.count, 'old items — new 30 items will auto-seed on next GET /pos/items'))
  .then(() => p.$disconnect())
  .catch(e => { console.error(e); process.exit(1); });
