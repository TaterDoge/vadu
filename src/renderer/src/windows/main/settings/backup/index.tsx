import type { ReactNode } from "react";
import { useState } from "react";
import { AlertDialog } from "@animate-ui/react/primitives/base-ui/alert-dialog";
import { Copy } from "@renderer/components/animate-ui/icons/copy";
import { RotateCcw } from "@renderer/components/animate-ui/icons/rotate-ccw";
import { Alert, AlertDescription } from "@renderer/components/ui/alert";
import { Button } from "@renderer/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@renderer/components/ui/item";
import { AlertIcon } from "@renderer/lib/icons";
import { toast } from "sonner";

type Busy = "export" | "import" | null;

function BackupPage(): ReactNode {
  const [busy, setBusy] = useState<Busy>(null);
  const [restarting, setRestarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled = busy !== null || restarting;

  const exportBackup = (): void => {
    if (disabled) {
      return;
    }
    setBusy("export");
    setError(null);
    setNotice(null);
    window.vadu.config
      .exportBackup()
      .then((result) => {
        if (!result.ok) {
          setError(result.error.message ?? result.error.code);
          return;
        }
        if (result.data.canceled) {
          setNotice("已取消导出，未写入文件。");
          return;
        }
        toast.success(
          `已导出 ${result.data.profileCount} 个服务商、${result.data.secretCount} 个密钥。`
        );
      })
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setBusy(null));
  };

  const importBackup = (): void => {
    if (disabled) {
      return;
    }
    setBusy("import");
    setError(null);
    setNotice(null);
    window.vadu.config
      .importBackup()
      .then((result) => {
        if (!result.ok) {
          setError(result.error.message ?? result.error.code);
          return;
        }
        if (result.data.canceled) {
          setNotice("已取消恢复，当前配置未修改。");
          return;
        }
        setRestarting(true);
        setNotice(
          result.data.legacy
            ? `已恢复 ${result.data.profileCount} 个服务商。旧版备份不含密钥，重启后需重新填写 API Key。`
            : `已恢复 ${result.data.profileCount} 个服务商、${result.data.secretCount} 个密钥，应用即将重启。`
        );
      })
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setBusy(null));
  };

  return (
    <div aria-busy={busy !== null} className="flex flex-col gap-4">
      <h2 className="font-medium text-sm">备份/恢复</h2>

      <Alert className="grid-cols-[auto_1fr] gap-x-2">
        <AlertIcon />
        <AlertDescription>
          完整备份包含外观、快捷键、启动行为、术语表、服务商配置与全部已保存 API
          Key。备份 JSON 是明文文件，任何拿到它的人都能读取密钥，请妥善保管。
          本机配置里的密钥仍由系统加密存储。
        </AlertDescription>
      </Alert>

      <ItemGroup>
        <Item variant="outline">
          <ItemMedia variant="icon">
            <Copy aria-hidden="true" className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>导出 JSON 备份</ItemTitle>
            <ItemDescription>
              保存完整设置、服务商与密钥为 JSON（含明文密钥）
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <AlertDialog.Root>
              <AlertDialog.Trigger
                render={
                  <Button
                    aria-busy={busy === "export"}
                    disabled={disabled}
                    size="sm"
                    variant="outline"
                  />
                }
              >
                {busy === "export" ? "导出中…" : "导出 JSON…"}
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/20 supports-backdrop-filter:backdrop-blur-xs" />
                <AlertDialog.Popup className="fixed inset-0 z-50 m-auto flex h-fit w-[calc(100%-2rem)] max-w-md flex-col gap-4 rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg outline-none">
                  <div className="flex flex-col gap-2">
                    <AlertDialog.Title className="font-heading font-medium text-base">
                      导出完整备份？
                    </AlertDialog.Title>
                    <AlertDialog.Description className="flex flex-col gap-2 text-muted-foreground text-sm">
                      <span>
                        备份 JSON 会包含服务商配置和全部已保存 API Key，且密钥以
                        <strong className="font-medium text-foreground">
                          明文保存
                        </strong>
                        。
                      </span>
                      <span>
                        <strong className="font-medium text-foreground">
                          任何拿到该文件的人都能读取这些密钥
                        </strong>
                        ，请只保存到你信任的位置。
                      </span>
                      <span>本机配置仍由系统加密存储。</span>
                    </AlertDialog.Description>
                  </div>
                  <div className="flex justify-end gap-2">
                    <AlertDialog.Close
                      autoFocus
                      render={<Button type="button" variant="outline" />}
                    >
                      取消
                    </AlertDialog.Close>
                    <AlertDialog.Close
                      onClick={exportBackup}
                      render={<Button type="button" />}
                    >
                      继续导出
                    </AlertDialog.Close>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemMedia variant="icon">
            <RotateCcw aria-hidden="true" className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>从 JSON 恢复</ItemTitle>
            <ItemDescription>
              完整恢复设置、服务商与密钥，完成后重启
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              aria-busy={busy === "import"}
              disabled={disabled}
              onClick={importBackup}
              size="sm"
              variant="destructive"
            >
              {busy === "import" ? "校验中…" : "选择 JSON…"}
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>

      <Alert className="grid-cols-[auto_1fr] gap-x-2">
        <AlertIcon />
        <AlertDescription>
          恢复需再次确认，并停止正在进行的翻译与检测。备份中的密钥会写入本机加密库并绑定到新服务商
          ID，旧备份（v1）不含密钥，需要重新填写。恢复前自动保留配置快照；文件不合法或缺少插件时当前配置保持不变。
        </AlertDescription>
      </Alert>

      {error ? (
        <Alert
          aria-live="polite"
          className="grid-cols-[auto_1fr] gap-x-2"
          variant="destructive"
        >
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}

export { BackupPage };
