import generalIcon from "../../icons/general.svg";
import shortcutsIcon from "../../icons/shortcuts.svg";
import pinIcon from "./pin.svg";

export const shortcutGroups = [
	{
		title: "全局快捷键",
		items: [
			{
				id: "toggle-translate",
				title: "唤起 / 隐藏翻译浮窗",
				description: "按一次唤起并聚焦翻译窗口，再按一次隐藏到后台",
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
				description: "在浮窗内切换图钉（固定窗口），仅浮窗聚焦时生效",
				icon: pinIcon,
				resettable: false,
			},
		],
	},
];
