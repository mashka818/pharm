import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Pharm-vision API')
  .setDescription('This is API of pharm-vision project')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
