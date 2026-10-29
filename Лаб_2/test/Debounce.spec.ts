import { debounce } from '../src/Debounce';

describe('Debounce Unit Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('Серія швидких викликів повертає єдиний виклик fn (Trailing за замовчуванням)', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 200);

    // Виконуємо серію з 3 швидких викликів
    debouncedFn('a');
    debouncedFn('b');
    debouncedFn('c');

    expect(fn).not.toHaveBeenCalled();

    // Просуваємо час на 199 мс — виклику ще не повинно бути
    jest.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    // На 200-й мілісекунді викликається один раз із останнім аргументом 'c'
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  test('leading = true: миттєвий перший виклик та придушення наступних до паузи', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 200, { leading: true, trailing: false });

    // Перший виклик виконується миттєво
    debouncedFn(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);

    // Наступні виклики під час затримки придушуються
    debouncedFn(2);
    debouncedFn(3);
    jest.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);

    // Після відновлення паузи новий виклик знову виконується миттєво
    debouncedFn(4);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith(4);
  });

  test('Комбінація leading = true та trailing = true', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 200, { leading: true, trailing: true });

    debouncedFn('перший');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('перший');

    debouncedFn('другий');
    debouncedFn('третій');

    // Чекаємо завершення паузи
    jest.advanceTimersByTime(200);

    // Має бути 2 виклики: перший (leading) та останній (trailing)
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('третій');
  });

  test('Скасування таймера при виклику dispose()', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 200);

    debouncedFn('тест');
    expect(fn).not.toHaveBeenCalled();

    // Скасовуємо виконання до закінчення таймауту
    debouncedFn.dispose();

    // Просуваємо час далі за ліміт
    jest.advanceTimersByTime(300);

    // Функція не повинна бути викликана взагалі
    expect(fn).not.toHaveBeenCalled();
  });
});