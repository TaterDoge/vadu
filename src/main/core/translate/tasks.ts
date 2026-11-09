/**
 * 在途翻译任务表（纯逻辑，不依赖 electron，便于单测）。
 * 取消与事件归属绑定发起窗口：跨窗口不能取消，sender 销毁即中止。
 */

export type EventSender = {
  id: number;
  send: (channel: string, payload: unknown) => void;
};

export type ActiveTask = {
  requestId: string;
  sender: EventSender;
  controller: AbortController;
  suppressed: boolean;
  /** 任务结束时移除 sender 销毁监听，避免长驻窗口监听泄漏 */
  cleanup?: () => void;
};

export class TaskRegistry {
  private readonly tasks = new Map<string, ActiveTask>();

  register(requestId: string, sender: EventSender): ActiveTask | null {
    if (this.tasks.has(requestId)) {
      return null;
    }
    const task: ActiveTask = {
      controller: new AbortController(),
      requestId,
      sender,
      suppressed: false,
    };
    this.tasks.set(requestId, task);
    return task;
  }

  get(requestId: string): ActiveTask | undefined {
    return this.tasks.get(requestId);
  }

  /** 仅发起方窗口可取消；取消后抑制后续事件并终止上游 */
  cancel(requestId: string, senderId: number): boolean {
    const task = this.tasks.get(requestId);
    if (!task || task.sender.id !== senderId) {
      return false;
    }
    task.suppressed = true;
    task.controller.abort();
    return true;
  }

  /** sender 销毁：该窗口发起的所有任务中止且不再发事件 */
  disposeBySender(senderId: number): void {
    for (const task of this.tasks.values()) {
      if (task.sender.id === senderId) {
        task.suppressed = true;
        task.controller.abort();
      }
    }
  }

  remove(requestId: string): void {
    this.tasks.delete(requestId);
  }

  /** 恢复配置前终止全部在途翻译：旧任务不应继续使用被替换的配置 */
  abortAll(): void {
    for (const task of this.tasks.values()) {
      task.suppressed = true;
      task.controller.abort();
    }
  }

  size(): number {
    return this.tasks.size;
  }
}

export const taskRegistry = new TaskRegistry();
