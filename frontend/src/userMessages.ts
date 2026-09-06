export const PARSER_CONNECTION_ERROR =
  "Не вдалося підключитися до системи розбору. Перевірте підключення в налаштуваннях і спробуйте ще раз.";

export function userFacingParserError(message: string): string {
  const normalized = message.toLocaleLowerCase();
  if (/rate limit|too many requests|http 429|ліміт/u.test(normalized)) {
    return "Сервіс тимчасово досяг ліміту запитів. Зачекайте трохи та спробуйте ще раз.";
  }
  if (/api.?key|unauthor|forbidden|http 401|http 403|відхилив.*ключ/u.test(normalized)) {
    return "Сервіс відхилив ключ доступу. Перевірте ключ у налаштуваннях або зверніться до адміністратора застосунку.";
  }
  if (/model unavailable|model .*not present|unknown .*model|http 404|модель недоступ/u.test(normalized)) {
    return "Вибрана лінгвістична модель недоступна. Оберіть іншу модель у налаштуваннях.";
  }
  if (/failed to fetch|network|econn|timed? ?out|backend|http \d|недоступн.*систем/u.test(normalized)) {
    return PARSER_CONNECTION_ERROR;
  }
  if (/[Ѐ-ӿ]/u.test(message) && !/endpoint|environment|response|provider/u.test(normalized)) return message;
  return "Не вдалося завершити розбір статблоку. Перевірте налаштування моделі та спробуйте ще раз.";
}

export function userFacingTranslationError(message: string, serviceName: string): string {
  const normalized = message.toLocaleLowerCase();
  if (/not configured|api.?key|unauthor|forbidden|http 401|http 403/u.test(normalized)) {
    return `${serviceName} не налаштовано. Перевірте налаштування перекладу або оберіть інший сервіс.`;
  }
  if (/failed to fetch|network|econn|timed? ?out|http \d|invalid .*response/u.test(normalized)) {
    return `${serviceName} зараз недоступний. Перевірте підключення або оберіть інший сервіс перекладу.`;
  }
  return `Не вдалося виконати переклад через ${serviceName}. Перевірте налаштування перекладу та спробуйте ще раз.`;
}

export function translationServiceName(mode: "deepl" | "libretranslate"): string {
  return mode === "deepl" ? "DeepL" : "LibreTranslate";
}
