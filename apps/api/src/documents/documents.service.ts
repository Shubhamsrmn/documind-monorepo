import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  claimTicketSchema,
  type ClaimTicket,
  type ConfirmUploadRequest,
  type ConfirmUploadResponse,
  type CreateUploadUrlRequest,
  type UploadUrlResponse,
} from '@repo/contracts';
import { S3Service } from '../aws/s3.service';
import { SQSService } from '../aws/sqs.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly sqsService: SQSService,
  ) {}

  async createUploadUrl(
    dto: CreateUploadUrlRequest,
  ): Promise<UploadUrlResponse> {
    const fileId = randomUUID();
    const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectKey = `uploads/raw/${fileId}-${sanitizedFileName}`;
    const expiresInSeconds = 900; // 15 minutes lease

    const uploadUrl = await this.s3Service.generatePresignedUploadUrl(
      objectKey,
      dto.mimeType,
      expiresInSeconds,
    );

    this.logger.log(
      `Created upload lease for file: ${dto.fileName} -> ${objectKey}`,
    );

    return {
      uploadUrl,
      objectKey,
      expiresInSeconds,
    };
  }

  async confirmUpload(
    dto: ConfirmUploadRequest,
  ): Promise<ConfirmUploadResponse> {
    try {
      const metadata = await this.s3Service.verifyObjectExists(dto.objectKey);

      if (metadata.contentLength !== dto.fileSizeBytes) {
        throw new BadRequestException(
          `File size mismatch: client reported ${dto.fileSizeBytes} bytes, but storage contains ${metadata.contentLength} bytes`,
        );
      }

      const jobId = randomUUID();

      const ticket: ClaimTicket = {
        jobId,
        objectKey: dto.objectKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSizeBytes: metadata.contentLength,
        createdAt: new Date().toISOString(),
      };
      claimTicketSchema.parse(ticket);

      const messageId = await this.sqsService.sendClaimTicket(ticket);
      this.logger.log(
        `The Job id : ${jobId} and the messageId : ${messageId} and the object key ${dto.objectKey}`,
      );

      return {
        jobId,
        status: 'PENDING',
        message: 'Document successfull uploaded and queued for processing',
      };
    } catch (error) {
      this.logger.error(
        `Failed to confirm upload for ${dto.objectKey}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
