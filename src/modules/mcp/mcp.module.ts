import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './services/mcp.service';
import { McpSchemaFormatterService } from './services/mcp-schema-formatter.service';
import { McpServerService } from './services/mcp-server.service';

@Module({
  controllers: [McpController],
  providers: [McpService, McpSchemaFormatterService, McpServerService],
  exports: [McpService, McpSchemaFormatterService, McpServerService],
})
export class McpModule {}
