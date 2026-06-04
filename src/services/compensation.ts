import { prisma } from '@/lib/prisma';
import type { TSalaryIngestionInput } from '@/core/validation/salarySchema';
import type { Compensation } from '@prisma/client';

export class DuplicateCompensationError extends Error {
  constructor(hash: string) {
    super(`Duplicate entry detected for hash: ${hash}`);
    this.name = 'DuplicateCompensationError';
  }
}

export async function createCompensationRecord(
  data: TSalaryIngestionInput,
  companyId: string,
  roleId: string,
  levelId: string,
  payloadHash: string,
): Promise<Compensation> {
  const existing = await prisma.compensation.findUnique({
    where: { hash: payloadHash },
  });

  if (existing) {
    throw new DuplicateCompensationError(payloadHash);
  }

  const totalComp = data.baseSalary + data.stockGrant + data.bonus;

  return prisma.compensation.create({
    data: {
      companyId,
      roleId,
      levelId,
      baseSalary: data.baseSalary,
      stockGrant: data.stockGrant,
      bonus: data.bonus,
      totalComp,
      location: data.location,
      experience: data.experience,
      hash: payloadHash,
    },
  });
}