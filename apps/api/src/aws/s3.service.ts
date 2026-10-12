import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import awsConfig from '../config/aws.config';
import type { ConfigType } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;

  constructor(
    @Inject(awsConfig.KEY)
    private readonly awsConf: ConfigType<typeof awsConfig>,
  ) {
    this.s3Client = new S3Client({
      region: this.awsConf.awsRegion,
    });
  }

  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSec = 900,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.awsConf.s3BucketName,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSec,
      });
      this.logger.log(`Generated pre-signed upload URL for object key: ${key}`);
      return signedUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate pre-signed upload URL for key: ${key}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'Failed to generate upload lease. Please try again.',
      );
    }
  }

  async verifyObjectExists(
    key: string,
  ): Promise<{ contentLength: number; contentType: string }> {
    try {
      const objectMetadata = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.awsConf.s3BucketName,
          Key: key,
        }),
      );
      if (!objectMetadata.ContentLength || objectMetadata.ContentLength === 0) {
        throw new BadRequestException(`Uploaded file is empty (0 bytes)`);
      }
      return {
        contentType: objectMetadata.ContentType ?? 'application/octet-stream',
        contentLength: objectMetadata.ContentLength,
      };
    } catch (error: any) {
      if (
        error?.name === 'NotFound' ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        throw new NotFoundException(
          `File with key "${key}" does not exist in storage`,
        );
      }

      this.logger.error(
        `Failed to verify S3 object with key "${key}": ${error?.message}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'Failed to verify object in storage',
      );
    }
  }
}
