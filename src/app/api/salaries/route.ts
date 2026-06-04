import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { SalaryIngestionSchema } from '@/core/validation/salarySchema';
import { resolveCompany } from '@/services/normalization';
import { resolveRoleAndLevel } from '@/services/resolution';
import { generatePayloadHash } from '@/services/deduplication';
import { createCompensationRecord, DuplicateCompensationError } from '@/services/compensation';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  let validated: ReturnType<typeof SalaryIngestionSchema.parse>;

  try {
    validated = SalaryIngestionSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed.',
          issues: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  try {
    const company = await resolveCompany(validated.companyName);

    const { roleId, levelId } = await resolveRoleAndLevel(
      validated.roleTitle,
      validated.levelName,
      validated.levelRank,
      company.id,
    );

    const payloadHash = generatePayloadHash({
      companyId: company.id,
      roleId,
      levelId,
      baseSalary: validated.baseSalary,
      location: validated.location,
    });

    const record = await createCompensationRecord(
      validated,
      company.id,
      roleId,
      levelId,
      payloadHash,
    );

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateCompensationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 409 },
      );
    }

    console.error('[POST /api/salaries] Unexpected error:', err);

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  const companyId = searchParams.get('companyId');
  const roleId = searchParams.get('roleId');
  const levelId = searchParams.get('levelId');
  const location = searchParams.get('location');

  // Build the where clause only from params that were actually supplied.
  const where: Prisma.CompensationWhereInput = {
    ...(companyId && { companyId }),
    ...(roleId && { roleId }),
    ...(levelId && { levelId }),
    ...(location && {
      location: { contains: location, mode: Prisma.QueryMode.insensitive },
    }),
  };

  try {
    const salaries = await prisma.compensation.findMany({
      where,
      include: {
        company: true,
        role: true,
        level: true,
      },
      orderBy: { totalComp: 'desc' },
    });

    return NextResponse.json(salaries, { status: 200 });
  } catch (err) {
    console.error('[GET /api/salaries] Unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 },
    );
  }
}