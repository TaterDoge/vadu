import { type ReactNode, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@renderer/components/ui/alert";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@renderer/components/ui/item";
import { Switch } from "@renderer/components/ui/switch";
import { AlertCircleIcon, MonitorIcon } from "lucide-react";

function GeneralPage(): ReactNode {
  const [showOnStartup, setShowOnStartup] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.vadu.app
      .getShowMainWindowOnStartup()
      .then((result) => {
        if (result.ok) {
          setShowOnStartup(result.data);
          return;
        }
        setError(result.error.message ?? result.error.code);
      })
      .catch((reason) => console.error(reason));
  }, []);

  const apply = (enabled: boolean): void => {
    setError(null);
    // 乐观更新：开关立刻跟手，主进程回写失败再回滚并报错
    setShowOnStartup(enabled);
    window.vadu.app
      .setShowMainWindowOnStartup(enabled)
      .then((result) => {
        if (result.ok) {
          setShowOnStartup(result.data);
          return;
        }
        setShowOnStartup(!enabled);
        setError(result.error.message ?? result.error.code);
      })
      .catch((reason) => console.error(reason));
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-medium text-sm">启动</h2>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <MonitorIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>启动时显示主界面</ItemTitle>
          <ItemDescription>
            默认关闭，启动只驻留托盘，用托盘菜单或 Dock
            图标进设置；全局热键仍可唤起翻译浮窗
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            aria-label="启动时显示主界面"
            checked={showOnStartup ?? false}
            disabled={showOnStartup === null}
            onCheckedChange={apply}
          />
        </ItemActions>
      </Item>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export { GeneralPage };
