import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './services/mcp.service';
import { McpSchemaFormatterService } from './services/mcp-schema-formatter.service';

@Module({
  controllers: [McpController],
  providers: [McpService, McpSchemaFormatterService],
  exports: [McpService, McpSchemaFormatterService],
})
export class McpModule {}
