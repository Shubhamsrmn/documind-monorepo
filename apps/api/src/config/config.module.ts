import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import awsConfig from './aws.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, awsConfig],
      cache: true,
      expandVariables: true,
    }),
  ],
})
export class AppConfigModule {}
