import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = 'admin@admin.com';
  const password = '1234';

  const existingAdmin = await prisma.admin.findUnique({
    where: { username }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
      },
    });
    console.log(`Seeded admin user: ${username}`);
  } else {
    console.log(`Admin user ${username} already exists.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
