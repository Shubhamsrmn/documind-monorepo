import { z } from "zod";
import { ALLOWED_MIME_TYPES } from "./documents";

/**
 * Claim-Check Ticket schema for SQS message payloads.
 */
export const claimTicketSchema = z.object({
  jobId: z.string().uuid(),
  objectKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileSizeBytes: z.number().int().positive(),
  createdAt: z.string().datetime(), // ISO 8601 string
});

export type ClaimTicket = z.infer<typeof claimTicketSchema>;
