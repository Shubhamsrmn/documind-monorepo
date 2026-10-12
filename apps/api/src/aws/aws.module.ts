import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { SQSService } from './sqs.service';

@Module({
  providers: [S3Service, SQSService],
  exports: [S3Service, SQSService],
})
export class AwsModule {}
