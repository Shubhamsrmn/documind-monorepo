import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateUploadUrlRequest,
  UploadUrlResponse,
} from '@repo/contracts';
import { S3Service } from '../aws/s3.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly s3Service: S3Service) {}

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
}
