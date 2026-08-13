import { Global, Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { TenantRepository } from './tenant.repository';
import { AuditRepository } from './audit.repository';

@Global()
@Module({
  providers: [UserRepository, TenantRepository, AuditRepository],
  exports: [UserRepository, TenantRepository, AuditRepository],
})
export class RepositoriesModule {}
