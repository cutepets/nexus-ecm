import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

@Module({
  controllers: [EmployeesController, DepartmentsController, PositionsController],
  providers: [EmployeesService, DepartmentsService, PositionsService],
})
export class EmployeesModule {}
