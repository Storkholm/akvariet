/** Bounded undo history (CONTEXT: Fortryd – at least 20 steps; oldest entries fall off). */
export class UndoStack<T> {
  private readonly items: T[] = [];

  constructor(private readonly limit = 30) {}

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.limit) this.items.shift();
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}
