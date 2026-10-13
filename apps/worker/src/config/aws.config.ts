import { registerAs } from "@nestjs/config";
import { z } from "zod";

export const awsConfigSchema = z.object({
  awsRegion: z.string().min(1).default("us-east-1"),
  s3BucketName: z.string().min(1),
  sqsQueueURL: z.string().min(1),
});

export type AwsConfig = z.infer<typeof awsConfigSchema>;

export default registerAs("aws", (): AwsConfig => {
  const awsConf = {
    awsRegion: process.env.AWS_REGION,
    s3BucketName: process.env.AWS_S3_BUCKET_NAME,
    sqsQueueURL: process.env.AWS_SQS_QUEUE_URL,
  };
  return awsConfigSchema.parse(awsConf);
});
