/**
 * 密钥存储：safeStorage 异步 API 加密落盘，按 profileId 分桶。
 * Linux 无密钥环（basic_text）或加密不可用时降级为会话内存，绝不写明文盘。
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { app, safeStorage } from "electron";

import type { SecretStorageState } from "../../../shared/ipc";

type SecretsFile = {
  version: 1;
  entries: Record<string, Record<string, { cipher: string }>>;
};

let mode: "disk" | "memory" = "memory";
let backend: string | undefined;
const memory = new Map<string, Map<string, string>>();
let writeChain: Promise<void> = Promise.resolve();

function secretsPath(): string {
  return join(app.getPath("userData"), "secrets.bin");
}

async function encryptEntry(
  name: string,
  plain: string
): Promise<[string, { cipher: string }]> {
  const cipher = await safeStorage.encryptStringAsync(plain);
  return [name, { cipher: cipher.toString("base64") }];
}

async function persist(snapshot = memory): Promise<void> {
  if (mode !== "disk") {
    return;
  }
  const buckets = [...snapshot.entries()].map(async ([profileId, names]) => {
    const entries = await Promise.all(
      [...names.entries()].map(([name, plain]) => encryptEntry(name, plain))
    );
    return [profileId, Object.fromEntries(entries)] as const;
  });
  const file: SecretsFile = {
    entries: Object.fromEntries(await Promise.all(buckets)),
    version: 1,
  };
  const target = secretsPath();
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(file), "utf8");
  renameSync(tmp, target);
}

function enqueueMutation(
  change: (snapshot: Map<string, Map<string, string>>) => void
): Promise<void> {
  const operation = writeChain
    .catch(() => undefined)
    .then(async () => {
      const snapshot = new Map(
        [...memory].map(([id, names]) => [id, new Map(names)])
      );
      change(snapshot);
      await persist(snapshot);
      memory.clear();
      for (const [id, names] of snapshot) {
        memory.set(id, names);
      }
    });
  writeChain = operation;
  return operation;
}

function readSecretsFile(): SecretsFile | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(secretsPath(), "utf8"));
    if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.entries)) {
      throw new Error("Invalid secrets file");
    }
    for (const names of Object.values(raw.entries)) {
      if (
        !isRecord(names) ||
        Object.values(names).some(
          (entry) => !isRecord(entry) || typeof entry.cipher !== "string"
        )
      ) {
        throw new Error("Invalid secrets entries");
      }
    }
    return raw as SecretsFile;
  } catch (cause) {
    if (existsSync(secretsPath())) {
      throw new Error("密钥文件损坏，已保留原文件", { cause });
    }
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function loadDiskSecrets(file: SecretsFile): Promise<boolean> {
  let needsReEncrypt = false;
  const jobs: Promise<void>[] = [];
  for (const [profileId, names] of Object.entries(file.entries)) {
    for (const [name, entry] of Object.entries(names)) {
      jobs.push(
        (async () => {
          try {
            const { result, shouldReEncrypt } =
              await safeStorage.decryptStringAsync(
                Buffer.from(entry.cipher, "base64")
              );
            let bucket = memory.get(profileId);
            if (!bucket) {
              bucket = new Map();
              memory.set(profileId, bucket);
            }
            bucket.set(name, result);
            if (shouldReEncrypt) {
              needsReEncrypt = true;
            }
          } catch (cause) {
            throw new Error("密钥解密失败，已保留原文件", { cause });
          }
        })()
      );
    }
  }
  await Promise.all(jobs);
  return needsReEncrypt;
}

export async function initSecrets(): Promise<void> {
  if (process.platform === "linux") {
    backend = safeStorage.getSelectedStorageBackend();
    if (backend === "basic_text") {
      return;
    }
  }
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    return;
  }
  const file = readSecretsFile();
  const needsReEncrypt = file ? await loadDiskSecrets(file) : false;
  mode = "disk";
  if (needsReEncrypt) {
    // 密钥环轮换：回写新密文，否则某次系统更新后 key 会解不开
    enqueueMutation(() => undefined).catch(() => {
      // 回写失败仅影响下次解密，不阻断启动
    });
  }
}

export function setSecret(
  profileId: string,
  name: string,
  value: string
): Promise<void> {
  return enqueueMutation((snapshot) => {
    const bucket = snapshot.get(profileId) ?? new Map<string, string>();
    bucket.set(name, value);
    snapshot.set(profileId, bucket);
  });
}

export function clearSecret(profileId: string, name: string): Promise<void> {
  return enqueueMutation((snapshot) => {
    snapshot.get(profileId)?.delete(name);
  });
}

export function clearProfileSecrets(profileId: string): Promise<void> {
  return enqueueMutation((snapshot) => {
    snapshot.delete(profileId);
  });
}

export function getSecret(profileId: string, name: string): string | undefined {
  return memory.get(profileId)?.get(name);
}

export function hasSecret(profileId: string, name: string): boolean {
  return getSecret(profileId, name) !== undefined;
}

export function secretStorageState(): SecretStorageState {
  return {
    available: mode === "disk",
    backend,
    plaintext: false,
  };
}
