import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // Security headers
  app.use(helmet());

  // CORS for the Next.js frontend
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // Versioned API prefix
  app.setGlobalPrefix('api/v1');

  // Graceful shutdown (flushes Prisma connections on SIGTERM).
  app.enableShutdownHooks();

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Nexus ECM API')
    .setDescription('Enterprise Company Management System — REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`🚀 API ready at http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`📚 Swagger at  http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
