/** macOS 用无标题栏窗口，红黄绿按钮浮在内容上，渲染层要自己让位并划出拖拽区 */
export const IS_MAC = window.electron.process.platform === "darwin";
