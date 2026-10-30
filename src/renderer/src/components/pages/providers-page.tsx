import type { ReactNode } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@renderer/components/ui/tabs";

function Placeholder({ children }: { children: ReactNode }): ReactNode {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

/** 服务商按能力分栏：翻译与 TTS 各配各的 endpoint、模型与密钥 */
function ProvidersPage(): ReactNode {
  return (
    <Tabs className="gap-4" defaultValue="translate">
      <TabsList>
        <TabsTrigger value="translate">翻译</TabsTrigger>
        <TabsTrigger value="tts">TTS</TabsTrigger>
      </TabsList>
      <TabsContent value="translate">
        <Placeholder>
          profile、endpoint、模型与密钥还没接上，等对应里程碑落地后可用。
        </Placeholder>
      </TabsContent>
      <TabsContent value="tts">
        <Placeholder>
          TTS 服务商还没接上，插件 kind 落到 tts 后再回来配。
        </Placeholder>
      </TabsContent>
    </Tabs>
  );
}

export { ProvidersPage };
