import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import appConfig from './config/app.config';

async function bootstrap() {
  const logger = new Logger('Bootstap');
  const app = await NestFactory.create(AppModule);
  const appConf = app.get(appConfig.KEY);

  app.enableCors({
    origin: true, // For local dev, allows all origins. In strict prod, pass an allowed list.
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix(appConf.apiPrefix);
  await app.listen(appConf.port);

  logger.log(
    `🚀 Application running in [${appConf.nodeEnv}] on port ${appConf.port} with prefix /${appConf.apiPrefix}`,
  );
}
void bootstrap();
