/**
 * 密钥存储：safeStorage 异步 API 加密落盘，按 profileId 分桶。
 * Linux 无密钥环（basic_text）或加密不可用时降级为会话内存，绝不写明文盘。
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { app, safeStorage } from "electron";

import { VaduError } from "../../../shared/errors";
import type { SecretStorageState } from "../../../shared/ipc";

type SecretsFile = {
  version: 1;
  entries: Record<string, Record<string, { cipher: string }>>;
};

export type SecretBuckets = Record<string, Record<string, string>>;

let mode: "disk" | "memory" = "memory";
let backend: string | undefined;
let loadState: "uninitialized" | "ready" | "failed" = "uninitialized";
let loadError: Error | null = null;
const memory = new Map<string, Map<string, string>>();
let writeChain: Promise<void> = Promise.resolve();

export function secretsFilePath(): string {
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
  const target = secretsFilePath();
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
    const raw: unknown = JSON.parse(readFileSync(secretsFilePath(), "utf8"));
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
    if (existsSync(secretsFilePath())) {
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

function markSessionOnly(reason?: Error): void {
  mode = "memory";
  if (existsSync(secretsFilePath())) {
    // 文件在但没读到：可能含旧密钥，完整导出必须拒绝
    loadState = "failed";
    loadError = reason ?? new Error("密钥文件存在但当前密钥存储不可读取");
    return;
  }
  loadState = "ready";
  loadError = null;
}

export async function initSecrets(): Promise<void> {
  loadState = "uninitialized";
  loadError = null;
  if (process.platform === "linux") {
    backend = safeStorage.getSelectedStorageBackend();
    if (backend === "basic_text") {
      markSessionOnly();
      return;
    }
  }
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    markSessionOnly();
    return;
  }
  try {
    const file = readSecretsFile();
    const needsReEncrypt = file ? await loadDiskSecrets(file) : false;
    mode = "disk";
    loadState = "ready";
    if (needsReEncrypt) {
      // 密钥环轮换：回写新密文，否则某次系统更新后 key 会解不开
      enqueueMutation(() => undefined).catch(() => {
        // 回写失败仅影响下次解密，不阻断启动
      });
    }
  } catch (error) {
    mode = "memory";
    loadState = "failed";
    loadError = error instanceof Error ? error : new Error(String(error));
    throw error;
  }
}

/** 导出必须等先前写入落盘；初始化失败/未读取旧文件时拒绝“完整”导出 */
export async function snapshotSecrets(
  profileIds: string[]
): Promise<SecretBuckets> {
  if (loadState === "uninitialized") {
    throw new VaduError("INTERNAL", "密钥存储尚未初始化，无法完整导出");
  }
  if (loadState === "failed" || loadError) {
    throw new VaduError("INTERNAL", "密钥文件未完整读取，无法完整导出");
  }
  await writeChain.catch(() => undefined);
  // null prototype：profileId 来自配置，避免 "__proto__" 之类的键改写普通对象原型
  const snapshot: SecretBuckets = Object.create(null) as SecretBuckets;
  for (const profileId of new Set(profileIds)) {
    const bucket = memory.get(profileId);
    if (bucket && bucket.size > 0) {
      snapshot[profileId] = Object.fromEntries(bucket);
    }
  }
  return snapshot;
}

export function canPersistSecrets(): boolean {
  return mode === "disk" && loadState === "ready" && loadError === null;
}

/** 批量把新 profile 的密钥并入现有桶；持久化失败会保留旧内存/旧桶 */
export function mergeSecrets(buckets: SecretBuckets): Promise<void> {
  const entries = Object.entries(buckets).filter(
    ([, names]) => Object.keys(names).length > 0
  );
  if (entries.length === 0) {
    return Promise.resolve();
  }
  if (!canPersistSecrets()) {
    return Promise.reject(
      new VaduError("INTERNAL", "系统无法安全持久化密钥，已取消恢复")
    );
  }
  return enqueueMutation((snapshot) => {
    for (const [profileId, names] of entries) {
      const bucket = snapshot.get(profileId) ?? new Map<string, string>();
      for (const [name, value] of Object.entries(names)) {
        bucket.set(name, value);
      }
      snapshot.set(profileId, bucket);
    }
  });
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
