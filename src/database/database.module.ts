import { Global, Module } from '@nestjs/common';
import { DrizzleProvider } from './database.provider';

@Global()
@Module({
  providers: [DrizzleProvider],
  exports: [DrizzleProvider],
})
export class DatabaseModule {}
