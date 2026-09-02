import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { SystemUpdateController } from './system-update.controller';
import { SystemUpdateService } from './system-update.service';

@Module({
  imports: [PrismaModule],
  controllers: [SystemUpdateController],
  providers: [SystemUpdateService],
  exports: [SystemUpdateService],
})
export class SystemUpdateModule {}
