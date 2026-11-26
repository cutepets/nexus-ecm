import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { RoleAssignmentService } from './role-assignment.service';

@Module({
  controllers: [RbacController],
  providers: [RbacService, RoleAssignmentService],
  exports: [RbacService, RoleAssignmentService],
})
export class RbacModule {}
