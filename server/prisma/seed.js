import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@admin.com';
  const password = '1234';

  const existingAdmin = await prisma.user.findUnique({
    where: { email }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`Seeded admin user: ${email}`);
  } else {
    console.log(`Admin user ${email} already exists.`);
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
