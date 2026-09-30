import { Injectable } from '@nestjs/common';
import type {
  OpenAPIObject,
  SchemaObject,
  ReferenceObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
} from '@nestjs/swagger';

export interface FormattedRequestBody {
  contentType: string;
  required: boolean;
  typeScriptDefinition: string;
  exampleJson: string;
}

export interface FormattedResponseItem {
  statusCode: string;
  description: string;
  contentType?: string;
  typeScriptDefinition?: string;
  exampleJson?: string;
}

export interface SchemaTraversalOptions {
  refStack?: string[];
  depth?: number;
  maxDepth?: number;
  indent?: string;
}

@Injectable()
export class McpSchemaFormatterService {
  /**
   * Safe dereferencing of a $ref (e.g., '#/components/schemas/CategoryTreeDto')
   */
  resolveRef(
    ref: string,
    document?: OpenAPIObject,
  ): SchemaObject | ReferenceObject | undefined {
    if (!document || !ref.startsWith('#/')) {
      return undefined;
    }

    const segments = ref.replace(/^#\//, '').split('/');
    let current: unknown = document;

    for (const segment of segments) {
      if (
        current &&
        typeof current === 'object' &&
        segment in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    if (current && typeof current === 'object') {
      return current;
    }

    return undefined;
  }

  /**
   * Extracts clean schema name from $ref
   */
  getRefName(ref: string): string {
    const parts = ref.split('/');
    return parts[parts.length - 1] || ref;
  }

  /**
   * Checks whether an object is a ReferenceObject ($ref)
   */
  isReferenceObject(obj: unknown): obj is ReferenceObject {
    return Boolean(
      obj &&
      typeof obj === 'object' &&
      '$ref' in (obj as Record<string, unknown>) &&
      typeof (obj as Record<string, unknown>).$ref === 'string',
    );
  }

  /**
   * Formats an OpenAPI schema into a clean, human/LLM-readable TypeScript interface/type
   * with circular reference detection and depth capping.
   */
  formatSchemaToTypeScript(
    schemaOrRef?: SchemaObject | ReferenceObject,
    document?: OpenAPIObject,
    options: SchemaTraversalOptions = {},
  ): string {
    if (!schemaOrRef) {
      return 'unknown';
    }

    const maxDepth = options.maxDepth ?? 6;
    const depth = options.depth ?? 0;
    const refStack = options.refStack ?? [];
    const indent = options.indent ?? '  ';
    const currentIndent = indent.repeat(depth);
    const nextIndent = indent.repeat(depth + 1);

    if (this.isReferenceObject(schemaOrRef)) {
      const ref = schemaOrRef.$ref;
      const refName = this.getRefName(ref);

      if (refStack.includes(ref)) {
        return `${refName} /* [Circular ref to ${ref}] */`;
      }

      if (depth >= maxDepth) {
        return `${refName} /* [Max depth reached] */`;
      }

      const resolved = this.resolveRef(ref, document);
      if (!resolved) {
        return `${refName} /* [Unresolved reference] */`;
      }

      return this.formatSchemaToTypeScript(resolved, document, {
        ...options,
        refStack: [...refStack, ref],
        depth: depth + 1,
      });
    }

    const schema = schemaOrRef;

    if (schema.allOf && schema.allOf.length > 0) {
      const parts = schema.allOf.map((item) =>
        this.formatSchemaToTypeScript(item, document, {
          ...options,
          depth,
        }),
      );
      return parts.join(' & ');
    }

    if (schema.oneOf && schema.oneOf.length > 0) {
      const parts = schema.oneOf.map((item) =>
        this.formatSchemaToTypeScript(item, document, {
          ...options,
          depth,
        }),
      );
      return `(${parts.join(' | ')})`;
    }

    if (schema.anyOf && schema.anyOf.length > 0) {
      const parts = schema.anyOf.map((item) =>
        this.formatSchemaToTypeScript(item, document, {
          ...options,
          depth,
        }),
      );
      return `(${parts.join(' | ')})`;
    }

    if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum
        .map((val) => (typeof val === 'string' ? `'${val}'` : String(val)))
        .join(' | ');
    }

    if (schema.type === 'array' || schema.items) {
      const itemType = schema.items
        ? this.formatSchemaToTypeScript(schema.items, document, {
            ...options,
            depth: depth + 1,
          })
        : 'unknown';

      if (
        itemType.includes('\n') ||
        itemType.includes(' | ') ||
        itemType.includes(' & ')
      ) {
        return `Array<${itemType}>`;
      }
      return `${itemType}[]`;
    }

    if (schema.type === 'object' || schema.properties) {
      const properties = schema.properties ?? {};
      const requiredFields = new Set(schema.required ?? []);
      const propKeys = Object.keys(properties);

      if (propKeys.length === 0) {
        if (schema.additionalProperties) {
          if (typeof schema.additionalProperties === 'object') {
            const addType = this.formatSchemaToTypeScript(
              schema.additionalProperties,
              document,
              { ...options, depth: depth + 1 },
            );
            return `Record<string, ${addType}>`;
          }
          return 'Record<string, unknown>';
        }
        return 'Record<string, unknown>';
      }

      const lines: string[] = ['{'];
      for (const key of propKeys) {
        const prop = properties[key];
        const isRequired = requiredFields.has(key);
        const optMarker = isRequired ? '' : '?';

        let comment = '';
        if (!this.isReferenceObject(prop)) {
          const p = prop;
          const commentParts: string[] = [];
          if (p.description) commentParts.push(p.description);
          if (p.example !== undefined)
            commentParts.push(`example: ${JSON.stringify(p.example)}`);
          if (p.default !== undefined)
            commentParts.push(`default: ${JSON.stringify(p.default)}`);
          if (commentParts.length > 0) {
            comment = ` // ${commentParts.join(' | ')}`;
          }
        }

        const propType = this.formatSchemaToTypeScript(prop, document, {
          ...options,
          depth: depth + 1,
        });

        lines.push(`${nextIndent}${key}${optMarker}: ${propType};${comment}`);
      }
      lines.push(`${currentIndent}}`);
      return lines.join('\n');
    }

    if (schema.type === 'string') {
      if (schema.format) {
        return `string /* ${schema.format} */`;
      }
      return 'string';
    }

    if (schema.type === 'integer' || schema.type === 'number') {
      return 'number';
    }

    if (schema.type === 'boolean') {
      return 'boolean';
    }

    return 'unknown';
  }

  /**
   * Generates a safe, realistic sample JSON object from a schema with circular reference guards.
   */
  generateExampleJson(
    schemaOrRef?: SchemaObject | ReferenceObject,
    document?: OpenAPIObject,
    options: SchemaTraversalOptions = {},
  ): unknown {
    if (!schemaOrRef) {
      return null;
    }

    const maxDepth = options.maxDepth ?? 5;
    const depth = options.depth ?? 0;
    const refStack = options.refStack ?? [];

    if (this.isReferenceObject(schemaOrRef)) {
      const ref = schemaOrRef.$ref;
      const refName = this.getRefName(ref);

      if (refStack.includes(ref)) {
        return `[Circular Reference to ${refName}]`;
      }

      if (depth >= maxDepth) {
        return `[Max Depth Reached: ${refName}]`;
      }

      const resolved = this.resolveRef(ref, document);
      if (!resolved) {
        return `[Unresolved: ${refName}]`;
      }

      return this.generateExampleJson(resolved, document, {
        ...options,
        refStack: [...refStack, ref],
        depth: depth + 1,
      });
    }

    const schema = schemaOrRef;

    if (schema.example !== undefined) {
      return schema.example;
    }

    if (schema.default !== undefined) {
      return schema.default;
    }

    if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum[0];
    }

    if (schema.allOf && schema.allOf.length > 0) {
      const merged: Record<string, unknown> = {};
      for (const item of schema.allOf) {
        const res = this.generateExampleJson(item, document, {
          ...options,
          depth: depth + 1,
        });
        if (res && typeof res === 'object' && !Array.isArray(res)) {
          Object.assign(merged, res);
        }
      }
      return merged;
    }

    if (schema.oneOf && schema.oneOf.length > 0) {
      return this.generateExampleJson(schema.oneOf[0], document, {
        ...options,
        depth: depth + 1,
      });
    }

    if (schema.anyOf && schema.anyOf.length > 0) {
      return this.generateExampleJson(schema.anyOf[0], document, {
        ...options,
        depth: depth + 1,
      });
    }

    if (schema.type === 'array' || schema.items) {
      if (this.isReferenceObject(schema.items)) {
        const ref = schema.items.$ref;
        if (refStack.includes(ref)) {
          return [`[Circular Reference to ${this.getRefName(ref)}]`];
        }
      }
      if (depth >= maxDepth) {
        return ['[Max Depth Reached]'];
      }
      const itemExample = schema.items
        ? this.generateExampleJson(schema.items, document, {
            ...options,
            depth: depth + 1,
          })
        : 'item';
      return [itemExample];
    }

    if (schema.type === 'object' || schema.properties) {
      if (depth >= maxDepth) {
        return { message: '[Max Depth Reached]' };
      }
      const properties = schema.properties ?? {};
      const result: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(properties)) {
        result[key] = this.generateExampleJson(prop, document, {
          ...options,
          depth: depth + 1,
        });
      }
      return result;
    }

    if (schema.type === 'string') {
      if (schema.format === 'uuid') {
        return '7b8f9e10-1234-4567-89ab-cdef01234567';
      }
      if (schema.format === 'date-time') {
        return '2026-09-24T10:00:00.000Z';
      }
      if (schema.format === 'date') {
        return '2026-09-24';
      }
      if (schema.format === 'email') {
        return 'user@example.com';
      }
      if (schema.format === 'uri' || schema.format === 'url') {
        return 'https://example.com';
      }
      return 'string';
    }

    if (schema.type === 'integer' || schema.type === 'number') {
      if (schema.minimum !== undefined) {
        return schema.minimum;
      }
      return 1;
    }

    if (schema.type === 'boolean') {
      return true;
    }

    return null;
  }

