import type { ReactNode, RefObject } from "react";
import { move } from "@dnd-kit/helpers";
import type { DragEndEvent } from "@dnd-kit/react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { Input } from "@renderer/components/ui/input";
import { StaggerList } from "@renderer/components/ui/stagger-list";
import { Switch } from "@renderer/components/ui/switch";
import type { PluginKind, Profile } from "@shared/ipc";
import { cn } from "cn";

import { KIND_ADD, KIND_EMPTY } from "../kinds";
import type { FilterState } from "../provider-editor";
import { PluginIcon } from "./provider-icon";

type RowProps = {
  index: number;
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
  profile: Profile;
  reorderable: boolean;
  saving: boolean;
  selected: boolean;
  toggling: boolean;
};

function ProviderRow({
  index,
  onSelect,
  onToggle,
  profile,
  reorderable,
  saving,
  selected,
  toggling,
}: RowProps): ReactNode {
  const { ref, handleRef, isDragging } = useSortable({
    disabled: !reorderable || saving,
    id: profile.id,
    index,
  });

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: 整行可点，键盘由行内名称按钮冒泡到此处
    <div
      className={cn(
        "my-1 flex w-full cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-sm transition-colors motion-reduce:transition-none",
        selected
          ? "border-border bg-muted"
          : "border-transparent hover:bg-muted",
        isDragging && "opacity-60"
      )}
      onClick={onSelect}
      ref={ref}
    >
      <Button
        aria-label={`拖动排序 ${profile.name}`}
        className="shrink-0 cursor-grab text-muted-foreground"
        disabled={!reorderable || saving}
        onClick={(event) => event.stopPropagation()}
        ref={handleRef}
        size="icon-xs"
        variant="ghost"
      >
        <span
          aria-hidden="true"
          className="icon-[lucide--grip-vertical] size-3.5"
        />
      </Button>
      <PluginIcon pluginId={profile.pluginId} />
      {/* 自身无 handler，点按 / 回车靠冒泡触发整行选中 */}
      <Button
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 px-0 text-left"
        size="xs"
        variant="ghost"
      >
        <span className="w-full truncate font-normal text-[0.6875rem] text-muted-foreground">
          {profile.name}
        </span>
      </Button>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[0.6875rem]",
          profile.enabled
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {profile.enabled ? "已启用" : "未启用"}
      </span>
      <Switch
        aria-label={`启用 ${profile.name}`}
        checked={profile.enabled}
        disabled={saving || toggling}
        onCheckedChange={onToggle}
        onClick={(event) => event.stopPropagation()}
        size="sm"
      />
    </div>
  );
}

type LeftPanelProps = {
  /** 新增按钮的非 saving 禁用条件（应用未就绪或该 kind 无插件），由父层判定 */
  addDisabled: boolean;
  /** 当前 tab 的插件 kind，决定文案 */
  kind: PluginKind;
  /** 当前 kind 的 profile 总数（不受搜索/过滤影响），显示在标题旁 */
  kindCount: number;
  /** 启用状态过滤，非 "all" 时禁用拖拽排序 */
  filter: FilterState;
  /** 已按 query 与 filter 过滤后的可见列表；拖拽只改这份顺序 */
  filtered: Profile[];
  /** 当前 kind 是否至少有一个插件；为 false 时整表换成提示，不渲染 profile 行 */
  hasPlugins: boolean;
  /** 列表滚动容器，父层用它把新增后的服务商滚回可见区 */
  listRef: RefObject<HTMLDivElement | null>;
  /** 点击新增按钮，打开新增服务商 dialog */
  onAdd: () => void;
  /** 切换启用状态过滤 */
  onFilterChange: (filter: FilterState) => void;
  /** 搜索框输入变化（受控） */
  onQueryChange: (query: string) => void;
  /** 拖拽结束后提交新的完整顺序，交由父层落盘 */
  onReorder: (ordered: Profile[]) => void;
  /** 点击某行，请求切换到该 profile 的编辑态 */
  onSelect: (id: string) => void;
  /** 切换某 profile 的启用开关 */
  onToggleEnabled: (profile: Profile, enabled: boolean) => void;
  /** 搜索关键词（受控），非空时禁用拖拽排序 */
  query: string;
  /** 保存中，禁用拖拽、启用开关与新增按钮 */
  saving: boolean;
  /** 当前选中项 id */
  selectedId: string | null;
  /** 正在切换启用状态的 profile id，只锁对应行的开关，不影响表单保存态 */
  togglingId: string | null;
};

