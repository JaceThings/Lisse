import { describe, it, expect } from "vitest";
import { fixed4 } from "../src/utils.js";

/**
 * `fixed4` replaces `toFixed(4)` on the path-emission hot path, and every byte
 * of `generatePath` output is public and snapshot-pinned. So the only contract
 * worth testing is total string agreement with `toFixed(4)` — including on the
 * inputs where a scaled-integer rounding disagrees with exact-decimal rounding.
 */

/** Deterministic LCG (Numerical Recipes constants) so the adversarial matrix is
 *  the same set of doubles on every run and machine. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function expectAgrees(values: readonly number[]): void {
  const mismatches: string[] = [];
  for (const n of values) {
    const got = fixed4(n);
    const want = n.toFixed(4);
    if (got !== want) mismatches.push(`${n}: got ${got}, want ${want}`);
  }
  expect(mismatches).toEqual([]);
}

describe("fixed4", () => {
  it("matches toFixed(4) on the naive-rounding regression value", () => {
    // Math.round(1234.56785 * 1e4) is 12345679 because the multiply lands just
    // above the tie, but the double 1234.56785 is just below it, so toFixed
    // rounds down. A fast formatter that trusts the multiply emits "1234.5679".
    expect(fixed4(1234.56785)).toBe("1234.5678");
    expect(1234.56785.toFixed(4)).toBe("1234.5678");
  });

  it("matches toFixed(4) on integers and halves", () => {
    const values: number[] = [];
    for (let i = -500; i <= 500; i++) {
      values.push(i, i + 0.5, i - 0.5, i + 0.25, i + 0.0001, i - 0.0001);
    }
    expectAgrees(values);
  });

  it("matches toFixed(4) on values whose 5th decimal is exactly 5", () => {
    // The disagreement class: parsed from decimal text so each double is the
    // nearest one to a true x.xxxx5, landing on either side of the tie.
    const rand = lcg(0x5eed_1234);
    const values: number[] = [];
    for (let i = 0; i < 20000; i++) {
      const whole = Math.floor(rand() * 4000) - 2000;
      const dddd = String(Math.floor(rand() * 10000)).padStart(4, "0");
      values.push(Number(`${whole}.${dddd}5`), Number(`-0.${dddd}5`));
    }
    expectAgrees(values);
  });

  it("matches toFixed(4) on uniform random magnitudes", () => {
    const rand = lcg(0xc0ffee);
    const values: number[] = [];
    for (let i = 0; i < 20000; i++) {
      values.push((rand() - 0.5) * 4000, (rand() - 0.5) * 2, (rand() - 0.5) * 1e-3);
    }
    expectAgrees(values);
  });

  it("matches toFixed(4) on zeros, tiny magnitudes and large magnitudes", () => {
    expect(fixed4(-0)).toBe((-0).toFixed(4));
    expect(fixed4(-0)).toBe("0.0000");
    // A negative that rounds to zero keeps its sign: Math.round gives -0, whose
    // `< 0` test is false, so the sign has to come from the input.
    expect(fixed4(-0.00004)).toBe("-0.0000");
    expectAgrees([
      0,
      -0,
      Number.MIN_VALUE,
      -Number.MIN_VALUE,
      1e-7,
      -1e-7,
      0.00005,
      -0.00005,
      0.00004999999999,
      1e-4,
      5e-5,
      // Above ~4.5e11 one ulp of n*1e4/1e4 exceeds 1e-4, which is where a
      // division-based integer split can produce a negative remainder.
      500000000000.9999,
      -500000000000.9999,
      449999999999.9999,
      900719925474.0991,
      1e12,
      1e15,
      -1e15,
      1e16,
      -1e16,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_VALUE,
      NaN,
      Infinity,
      -Infinity,
    ]);
  });

  it("matches toFixed(4) across exponent decades", () => {
    const rand = lcg(0xbeef);
    const values: number[] = [];
    for (let exp = -8; exp <= 16; exp++) {
      const scale = 10 ** exp;
      for (let i = 0; i < 400; i++) {
        values.push(rand() * scale, -rand() * scale);
      }
    }
    expectAgrees(values);
  });
});
