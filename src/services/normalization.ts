import { prisma } from '@/lib/prisma';

const CORPORATE_SUFFIXES = [
  'inc', 'llc', 'ltd', 'pvt', 'private', 'limited', 'corp', 'corporation', 'co', 'company'
];


export function normalizeCompanyName(rawName: string): string {
  let cleanName = rawName.toLowerCase().trim();

  cleanName = cleanName.replace(/[.,\-]/g, '');

  const suffixRegex = new RegExp(`\\b(${CORPORATE_SUFFIXES.join('|')})\\b$`, 'gi');
  cleanName = cleanName.replace(suffixRegex, '').trim();

  if (cleanName.length === 0) {
    cleanName = rawName.toLowerCase().trim();
  }

  return cleanName;
}

export async function resolveCompany(rawName: string) {
  const normalizedName = normalizeCompanyName(rawName);
  const rawLower = rawName.toLowerCase().trim();

  let company = await prisma.company.findUnique({
    where: { name: normalizedName }
  });

  if (!company) {
    company = await prisma.company.findFirst({
      where: {
        rawNames: {
          has: rawLower
        }
      }
    });
  }

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: normalizedName,
        rawNames: [rawLower]
      }
    });
  } else {
    if (!company.rawNames.includes(rawLower)) {
      company = await prisma.company.update({
        where: { id: company.id },
        data: {
          rawNames: {
            push: rawLower
          }
        }
      });
    }
  }

  return company;
}