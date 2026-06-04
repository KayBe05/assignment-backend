import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { SalaryIngestionSchema } from '@/core/validation/salarySchema';
import { resolveCompany } from '@/services/normalization';
import { resolveRoleAndLevel } from '@/services/resolution';
import { generatePayloadHash } from '@/services/deduplication';
import { createCompensationRecord, DuplicateCompensationError } from '@/services/compensation';

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