import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const appConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().positive().default(3000),
  apiPrefix: z.string().default('api/v1'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export default registerAs('app', (): AppConfig => {
  const config = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    apiPrefix: process.env.API_PREFIX,
  };
  return appConfigSchema.parse(config);
});
