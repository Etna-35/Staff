import type { RequestCategory } from '../types/domain';

export const appLinks = {
  knowledgeBaseUrl: 'https://example.com/knowledge-base',
  taskChatUrl: 'https://t.me/example_restaurant_chat',
  closePhotoGuideUrl: 'https://example.com/closing-photo-guide',
  externalRequestForms: {
    kitchen: 'https://forms.yandex.ru/u/67156c26505690ef09a1415a',
    bar: 'https://forms.yandex.ru/u/bar-placeholder',
    supplies: 'https://forms.yandex.ru/u/supplies-placeholder',
  } satisfies Record<RequestCategory, string>,
};

