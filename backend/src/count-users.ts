import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const total    = await p.user.count();
  const admin    = await p.user.count({ where: { role: 'ADMIN' } });
  const merchant = await p.user.count({ where: { role: 'USER' } });
  const sessions = await p.userSession.count();
  console.log('══════════════════════════════════');
  console.log(`👥 Tổng user:       ${total}`);
  console.log(`🔑 Admin:           ${admin}`);
  console.log(`🏪 Merchant (USER): ${merchant}`);
  console.log(`💬 Tổng sessions:   ${sessions}`);
  console.log('══════════════════════════════════');
}
main().catch(console.error).finally(() => p.$disconnect());
