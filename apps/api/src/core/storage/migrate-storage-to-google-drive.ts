import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { StorageService } from './storage.service';

async function main() {
  const args = new Set(process.argv.slice(2));
  const execute = args.has('--execute');
  const deleteMinio = args.has('--delete-minio');
  if (deleteMinio && !execute) {
    throw new Error('--delete-minio requires --execute');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const storage = app.get(StorageService);
    const report = await storage.migrateMinioToGoogleDrive({
      dryRun: !execute,
      deleteMinio,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.failures.length) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