  /**
   * Formats OpenAPI parameter objects into a Markdown table
   */
  formatParametersTable(
    parameters?: (ParameterObject | ReferenceObject)[],
    document?: OpenAPIObject,
  ): string {
    if (!parameters || parameters.length === 0) {
      return '_Параметры отсутствуют._\n';
    }

    const rows: string[] = [
      '| Параметр | Расположение | Тип | Обязательный | По умолчанию | Описание |',
      '| :--- | :--- | :--- | :--- | :--- | :--- |',
    ];

    for (const paramOrRef of parameters) {
      let param: ParameterObject;

      if (this.isReferenceObject(paramOrRef)) {
        const resolved = this.resolveRef(paramOrRef.$ref, document);
        if (!resolved) continue;
        param = resolved as unknown as ParameterObject;
      } else {
        param = paramOrRef;
      }

      const name = `\`${param.name}\``;
      const location = `\`${param.in}\``;
      let typeStr = 'string';
      let defaultVal = '-';
      const required = param.required ? '**Да**' : 'Нет';
      let description = param.description ?? '-';

      if (param.schema) {
        typeStr = `\`${this.formatSchemaToTypeScript(param.schema, document, { maxDepth: 2 })}\``;
        if (!this.isReferenceObject(param.schema)) {
          const s = param.schema;
          if (s.default !== undefined) {
            defaultVal = `\`${JSON.stringify(s.default)}\``;
          }
          if (s.enum) {
            description += ` (Enum: ${s.enum.join(', ')})`;
          }
        }
      }

      description = description.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
      rows.push(
        `| ${name} | ${location} | ${typeStr} | ${required} | ${defaultVal} | ${description} |`,
      );
    }

    return rows.join('\n') + '\n';
  }

