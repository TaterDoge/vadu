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
import type { Profile } from "@shared/ipc";
import { cn } from "cn";

import { NEW_PROFILE_ID } from "../model-picker";
import type { FilterState } from "../provider-editor";

type RowProps = {
  index: number;
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
  profile: Profile;
  reorderable: boolean;
  saving: boolean;
  selected: boolean;
  subtitle?: string;
};

function ProviderRow({
  index,
  onSelect,
  onToggle,
  profile,
  reorderable,
  saving,
  selected,
  subtitle,
}: RowProps): ReactNode {
  const { ref, handleRef, isDragging } = useSortable({
    disabled: !reorderable || saving,
    id: profile.id,
    index,
  });

  return (
    <div
      className={cn(
        "my-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors motion-reduce:transition-none",
        selected
          ? "border-border bg-muted"
          : "border-transparent hover:bg-muted",
        isDragging && "opacity-60"
      )}
      ref={ref}
    >
      <Button
        aria-label={`拖动排序 ${profile.name}`}
        className="shrink-0 cursor-grab text-muted-foreground"
        disabled={!reorderable || saving}
        ref={handleRef}
        size="icon-xs"
        variant="ghost"
      >
        <span
          aria-hidden="true"
          className="icon-[lucide--grip-vertical] size-3.5"
        />
      </Button>
      <Button
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 px-0 text-left"
        onClick={onSelect}
        size="xs"
        variant="ghost"
      >
        <span className="w-full truncate font-normal text-[0.6875rem] text-muted-foreground">
          {profile.name}
        </span>
        {subtitle ? (
          <span className="w-full truncate text-[0.6875rem] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
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
        disabled={saving}
        onCheckedChange={onToggle}
        size="sm"
      />
    </div>
  );
}

type DraftRowProps = {
  name: string;
  onSelect: () => void;
  selected: boolean;
};

function DraftRow({ name, onSelect, selected }: DraftRowProps): ReactNode {
  return (
    <div
      className={cn(
        "my-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors motion-reduce:transition-none",
        selected
          ? "border-border bg-muted"
          : "border-transparent hover:bg-muted"
      )}
    >
      <Button
        aria-current={selected ? "true" : undefined}
        className="flex-1 justify-start px-0 text-left"
        onClick={onSelect}
        size="xs"
        variant="ghost"
      >
        <span className="truncate">{name}</span>
      </Button>
      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
        草稿
      </span>
    </div>
  );
}

type LeftPanelProps = {
  addDisabled: boolean;
  listRef: RefObject<HTMLDivElement | null>;
  draftName: string | null;
  filter: FilterState;
  filtered: Profile[];
  hasPlugins: boolean;
  onAdd: () => void;
  onFilterChange: (filter: FilterState) => void;
  onQueryChange: (query: string) => void;
  onReorder: (ordered: Profile[]) => void;
  onSelect: (id: string) => void;
  onSelectDraft: () => void;
  onToggleEnabled: (profile: Profile, enabled: boolean) => void;
  profiles: Profile[];
  query: string;
  resolvePluginName: (profile: Profile) => string | undefined;
  saving: boolean;
  selectedId: string | null;
};

function LeftPanel({
  addDisabled,
  draftName,
  listRef,
  filter,
  filtered,
  hasPlugins,
  onAdd,
  onFilterChange,
  onQueryChange,
  onReorder,
  onSelect,
  onSelectDraft,
  onToggleEnabled,
  profiles: allProfiles,
  query,
  resolvePluginName,
  saving,
  selectedId,
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
        <span className="text-muted-foreground text-xs">
          {allProfiles.length}
        </span>
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
        className="-mx-1 flex flex-1 flex-col overflow-y-auto px-1"
        ref={listRef}
      >
        {/* 每项都带稳定 key：条件行增删不能让后面的行换索引重放入场 */}
        <DragDropProvider onDragEnd={handleDragEnd}>
          <StaggerList>
            {draftName ? (
              <DraftRow
                key="draft"
                name={draftName}
                onSelect={onSelectDraft}
                selected={selectedId === NEW_PROFILE_ID}
              />
            ) : null}
            {hasPlugins ? null : (
              <p className="text-muted-foreground text-sm" key="no-plugins">
                没有可用的翻译插件，请检查应用安装状态。
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
                    subtitle={resolvePluginName(profile)}
                  />
                ))
              : null}
            {hasPlugins && !draftName && filtered.length === 0 ? (
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
        新增自定义 OpenAI
      </Button>
    </aside>
  );
}

export { LeftPanel };
