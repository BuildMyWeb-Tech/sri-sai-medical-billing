import prisma from '@/lib/prisma';

const authSeller = async (userId) => {
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        store: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user || !user.store) return null;

    if (user.store.status !== 'approved') return null;

    return user.store.id;
  } catch (error) {
    console.error('🔥 authSeller DB error:', error);

    // IMPORTANT: don't pretend unauthorized
    throw new Error('DB_ERROR_AUTH_SELLER');
  }
};

export default authSeller;