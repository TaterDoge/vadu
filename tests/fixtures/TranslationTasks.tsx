import { cleanup, host, mount, signal, Text } from 'nsh';

import { Translation } from '../../src/api/translation-task';
import { openTranslateWindow } from '../../src/windows/translate/TranslateWindow';

function TranslationTasks() {
  const events = signal<string[]>([]);
  const record = (event: string) => events.set([...events(), event]);
  const start = Translation.start;
  Translation.start = (input, onEvent) =>
    start(input, (event) => {
      record(`${event.requestId}:${event.type}`);
      onEvent(event);
    });
  cleanup(() => {
    Translation.start = start;
  });

  host.on('open-translate', openTranslateWindow);
  host.on<string>('start', (id) => {
    const failure = Translation.start(
      { requestId: id, profileId: 'ready', text: '示例', target: 'ja' },
      () => {},
    );
    if (failure) record(`${id}:${failure.code}`);
  });
  host.on<string>('cancel', Translation.cancel);
  return <Text>{`任务事件 ${JSON.stringify(events())}`}</Text>;
}

mount(TranslationTasks);
