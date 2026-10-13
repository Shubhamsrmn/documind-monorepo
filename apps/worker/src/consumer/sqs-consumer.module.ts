import { Module } from "@nestjs/common";
import { SQSConsumer } from "./sqs-consumer.service";
import { AwsModule } from "../aws/aws.module";

@Module({
  imports: [AwsModule],
  providers: [SQSConsumer],
})
export class ConsumerModule {}
