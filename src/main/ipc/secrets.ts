import { VaduError } from "../../shared/errors";
import type { SecretStorageState } from "../../shared/ipc";
import { IPC } from "../../shared/ipc";
import {
  clearSecret,
  hasSecret,
  secretStorageState,
  setSecret,
} from "../core/config/secrets";
import { readProfiles } from "../core/config/store";
import { registry } from "../core/plugin/registry";
import { handle } from "./index";

function assertSecretField(profile: { pluginId: string }, name: string): void {
  const field = registry.get(profile.pluginId)?.descriptor.configSchema
    ?.properties[name];
  if (field?.type !== "secret") {
    throw new VaduError("INVALID_CONFIG", "该字段不是密钥字段");
  }
}

export function registerSecretsIpc(): void {
  handle<null, SecretStorageState>(IPC.getSecretStorage, () =>
    Promise.resolve(secretStorageState())
  );

  handle<unknown, boolean>(IPC.secrets.has, (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new VaduError("INVALID_CONFIG", "密钥参数非法");
    }
    const { profileId, name } = raw as Record<string, unknown>;
    if (typeof profileId !== "string" || typeof name !== "string") {
      throw new VaduError("INVALID_CONFIG", "密钥参数非法");
    }
    const profile = readProfiles().find((entry) => entry.id === profileId);
    if (!profile) {
      throw new VaduError("INVALID_CONFIG", "profile 不存在");
    }
    if (name.length === 0 || name.length > 100) {
      throw new VaduError("INVALID_CONFIG", "密钥名长度非法");
    }
    assertSecretField(profile, name);
    return Promise.resolve(hasSecret(profileId, name));
  });

  handle<unknown, null>(IPC.secrets.set, async (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new VaduError("INVALID_CONFIG", "密钥参数非法");
    }
    const { profileId, name, value } = raw as Record<string, unknown>;
    if (
      typeof profileId !== "string" ||
      typeof name !== "string" ||
      typeof value !== "string"
    ) {
      throw new VaduError("INVALID_CONFIG", "密钥参数非法");
    }
    const profile = readProfiles().find((entry) => entry.id === profileId);
    if (!profile) {
      throw new VaduError("INVALID_CONFIG", "profile 不存在");
    }
    if (name.length === 0 || name.length > 100) {
      throw new VaduError("INVALID_CONFIG", "密钥名长度非法");
    }
    if (value.length > 4096) {
      throw new VaduError("INVALID_CONFIG", "密钥长度超限");
    }
    assertSecretField(profile, name);
    if (value === "") {
      await clearSecret(profileId, name);
    } else {
      await setSecret(profileId, name, value);
    }
    return null;
  });
}
