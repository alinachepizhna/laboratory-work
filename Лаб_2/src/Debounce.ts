/**
 * Інтерфейс конфігурації для налаштування поведінки Debounce.
 */
export interface DebounceOptions {
  /** Викликати цільову функцію одразу при першому виклику (негайно) */
  leading?: boolean;
  /** Викликати цільову функцію після закінчення затримки з останніми аргументами */
  trailing?: boolean;
}

/**
 * Інтерфейс обгорнутої функції Debounce з додатковими методами для управління.
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  /** Виклик самій обгортки */
  (...args: Parameters<T>): void;
  /** Скасувати активний таймер і очистити відкладений виклик */
  cancel(): void;
  /** Метод очищення ресурсів (аналог cancel) */
  dispose(): void;
}

/**
 * Створює функцію-обгортку Debounce, яка відкладає виконання fn до моменту,
 * поки з моменту останнього виклику не мине delayMs мілісекунд.
 *
 * @param fn - Цільова функція для виконання
 * @param delayMs - Затримка в мілісекундах
 * @param options - Налаштування режимів leading та trailing
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number,
  options: DebounceOptions = {}
): DebouncedFunction<T> {
  // Посилання на активний таймер затримки
  let timer: NodeJS.Timeout | null = null;
  // Останні аргументи, з якими була викликана обгортка
  let lastArgs: Parameters<T> | null = null;
  // Контекст (this), з яким була викликана обгортка
  let lastThis: any = null;

  // Значення прапорців за замовчуванням
  const leading = options.leading ?? false;
  // Якщо trailing не вказано явно, він дорівнює true (якщо leading не увімкнено)
  const trailing = options.trailing ?? !options.leading;

  /**
   * Основна функція-обгортка, яка викликається замість оригінальної fn.
   */
  function debounced(this: any, ...args: Parameters<T>) {
    // Зберігаємо поточні аргументи та контекст виконання
    lastArgs = args;
    lastThis = this;

    // Дозволяємо миттєвий виклик, якщо увімкнено leading і система "заспокоїлась" (немає таймера)
    const isCallAllowedNow = leading && !timer;

    // Якщо таймер вже працює — скидаємо його, оскільки надійшов новий виклик
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    // Якщо це перший виклик у серії і увімкнено leading — виконуємо fn негайно
    if (isCallAllowedNow) {
      fn.apply(lastThis, lastArgs);
      // Очищаємо сохранені значення, щоб запобігти дублюванню в trailing
      lastArgs = null;
      lastThis = null;
    }

    // Запускаємо новий таймер відліку затримки
    timer = setTimeout(() => {
      // Якщо trailing увімкнено і є збережені аргументи — виконуємо цільову функцію
      if (trailing && lastArgs) {
        fn.apply(lastThis, lastArgs);
      }
      // Очищаємо стан після завершення таймауту
      timer = null;
      lastArgs = null;
      lastThis = null;
    }, delayMs);
  }

  /**
   * Скасовує поточний таймер та очищує збережені аргументи.
   */
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
    lastThis = null;
  };

  /**
   * Очищує ресурси (викликає cancel).
   */
  debounced.dispose = () => {
    debounced.cancel();
  };

  return debounced;
}