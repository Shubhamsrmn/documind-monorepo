import { Inject, Injectable, Logger } from "@nestjs/common";
import awsConfig from "../config/aws.config";
import type { ConfigType } from "@nestjs/config";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
@Injectable()
export class S3ReaderService {
  private readonly logger = new Logger(S3ReaderService.name);
  private readonly s3Client: S3Client;

  constructor(
    @Inject(awsConfig.KEY)
    private readonly awsConf: ConfigType<typeof awsConfig>,
  ) {
    this.s3Client = new S3Client({
      region: this.awsConf.awsRegion,
    });
  }

  async getDocumentStream(key: string): Promise<Readable> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.awsConf.s3BucketName,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`S3 response body is empty for key: ${key}`);
    }

    return response.Body as Readable;
  }
}
