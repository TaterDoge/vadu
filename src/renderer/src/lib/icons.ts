/** 模板字面量类型让拼错的图标名在 typecheck 阶段暴露：插件遇到未知图标只 warn、不报错，图标会静默消失 */
export type IconClass = `icon-[lucide--${string}]`;

/* Alert 把图标样式挂在 svg 选择器上（row-span / translate / size），Iconify 的空 span 一条都匹配不到，
   只能写在图标自身上；容器那侧的两列布局由调用点补 grid-cols-[auto_1fr] gap-x-2 */
export const ALERT_ICON =
  "icon-[lucide--circle-alert] row-span-2 size-4 translate-y-0.5";
