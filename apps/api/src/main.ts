import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { PrismaService } from "./core/prisma/prisma.service";
import { assertProductionSecurityConfig } from "./core/config/production-security";

async function bootstrap() {
  assertProductionSecurityConfig();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  });
  // Audit photos are captured at a reviewable resolution. Keep a bounded
  // payload limit rather than the default Express limit, which is too small
  // for those JPEG data URLs.
  app.use(json({ limit: "4mb" }));
  app.use(urlencoded({ extended: true, limit: "4mb" }));

  // API needs only a restrictive CSP; the web CSP is set at its reverse proxy.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
    }),
  );

  if (process.env.NODE_ENV === "production") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
    app.use((request, response, next) => {
      if (
        request.protocol === "https" ||
        request.headers["x-forwarded-proto"] === "https"
      )
        return next();
      return response
        .status(400)
        .json({ statusCode: 400, message: "HTTPS_REQUIRED" });
    });
  }

  // CORS is controlled by the audited company setting. CORS_ORIGIN remains an
  // emergency deployment allow-list override, never a wildcard in production.
  const prisma = app.get(PrismaService);
  app.enableCors({
    origin: async (origin, callback) => {
      if (!origin) return callback(null, true);
      const configured = (process.env.CORS_ORIGIN ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const localhost =
        process.env.NODE_ENV === "production" ? [] : ["http://localhost:3100"];
      try {
        const setting = await prisma.companySetting.findUnique({
          where: { id: "default" },
          select: { trustedWebOrigins: true },
        });
        return callback(
          null,
          [
            ...new Set([
              ...configured,
              ...localhost,
              ...(setting?.trustedWebOrigins ?? []),
            ]),
          ].includes(origin),
        );
      } catch {
        return callback(null, false);
      }
    },
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Versioned API prefix
  app.setGlobalPrefix("api/v1");

  // Graceful shutdown (flushes Prisma connections on SIGTERM).
  app.enableShutdownHooks();

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle("Nexus ECM API")
    .setDescription("Enterprise Company Management System — REST API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const enableSwagger = process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true";
  if (enableSwagger) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = Number(process.env.API_PORT ?? 4100);
  await app.listen(port);
  Logger.log(`🚀 API ready at http://localhost:${port}/api/v1`, "Bootstrap");
  if (enableSwagger) Logger.log(`📚 Swagger at  http://localhost:${port}/api/docs`, "Bootstrap");
}

bootstrap();
