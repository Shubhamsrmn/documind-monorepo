import { Module } from "@nestjs/common";
import { WorkerConfigModule } from "./config/worker-config.module";
import { ConsumerModule } from "./consumer/sqs-consumer.module";

@Module({
  imports: [WorkerConfigModule, ConsumerModule],
})
export class WorkerModule {}
