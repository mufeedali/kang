import { describe, expect, test } from "bun:test";
import { generateKeyBetween } from "fractional-indexing";

describe("Fractional Indexing — Ordering Logic", () => {
  test("generates a key between null and null (first item)", () => {
    const key = generateKeyBetween(null, null);
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  test("generates a key after an existing key (append)", () => {
    const first = generateKeyBetween(null, null);
    const second = generateKeyBetween(first, null);
    expect(second > first).toBe(true);
  });

  test("generates a key before an existing key (prepend)", () => {
    const first = generateKeyBetween(null, null);
    const before = generateKeyBetween(null, first);
    expect(before < first).toBe(true);
  });

  test("generates a key between two existing keys", () => {
    const first = generateKeyBetween(null, null);
    const third = generateKeyBetween(first, null);
    const second = generateKeyBetween(first, third);

    expect(second > first).toBe(true);
    expect(second < third).toBe(true);
  });

  test("multiple insertions at the same position produce unique, ordered keys", () => {
    const keys: string[] = [];
    let prev: string | null = null;

    for (let i = 0; i < 100; i++) {
      const key = generateKeyBetween(prev, null);
      keys.push(key);
      prev = key;
    }

    const unique = new Set(keys);
    expect(unique.size).toBe(100);

    const sorted = [...keys].sort();
    expect(sorted).toEqual(keys);
  });

  test("lexicographic sort matches insertion order", () => {
    const a = generateKeyBetween(null, null);
    const c = generateKeyBetween(a, null);
    const b = generateKeyBetween(a, c);
    const d = generateKeyBetween(c, null);

    const tasks = [
      { id: "d", rank: d },
      { id: "b", rank: b },
      { id: "a", rank: a },
      { id: "c", rank: c },
    ];

    const sorted = tasks.sort((x, y) =>
      x.rank < y.rank ? -1 : x.rank > y.rank ? 1 : 0,
    );
    expect(sorted.map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });
});
