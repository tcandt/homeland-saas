import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { SystemUpdateController } from './system-update.controller';
import { SystemUpdateService } from './system-update.service';
import { SystemUpdateScheduler } from './system-update.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [SystemUpdateController],
  providers: [SystemUpdateService, SystemUpdateScheduler],
  exports: [SystemUpdateService, SystemUpdateScheduler],
})
export class SystemUpdateModule {}
