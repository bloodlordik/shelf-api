import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';
import { McpService } from './modules/mcp/services/mcp.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          scriptSrc: [`'self'`, `'unsafe-inline'`, `'unsafe-eval'`],
          scriptSrcAttr: [`'unsafe-inline'`],
        },
      },
    }),
  );

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  let origin: boolean | string | string[] = true;
  if (corsOrigin) {
    if (corsOrigin === '*') {
      origin = true;
    } else if (corsOrigin.includes(',')) {
      origin = corsOrigin.split(',').map((o) => o.trim());
    } else {
      origin = corsOrigin;
    }
  }
  app.enableCors({
    origin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new TypeOrmExceptionFilter());

  app.setGlobalPrefix('api', {
    exclude: ['admin', 'admin/{*path}', 'health', 'health/{*path}'],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shelf API')
    .setDescription('Shelf API endpoints and data schemas')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const mcpService = app.get(McpService);
  mcpService.setOpenApiDocument(document);

  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED') ?? true;
  if (swaggerEnabled) {
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
