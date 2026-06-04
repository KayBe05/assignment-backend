import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CompanySlotResult {
  company: { id: string; name: string } | null;
  level: { id: string; name: string; rank: number } | null;
  dataPoints: number;
  averages: {
    totalComp: number | null;
    baseSalary: number | null;
    stockGrant: number | null;
    bonus: number | null;
  };
}

async function getAggregateAtRank(
  companyId: string,
  levelRank: number,
): Promise<CompanySlotResult> {
  const [company, level, aggregate] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    }),
    prisma.level.findFirst({
      where: { companyId, rank: levelRank },
      select: { id: true, name: true, rank: true },
    }),
    prisma.compensation.aggregate({
      where: {
        companyId,
        level: { rank: levelRank },
      },
      _avg: {
        totalComp: true,
        baseSalary: true,
        stockGrant: true,
        bonus: true,
      },
      _count: { id: true },
    }),
  ]);

  return {
    company,
    level,
    dataPoints: aggregate._count.id,
    averages: {
      totalComp: aggregate._avg.totalComp,
      baseSalary: aggregate._avg.baseSalary,
      stockGrant: aggregate._avg.stockGrant,
      bonus: aggregate._avg.bonus,
    },
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  const companyA = searchParams.get('companyA');
  const companyB = searchParams.get('companyB');
  const levelRankRaw = searchParams.get('levelRank');

  const missing = (
    [
      [!companyA, 'companyA'],
      [!companyB, 'companyB'],
      [!levelRankRaw, 'levelRank'],
    ] as [boolean, string][]
  )
    .filter(([absent]) => absent)
    .map(([, name]) => name);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required search parameters: ${missing.join(', ')}.` },
      { status: 400 },
    );
  }

  const levelRank = parseInt(levelRankRaw!, 10);

  if (Number.isNaN(levelRank)) {
    return NextResponse.json(
      { error: 'levelRank must be a valid integer.' },
      { status: 400 },
    );
  }

  try {
    const [slotA, slotB] = await Promise.all([
      getAggregateAtRank(companyA!, levelRank),
      getAggregateAtRank(companyB!, levelRank),
    ]);

    const delta = (
      key: keyof CompanySlotResult['averages'],
    ): number | null => {
      const a = slotA.averages[key];
      const b = slotB.averages[key];
      return a !== null && b !== null ? a - b : null;
    };

    return NextResponse.json(
      {
        levelRank,
        comparison: {
          a: slotA,
          b: slotB,
        },
        delta: {
          totalComp: delta('totalComp'),
          baseSalary: delta('baseSalary'),
          stockGrant: delta('stockGrant'),
          bonus: delta('bonus'),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[GET /api/compare] Unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 },
    );
  }
}