  /**
   * Formats OpenAPI Request Body into TypeScript and JSON representations
   */
  formatRequestBody(
    requestBody?: RequestBodyObject | ReferenceObject,
    document?: OpenAPIObject,
  ): FormattedRequestBody | null {
    if (!requestBody) {
      return null;
    }

    let body: RequestBodyObject;
    if (this.isReferenceObject(requestBody)) {
      const resolved = this.resolveRef(requestBody.$ref, document);
      if (!resolved) return null;
      body = resolved as unknown as RequestBodyObject;
    } else {
      body = requestBody;
    }

    const content = body.content ?? {};
    const contentTypes = Object.keys(content);
    if (contentTypes.length === 0) {
      return null;
    }

    const contentType = contentTypes.includes('application/json')
      ? 'application/json'
      : contentTypes[0];

    const mediaType = content[contentType];
    const schema = mediaType?.schema;

    const schemaName =
      schema &&
      typeof schema === 'object' &&
      '$ref' in schema &&
      typeof schema.$ref === 'string'
        ? this.getRefName(schema.$ref)
        : undefined;
    let typeScriptDefinition = this.formatSchemaToTypeScript(schema, document);
    if (schemaName) {
      typeScriptDefinition = `// DTO: ${schemaName}\n${typeScriptDefinition}`;
    }
    const exampleValue = this.generateExampleJson(schema, document);
    const exampleJson = JSON.stringify(exampleValue, null, 2);
    return {
      contentType,
      required: Boolean(body.required),
      typeScriptDefinition,
      exampleJson,
    };
  }

