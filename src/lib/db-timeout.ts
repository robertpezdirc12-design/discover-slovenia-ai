/**
 * Časovna omejitev za posamezno bazo. Prisma ob nedosegljivi bazi privzeto
 * poskuša večkrat in lahko visi ~15 s; uporabniku raje hitro vrnemo napako.
 *
 * Opomba: Promise.race ne prekine dejanske poizvedbe, le neha čakati nanjo.
 * Poizvedba se v ozadju zaključi/prekine, kar je za kratke poizvedbe sprejemljivo.
 */
export class DbTimeoutError extends Error {
  constructor(ms: number) {
    super(`db-timeout after ${ms}ms`);
    this.name = 'DbTimeoutError';
  }
}

export async function withDbTimeout<T>(promise: Promise<T>, ms = 4_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DbTimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
