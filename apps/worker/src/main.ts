import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const logger = new Logger("WorkerBootstrap");

  // Headless application context (no HTTP server, no ports)
  const app = await NestFactory.createApplicationContext(WorkerModule);

  // Ensures graceful shutdown when receiving SIGINT or SIGTERM
  app.enableShutdownHooks();

  logger.log("🚀 DocuMind Background Worker Daemon initialized successfully");
}

void bootstrap();