function LeftPanel({
  addDisabled,
  kind,
  kindCount,
  filter,
  filtered,
  hasPlugins,
  listRef,
  onAdd,
  onFilterChange,
  onQueryChange,
  onReorder,
  onSelect,
  onToggleEnabled,
  query,
  saving,
  selectedId,
  togglingId,
}: LeftPanelProps): ReactNode {
  // 过滤态下 filtered 只是子集，拖拽落盘的顺序会错位；保持全量可见才允许拖拽
  const reorderable = filter === "all" && query.trim() === "";

  const handleDragEnd = (event: DragEndEvent): void => {
    if (event.canceled) {
      return;
    }
    const next = move(filtered, event);
    // move 无位移时返回原数组或等值数组，避免白写一次配置
    if (next.every((entry, index) => entry === filtered[index])) {
      return;
    }
    onReorder(next);
  };

  return (
    <aside className="flex min-h-0 flex-col gap-3 md:self-stretch">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-sm">服务商</h2>
        <span className="text-muted-foreground text-xs">{kindCount}</span>
      </div>
      <div className="relative">
        <Input
          aria-label="搜索服务商"
          className="pr-8"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索服务商"
          value={query}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="按启用状态过滤"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                size="icon-xs"
                title="按启用状态过滤"
                variant="ghost"
              />
            }
          >
            <span
              aria-hidden="true"
              className={cn(
                "icon-[lucide--filter] size-3.5",
                filter === "all" ? "text-muted-foreground" : "text-primary"
              )}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              onValueChange={(value) => onFilterChange(value as FilterState)}
              value={filter}
            >
              <DropdownMenuLabel>按启用状态过滤</DropdownMenuLabel>
              {(
                [
                  ["all", "全部"],
                  ["enabled", "已启用"],
                  ["disabled", "未启用"],
                ] as [FilterState, string][]
              ).map(([value, label]) => (
                <DropdownMenuRadioItem
                  className="text-nowrap"
                  key={value}
                  value={value}
                >
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        className="-mx-1 flex flex-1 flex-col overflow-y-auto overflow-x-clip px-1"
        ref={listRef}
      >
        {/* 每项都带稳定 key：条件行增删不能让后面的行换索引重放入场 */}
        <DragDropProvider onDragEnd={handleDragEnd}>
          <StaggerList>
            {hasPlugins ? null : (
              <p className="text-muted-foreground text-sm" key="no-plugins">
                {KIND_EMPTY[kind]}，请检查应用安装状态。
              </p>
            )}
            {hasPlugins
              ? filtered.map((profile, index) => (
                  <ProviderRow
                    index={index}
                    key={profile.id}
                    onSelect={() => onSelect(profile.id)}
                    onToggle={(enabled) => onToggleEnabled(profile, enabled)}
                    profile={profile}
                    reorderable={reorderable}
                    saving={saving}
                    selected={selectedId === profile.id}
                    toggling={togglingId === profile.id}
                  />
                ))
              : null}
            {hasPlugins && filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm" key="empty">
                没有匹配的服务商。
              </p>
            ) : null}
          </StaggerList>
        </DragDropProvider>
      </div>
      <Button
        className="w-full"
        disabled={addDisabled || saving}
        onClick={onAdd}
        variant="outline"
      >
        {KIND_ADD[kind]}
      </Button>
    </aside>
  );
}

export { LeftPanel };
