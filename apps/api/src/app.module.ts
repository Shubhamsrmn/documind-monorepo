import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { AwsModule } from './aws/aws.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [AppConfigModule, AwsModule, DocumentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

