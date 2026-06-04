import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { error: 'Missing required search parameter: companyId.' },
      { status: 400 },
    );
  }

  try {
    const [company, levelAggregations] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        include: {
          levels: { orderBy: { rank: 'asc' } },
        },
      }),
      prisma.compensation.groupBy({
        by: ['levelId'],
        where: { companyId },
        _avg: {
          totalComp: true,
          baseSalary: true,
          stockGrant: true,
          bonus: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found.' },
        { status: 404 },
      );
    }

    const levelById = new Map(company.levels.map((l) => [l.id, l]));

    const levelBreakdown = levelAggregations
      .map((agg) => {
        const level = levelById.get(agg.levelId);
        return {
          levelId: agg.levelId,
          levelName: level?.name ?? null,
          levelRank: level?.rank ?? null,
          dataPoints: agg._count.id,
          averages: {
            totalComp: agg._avg.totalComp,
            baseSalary: agg._avg.baseSalary,
            stockGrant: agg._avg.stockGrant,
            bonus: agg._avg.bonus,
          },
        };
      })
      .sort((a, b) => (a.levelRank ?? Infinity) - (b.levelRank ?? Infinity));

    return NextResponse.json(
      {
        company: {
          id: company.id,
          name: company.name,
          rawNames: company.rawNames,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        },
        levelBreakdown,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[GET /api/companies] Unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 },
    );
  }
}