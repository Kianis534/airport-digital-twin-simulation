// A tiny process-based discrete-event kernel modelled on SimPy.
// Processes are generator functions that yield events (timeouts, resource requests or
// signals); the environment resumes them when those events fire.

export interface SimEvent {
  readonly kind: 'event';
  triggered: boolean;
  callbacks: Array<() => void>;
}

export interface Timeout {
  readonly kind: 'timeout';
  delay: number;
}

export interface Request {
  readonly kind: 'request';
  granted: boolean;
  callbacks: Array<() => void>;
}

export type Yieldable = SimEvent | Timeout | Request;
export type Process<T = void> = Generator<Yieldable, T, unknown>;

interface Scheduled {
  time: number;
  seq: number;
  fn: () => void;
}

/** Binary min-heap ordered by (time, insertion order), like SimPy's event queue. */
class EventQueue {
  private heap: Scheduled[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(item: Scheduled): void {
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(h[i], h[parent])) break;
      [h[i], h[parent]] = [h[parent], h[i]];
      i = parent;
    }
  }

  pop(): Scheduled | undefined {
    const h = this.heap;
    if (h.length === 0) return undefined;
    const top = h[0];
    const last = h.pop()!;
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < h.length && this.less(h[l], h[smallest])) smallest = l;
        if (r < h.length && this.less(h[r], h[smallest])) smallest = r;
        if (smallest === i) break;
        [h[i], h[smallest]] = [h[smallest], h[i]];
        i = smallest;
      }
    }
    return top;
  }

  private less(a: Scheduled, b: Scheduled): boolean {
    return a.time < b.time || (a.time === b.time && a.seq < b.seq);
  }
}

export class Environment {
  now = 0;
  private queue = new EventQueue();
  private seq = 0;

  schedule(time: number, fn: () => void): void {
    this.queue.push({ time, seq: this.seq++, fn });
  }

  timeout(delay: number): Timeout {
    return { kind: 'timeout', delay: Math.max(0, delay) };
  }

  event(): SimEvent {
    return { kind: 'event', triggered: false, callbacks: [] };
  }

  succeed(event: SimEvent): void {
    if (event.triggered) return;
    event.triggered = true;
    const callbacks = event.callbacks.splice(0);
    for (const cb of callbacks) this.schedule(this.now, cb);
  }

  process(gen: Process): void {
    this.schedule(this.now, () => this.step(gen, undefined));
  }

  private step(gen: Process, value: unknown): void {
    const result = gen.next(value);
    if (result.done) return;
    const item = result.value;
    const resume = () => this.step(gen, undefined);
    if (item.kind === 'timeout') {
      this.schedule(this.now + item.delay, resume);
    } else if ((item.kind === 'event' && item.triggered) || (item.kind === 'request' && item.granted)) {
      this.schedule(this.now, resume);
    } else {
      item.callbacks.push(resume);
    }
  }

  /** Run until the queue is empty or ``until`` fires. */
  run(until?: SimEvent): void {
    while (this.queue.size > 0) {
      if (until?.triggered) return;
      const next = this.queue.pop()!;
      this.now = next.time;
      next.fn();
    }
  }
}

export class Resource {
  readonly queue: Request[] = [];
  count = 0;

  constructor(
    private readonly env: Environment,
    readonly capacity: number,
  ) {}

  request(): Request {
    const req: Request = { kind: 'request', granted: false, callbacks: [] };
    if (this.count < this.capacity) {
      this.count += 1;
      req.granted = true;
    } else {
      this.queue.push(req);
    }
    return req;
  }

  release(req: Request): void {
    if (!req.granted) return;
    req.granted = false;
    this.count -= 1;
    const next = this.queue.shift();
    if (next) {
      this.count += 1;
      next.granted = true;
      const callbacks = next.callbacks.splice(0);
      for (const cb of callbacks) this.env.schedule(this.env.now, cb);
    }
  }
}
