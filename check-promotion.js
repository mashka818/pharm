const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPromotion() {
  try {
    const promotion = await prisma.promotion.findUnique({
      where: { promotionId: 'x-pharm' },
      select: {
        promotionId: true,
        name: true,
        domain: true
      }
    });
    
    console.log('Промоакция x-pharm:', promotion);
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPromotion();
