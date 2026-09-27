import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

export function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

// Propriedades em camelCase no TypeScript, colunas em snake_case no PostgreSQL,
// sem precisar repetir `name:` em cada coluna.
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? toSnakeCase(targetName);
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return toSnakeCase([...embeddedPrefixes, customName ?? propertyName].join('_'));
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableName(firstTableName: string, secondTableName: string): string {
    return toSnakeCase(`${firstTableName}_${secondTableName}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
