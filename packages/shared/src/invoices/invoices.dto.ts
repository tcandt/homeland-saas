import { z } from "zod";

export const InvoiceStatusEnum = z.enum([
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  roomId: z.string().min(1, "Room ID is required"),
  contractId: z.string().min(1, "Contract ID is required"),
  rentalCycleId: z.string().min(1, "Rental cycle ID is required").optional(),
  period: z.string().min(1, "Period is required (e.g. YYYY-MM)"),
  dueDate: z.string().or(z.date()),
  totalAmount: z.number().min(0),
  paidAmount: z.number().min(0).default(0),
  status: InvoiceStatusEnum.default("UNPAID"),
  notes: z.string().optional().nullable(),
  items: z.array(z.any()).optional(),
});

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial();

export const InvoiceAdjustmentTypeEnum = z.enum(["DEBIT", "CREDIT"]);

export const InvoiceAdjustmentItemSchema = z
  .object({
    type: z.enum([
      "RENT",
      "UTILITY_WATER",
      "UTILITY_ELECTRICITY",
      "SERVICE",
      "PENALTY",
      "DISCOUNT",
      "OTHER",
    ]),
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive().default(1),
    unitPrice: z.number().positive().optional(),
    amount: z.number().positive(),
  })
  .strict()
  .superRefine((item, context) => {
    if (
      item.unitPrice !== undefined &&
      Math.abs(item.quantity * item.unitPrice - item.amount) > 0.01
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Amount must equal quantity multiplied by unitPrice",
      });
    }
  });

/**
 * Adjustment requests intentionally do not accept period/usagePeriod/servicePeriod.
 * Those fields are inherited from the immutable root invoice by the API.
 */
export const CreateInvoiceAdjustmentSchema = z
  .object({
    type: InvoiceAdjustmentTypeEnum,
    reason: z.string().trim().min(1).max(1000),
    items: z.array(InvoiceAdjustmentItemSchema).min(1).max(100),
  })
  .strict();

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type CreateInvoiceAdjustmentInput = z.infer<
  typeof CreateInvoiceAdjustmentSchema
>;
