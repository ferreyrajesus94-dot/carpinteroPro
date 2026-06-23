import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
	beforeAll(() => {
		vi.useFakeTimers();
	});

	it("returns the initial value immediately", () => {
		const { result } = renderHook(() => useDebouncedValue("hello", 250));
		expect(result.current).toBe("hello");
	});

	it("only updates after the delay elapses", () => {
		const { result, rerender } = renderHook(
			({ value }) => useDebouncedValue(value, 250),
			{ initialProps: { value: "a" } },
		);
		expect(result.current).toBe("a");

		rerender({ value: "ab" });
		expect(result.current).toBe("a");

		act(() => {
			vi.advanceTimersByTime(249);
		});
		expect(result.current).toBe("a");

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe("ab");
	});

	it("resets the timer when the value changes again", () => {
		const { result, rerender } = renderHook(
			({ value }) => useDebouncedValue(value, 250),
			{ initialProps: { value: "a" } },
		);
		rerender({ value: "ab" });
		act(() => {
			vi.advanceTimersByTime(200);
		});
		rerender({ value: "abc" });
		act(() => {
			vi.advanceTimersByTime(200);
		});
		// 400ms after the original change, but only 200ms after the latest,
		// the debounced value should still be the initial.
		expect(result.current).toBe("a");
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(result.current).toBe("abc");
	});
});
