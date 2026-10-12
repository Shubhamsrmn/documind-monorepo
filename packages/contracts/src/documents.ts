import { z } from "zod";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Schema for requesting a pre-signed S3 upload lease.
 */
export const createUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required"),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    message: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
  }),
  fileSizeBytes: z
    .number()
    .int()
    .positive("File size must be greater than 0")
    .max(
      MAX_FILE_SIZE_BYTES,
      `File size exceeds maximum limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
    ),
});

export type CreateUploadUrlRequest = z.infer<typeof createUploadUrlSchema>;

/**
 * Response returned by the API providing the pre-signed lease.
 */
export const uploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  objectKey: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
});

export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;

/**
 * Document processing lifecycle status.
 */
export const documentStatusSchema = z.enum([
  "PENDING", // Uploaded to S3, claim ticket sent to SQS
  "PROCESSING", // Worker has pulled ticket from SQS and is processing
  "COMPLETED", // Extraction completed successfully
  "FAILED", // Processing failed, sent to DLQ
]);

export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const confirmUploadSchema = z.object({
  objectKey: z.string().min(1),
  fileName: z.string().trim().min(1, "File name is required"),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    message: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
  }),
  fileSizeBytes: z
    .number()
    .int()
    .positive("File size must be greater than 0")
    .max(
      MAX_FILE_SIZE_BYTES,
      `File size exceeds maximum limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
    ),
});

export type ConfirmUploadRequest = z.infer<typeof confirmUploadSchema>;

export const confirmUploadResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: documentStatusSchema.default("PENDING"),
  message: z.string().min(1),
});

export type ConfirmUploadResponse = z.infer<typeof confirmUploadResponseSchema>;
