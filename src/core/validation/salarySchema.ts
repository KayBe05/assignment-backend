import { z } from 'zod';

export const SalaryIngestionSchema = z.object({
  companyName: z
    .string()
    .min(1, { message: "Company name cannot be blank." })
    .transform((val) => val.trim()),

  roleTitle: z
    .string()
    .min(1, { message: "Role title cannot be blank." })
    .transform((val) => val.trim()),

  levelName: z
    .string()
    .min(1, { message: "Level identifier cannot be blank." })
    .transform((val) => val.trim().toUpperCase()),

  baseSalary: z
    .number()
    .positive({ message: "Base salary must be a positive number." }),

  stockGrant: z
    .preprocess((val) => (val === null || val === undefined ? 0 : Number(val)), z.number().nonnegative())
    .default(0),

  bonus: z
    .preprocess((val) => (val === null || val === undefined ? 0 : Number(val)), z.number().nonnegative())
    .default(0),

  location: z
    .string()
    .min(1, { message: "Location structure requires city/region values." })
    .transform((val) => val.trim().toLowerCase()),

  experience: z
    .number()
    .int()
    .nonnegative({ message: "Years of experience cannot be negative." }),

  levelRank: z
    .number()
    .int()
    .positive({ message: "Level cross-company hierarchy rank indicator is mandatory." })
});

export type TSalaryIngestionInput = z.infer<typeof SalaryIngestionSchema>;