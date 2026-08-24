import { Module } from '@nestjs/common';
import { SystemUpdateController } from './system-update.controller';
import { SystemUpdateService } from './system-update.service';

@Module({
  controllers: [SystemUpdateController],
  providers: [SystemUpdateService],
  exports: [SystemUpdateService],
})
export class SystemUpdateModule {}
