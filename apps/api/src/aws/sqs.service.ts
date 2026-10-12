import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import awsConfig from '../config/aws.config';
import type { ConfigType } from '@nestjs/config';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { ClaimTicket } from '@repo/contracts';

@Injectable()
export class SQSService {
  private readonly logger = new Logger(SQSService.name);
  private readonly sqsClient: SQSClient;

  constructor(
    @Inject(awsConfig.KEY)
    private readonly awsConf: ConfigType<typeof awsConfig>,
  ) {
    this.sqsClient = new SQSClient({
      region: this.awsConf.awsRegion,
    });
  }

  async sendClaimTicket(ticket: ClaimTicket): Promise<string> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: this.awsConf.sqsQueueURL,
        MessageBody: JSON.stringify(ticket),
        MessageAttributes: {
          JobId: { DataType: 'String', StringValue: ticket.jobId },
          MimeType: { DataType: 'String', StringValue: ticket.mimeType },
        },
      });
      const response = await this.sqsClient.send(command);
      this.logger.log(
        `Enqueued claim ticket : jobid = ${ticket.jobId}, messageId = ${response.MessageId}`,
      );
      return response.MessageId!;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue claim ticket for jobId: ${ticket.jobId}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(
        'Failed to enqueue document for processing',
      );
    }
  }
}
