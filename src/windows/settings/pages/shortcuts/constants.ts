import generalIcon from "../../icons/general.svg";
import shortcutsIcon from "../../icons/shortcuts.svg";
import pinIcon from "./pin.svg";

export const shortcutGroups = [
	{
		title: "全局快捷键",
		items: [
			{
				id: "toggle-translate",
				title: "唤起翻译浮窗",
				description: "唤起并聚焦翻译窗口，未固定时失焦自动隐藏",
				icon: shortcutsIcon,
				resettable: true,
			},
		],
	},
	{
		title: "局内快捷键",
		items: [
			{
				id: "open-settings",
				title: "浮窗内打开设置",
				description: "在翻译浮窗内打开设置页面，仅浮窗聚焦时生效",
				icon: generalIcon,
				resettable: false,
			},
			{
				id: "pin-translate",
				title: "浮窗内切换固定窗口",
				description: "固定后保持置顶，再按一次恢复失焦自动隐藏",
				icon: pinIcon,
				resettable: false,
			},
		],
	},
];
