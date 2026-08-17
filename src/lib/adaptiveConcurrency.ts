// Adaptive concurrency runner: FAST WHEN HEALTHY, SAFE WHEN RATE-LIMITED.
export async function mapWithAdaptiveConcurrency<T, R>(
  items: T[],
  startConcurrency: number,
  maxConcurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<Array<{ ok: boolean; res?: R; err?: unknown }>> {
  const results = new Array(items.length);
  let concurrency = startConcurrency;
  let successStreak = 0;
  let index = 0;
  let active = 0;
  let done = 0;
  const total = items.length;

  return new Promise((resolve) => {
    const launch = () => {
      while (active < concurrency && index < total) {
        const i = index++;
        active++;
        Promise.resolve()
          .then(() => worker(items[i], i))
          .then((res) => {
            results[i] = { ok: true, res };
            successStreak++;
            if (successStreak >= 3 && concurrency < maxConcurrency) {
              concurrency = Math.min(maxConcurrency, concurrency + 1);
              successStreak = 0;
            }
          })
          .catch((err: unknown) => {
            results[i] = { ok: false, err };
            successStreak = 0;
            let status: number | undefined;
            if (err && typeof err === 'object') {
              if ('response' in err && typeof (err as { response?: { status?: unknown } }).response === 'object') {
                status = (err as { response?: { status?: number } }).response?.status;
              } else if ('status' in err) {
                status = (err as { status?: number }).status;
              } else if ('statusCode' in err) {
                status = (err as { statusCode?: number }).statusCode;
              }
            }
            const isRateLimit = status === 429;
            concurrency = Math.max(1, Math.floor(concurrency / (isRateLimit ? 2 : 1.5)));
          })
          .finally(() => {
            active--;
            done++;
            if (done >= total) resolve(results);
            else launch();
          });
      }
    };
    launch();
  });
}
