import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), UsersModule, SecurityModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
