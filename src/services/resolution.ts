import { prisma } from '@/lib/prisma';

export async function resolveRoleAndLevel(
  roleTitle: string,
  levelName: string,
  levelRank: number,
  companyId: string,
): Promise<{ roleId: string; levelId: string }> {
  const [role, level] = await Promise.all([
    prisma.role.upsert({
      where: { title: roleTitle },
      update: {},
      create: { title: roleTitle },
      select: { id: true },
    }),
    prisma.level.upsert({
      where: { name_companyId: { name: levelName, companyId } },
      update: {},
      create: { name: levelName, companyId, rank: levelRank },
      select: { id: true },
    }),
  ]);

  return { roleId: role.id, levelId: level.id };
}