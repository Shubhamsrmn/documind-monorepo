import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import awsConfig from "../config/aws.config";
import type { ConfigType } from "@nestjs/config";
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { S3ReaderService } from "../aws/s3-reader.service";
import { claimTicketSchema } from "@repo/contracts";
@Injectable()
export class SQSConsumer implements OnModuleInit, OnApplicationShutdown {
  private readonly sqsClient: SQSClient;
  private readonly logger = new Logger(SQSConsumer.name);
  private isShuttingDown = false;

  constructor(
    @Inject(awsConfig.KEY)
    private readonly awsConf: ConfigType<typeof awsConfig>,
    private readonly s3ReaderService: S3ReaderService,
  ) {
    this.sqsClient = new SQSClient({
      region: this.awsConf.awsRegion,
    });
  }

  onModuleInit() {
    // Fire-and-forget: do NOT await so NestJS completes bootstrapping
    void this.startPolling();
  }

  onApplicationShutdown(signal?: string) {
    this.logger.log(
      `Received shutdown signal: ${signal}. Stopping consumer loop...`,
    );
    this.isShuttingDown = true;
  }

  private async startPolling(): Promise<void> {
    this.logger.log(`Starting SQs long-polling consumer loop`);

    while (!this.isShuttingDown) {
      try {
        await this.pollMessages();
      } catch (error) {
        this.logger.error("Error in SQS polling cycle:", error);
        // Sleep 5 seconds before retrying to prevent hot error loops
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
    this.logger.log("Consumer loop terminated gracefully.");
  }

  private async pollMessages(): Promise<void> {
    const response = await this.sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: this.awsConf.sqsQueueURL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 60,
        MessageAttributeNames: ["All"],
      }),
    );

    if (!response.Messages || response.Messages.length === 0) return;

    for (const msg of response.Messages) {
      await this.processMessage(msg);
    }
  }

  private async processMessage(message: Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) {
      this.logger.warn("Skipping message: missing Body or ReceiptHandle");
      return;
    }

    try {
      // 1. Parse and validate the Claim Ticket using shared Zod schema
      const rawPayload = JSON.parse(message.Body);
      const ticket = claimTicketSchema.parse(rawPayload);
      this.logger.log(
        `[Claim-Check] Processing ticket: jobId=${ticket.jobId}, file=${ticket.fileName}`,
      );

      // 2. Claim-Check in action: Fetch document stream from S3 using objectKey
      const stream = await this.s3ReaderService.getDocumentStream(
        ticket.objectKey,
      );

      // 3. Simulate text/document extraction (2 seconds)
      this.logger.log(`Extracting data for jobId=${ticket.jobId}...`);
      await new Promise((res) => setTimeout(res, 2000));
      this.logger.log(`Extraction complete for jobId=${ticket.jobId}`);

      // 4. Message ACK: Explicitly delete from SQS upon successful processing
      await this.sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: this.awsConf.sqsQueueURL,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );
      this.logger.log(
        `[ACK] Deleted message from SQS for jobId=${ticket.jobId}`,
      );
    } catch (error) {
      // 5. NACK: If anything fails, DO NOT delete the message.
      // SQS visibility timeout will expire, allowing retries -> DLQ redrive.
      this.logger.error(
        `Failed to process message (ReceiptHandle=${message.ReceiptHandle}):`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
