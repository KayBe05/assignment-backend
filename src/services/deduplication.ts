import { createHash } from 'crypto';

export interface HashPayload {
  companyId: string;
  roleId: string;
  levelId: string;
  baseSalary: number;
  location: string;
}

export function generatePayloadHash(data: HashPayload): string {
  const raw = [
    data.companyId,
    data.roleId,
    data.levelId,
    data.baseSalary.toString(),
    data.location,
  ]
    .join('|')
    .toLowerCase();

  return createHash('sha256').update(raw, 'utf8').digest('hex');
}