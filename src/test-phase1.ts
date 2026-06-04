import { SalaryIngestionSchema } from './core/validation/salarySchema';
import { resolveCompany } from './services/normalization';
import { resolveRoleAndLevel } from './services/resolution';
import { generatePayloadHash } from './services/deduplication';
import { prisma } from './lib/prisma';

async function runTest() {
  console.log("🚀 Starting Phase 1 Pipeline Test...\n");

  try {
    // 1. The Mock Payload (Notice the messy company name and missing stock/bonus)
    const rawInput = {
      companyName: "   Google, LLC.  ",
      roleTitle: "Software Engineer",
      levelName: "l4",
      levelRank: 4,
      baseSalary: 160000,
      location: "San Francisco, CA",
      experience: 3,
      // Intentionally omitting stock and bonus to test Zod defaults
    };

    console.log("📦 1. Raw Input:", rawInput);

    // 2. Zod Validation & Defaulting
    const validatedData = SalaryIngestionSchema.parse(rawInput);
    console.log("✅ 2. Zod Validation Passed. Sanitized Data:", validatedData);

    // 3. Company Normalization
    const company = await resolveCompany(validatedData.companyName);
    console.log("🏢 3. Company Resolved:", company);

    // 4. Role & Level Resolution
    const { roleId, levelId } = await resolveRoleAndLevel(
      validatedData.roleTitle,
      validatedData.levelName,
      validatedData.levelRank,
      company.id
    );
    console.log(`🎯 4. IDs Resolved -> Role: ${roleId} | Level: ${levelId}`);

    // 5. Deduplication Hashing
    const hash = generatePayloadHash({
      companyId: company.id,
      roleId: roleId,
      levelId: levelId,
      baseSalary: validatedData.baseSalary,
      location: validatedData.location,
    });
    console.log("🔐 5. Unique Payload Hash Generated:", hash);

    console.log("\n🎉 Phase 1 Pipeline is functioning perfectly!");

  } catch (error) {
    console.error("\n❌ Pipeline Test Failed:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();