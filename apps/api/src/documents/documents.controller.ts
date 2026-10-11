import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
} from '@nestjs/common';
import {
  createUploadUrlSchema,
  type CreateUploadUrlRequest,
  type UploadUrlResponse,
} from '@repo/contracts';
import { DocumentsService } from './documents.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(createUploadUrlSchema))
  async getUploadUrl(
    @Body() dto: CreateUploadUrlRequest,
  ): Promise<UploadUrlResponse> {
    return this.documentsService.createUploadUrl(dto);
  }
}