  /**
   * Formats OpenAPI Responses into structured response items
   */
  formatResponses(
    responses?: ResponsesObject,
    document?: OpenAPIObject,
  ): FormattedResponseItem[] {
    if (!responses) {
      return [];
    }

    const result: FormattedResponseItem[] = [];

    for (const [statusCode, responseOrRef] of Object.entries(responses)) {
      if (!responseOrRef) continue;

      let response: ResponseObject;
      if (this.isReferenceObject(responseOrRef)) {
        const resolved = this.resolveRef(responseOrRef.$ref, document);
        if (!resolved) continue;
        response = resolved as unknown as ResponseObject;
      } else {
        response = responseOrRef;
      }

      const content = response.content ?? {};
      const contentTypes = Object.keys(content);

      if (contentTypes.length === 0) {
        result.push({
          statusCode,
          description: response.description ?? '',
        });
        continue;
      }

      const contentType = contentTypes.includes('application/json')
        ? 'application/json'
        : contentTypes[0];

      const mediaType = content[contentType];
      const schema = mediaType?.schema;

      const schemaName =
        schema &&
        typeof schema === 'object' &&
        '$ref' in schema &&
        typeof schema.$ref === 'string'
          ? this.getRefName(schema.$ref)
          : undefined;
      let typeScriptDefinition = schema
        ? this.formatSchemaToTypeScript(schema, document)
        : undefined;
      if (schemaName && typeScriptDefinition) {
        typeScriptDefinition = `// DTO: ${schemaName}\n${typeScriptDefinition}`;
      }

      const exampleValue = schema
        ? this.generateExampleJson(schema, document)
        : undefined;

      const exampleJson =
        exampleValue !== undefined
          ? JSON.stringify(exampleValue, null, 2)
          : undefined;

      result.push({
        statusCode,
        description: response.description ?? '',
        contentType,
        typeScriptDefinition,
        exampleJson,
      });
    }

    return result;
  }

  /**
   * Extracts searchable tokens/text from a schema, safely handling circular references.
   */
  extractSchemaSearchText(
    schemaOrRef?: SchemaObject | ReferenceObject,
    document?: OpenAPIObject,
    visited: Set<string> = new Set(),
    depth = 0,
  ): string[] {
    if (!schemaOrRef || depth > 5) {
      return [];
    }

    const tokens: string[] = [];

    if (this.isReferenceObject(schemaOrRef)) {
      const ref = schemaOrRef.$ref;
      tokens.push(this.getRefName(ref));

      if (visited.has(ref)) {
        return tokens;
      }
      visited.add(ref);

      const resolved = this.resolveRef(ref, document);
      if (resolved) {
        tokens.push(
          ...this.extractSchemaSearchText(
            resolved,
            document,
            visited,
            depth + 1,
          ),
        );
      }
      return tokens;
    }

    const schema = schemaOrRef;
    if (schema.title) tokens.push(schema.title);
    if (schema.description) tokens.push(schema.description);
    if (schema.enum) {
      tokens.push(...schema.enum.map((e) => String(e)));
    }

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        tokens.push(propName);
        tokens.push(
          ...this.extractSchemaSearchText(
            propSchema,
            document,
            visited,
            depth + 1,
          ),
        );
      }
    }

    if (schema.items) {
      tokens.push(
        ...this.extractSchemaSearchText(
          schema.items,
          document,
          visited,
          depth + 1,
        ),
      );
    }

    if (schema.allOf) {
      for (const sub of schema.allOf) {
        tokens.push(
          ...this.extractSchemaSearchText(sub, document, visited, depth + 1),
        );
      }
    }

    return tokens;
  }
}
