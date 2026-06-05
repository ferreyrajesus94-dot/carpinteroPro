import { MutationObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureException } from "./errorReporter";
import { queryClient } from "./queryClient";

vi.mock("./errorReporter", () => ({
	captureException: vi.fn(),
}));

const captureExceptionMock = vi.mocked(captureException);

describe("queryClient", () => {
	beforeEach(() => {
		captureExceptionMock.mockClear();
	});

	afterEach(() => {
		captureExceptionMock.mockReset();
	});

	it("preserves existing defaultOptions", () => {
		const defaultOptions = queryClient.getDefaultOptions();
		expect(defaultOptions.queries?.staleTime).toBe(1000 * 60 * 5);
		expect(defaultOptions.queries?.retry).toBe(1);
		expect(defaultOptions.queries?.gcTime).toBe(1000 * 60 * 60 * 24);
	});

	it("routes query errors through the shared reporter", async () => {
		const error = new Error("query failed");
		const queryFn = vi.fn().mockRejectedValue(error);

		await expect(
			queryClient.fetchQuery({ queryKey: ["pr-b-query"], queryFn }),
		).rejects.toBe(error);

		expect(captureExceptionMock).toHaveBeenCalledWith(
			error,
			expect.objectContaining({
				source: "react-query.query",
				metadata: expect.objectContaining({
					queryKey: ["pr-b-query"],
				}),
			}),
		);
	});

	it("routes mutation errors through the shared reporter", async () => {
		const error = new Error("mutation failed");
		const mutationFn = vi.fn().mockRejectedValue(error);

		const observer = new MutationObserver(queryClient, {
			mutationKey: ["pr-b-mutation"],
			mutationFn,
		});

		await expect(observer.mutate({})).rejects.toBe(error);

		expect(captureExceptionMock).toHaveBeenCalledWith(
			error,
			expect.objectContaining({
				source: "react-query.mutation",
				metadata: expect.objectContaining({
					mutationKey: ["pr-b-mutation"],
				}),
			}),
		);
	});
});
