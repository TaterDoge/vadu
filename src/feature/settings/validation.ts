export class SettingsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasFields(
  value: unknown,
  fields: string[],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}

export function invalidConfig(
  message = '配置格式损坏或不受支持，原配置已保留，未覆盖。',
) {
  return new SettingsError('INVALID_CONFIG', message);
}
