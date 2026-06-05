import { expect, test } from "@playwright/test";
import {
	applyFixtureStockMovement,
	cleanupSdd7Fixtures,
	createAuthenticatedFixtureClient,
	createAuthenticatedFixtureClientB,
	fetchFixtureMaterial,
	fetchFixtureStockMovements,
	seedStockMovementFixture,
} from "../../../scripts/e2e/fixtures";

test.describe("inventory stock movement integration", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("stock movement RPC increases quantity and creates a movement row", async () => {
		const fixture = await seedStockMovementFixture();
		const client = await createAuthenticatedFixtureClient();

		const newStock = await applyFixtureStockMovement(client, {
			materialId: fixture.materialA.id,
			delta: 5,
			reason: "compra",
			note: "SDD7 purchase",
		});
		const material = await fetchFixtureMaterial(client, fixture.materialA.id);
		const movements = await fetchFixtureStockMovements(
			client,
			fixture.materialA.id,
		);

		expect(newStock).toBe(fixture.initialStock + 5);
		expect(material?.stock).toBe(fixture.initialStock + 5);
		expect(movements).toEqual([
			expect.objectContaining({
				material_id: fixture.materialA.id,
				delta: 5,
				reason: "compra",
				note: "SDD7 purchase",
			}),
		]);
	});

	test("stock movement RPC decreases quantity and creates a movement row", async () => {
		const fixture = await seedStockMovementFixture();
		const client = await createAuthenticatedFixtureClient();

		const newStock = await applyFixtureStockMovement(client, {
			materialId: fixture.materialA.id,
			delta: -3,
			reason: "consumo",
			note: "SDD7 consumption",
		});
		const material = await fetchFixtureMaterial(client, fixture.materialA.id);
		const movements = await fetchFixtureStockMovements(
			client,
			fixture.materialA.id,
		);

		expect(newStock).toBe(fixture.initialStock - 3);
		expect(material?.stock).toBe(fixture.initialStock - 3);
		expect(movements).toEqual([
			expect.objectContaining({
				material_id: fixture.materialA.id,
				delta: -3,
				reason: "consumo",
				note: "SDD7 consumption",
			}),
		]);
	});

	test("tenant-isolated stock movement row is denied by RLS", async () => {
		const fixture = await seedStockMovementFixture();
		const clientB = await createAuthenticatedFixtureClientB();

		const { error } = await clientB.from("stock_movements").insert({
			workshop_id: fixture.workshopAId,
			material_id: fixture.materialA.id,
			delta: 1,
			reason: "ajuste",
			note: "forbidden",
		});

		expect(error?.message).toMatch(/row-level security|violates row-level/i);
		const materialBView = await fetchFixtureMaterial(
			clientB,
			fixture.materialA.id,
		);
		expect(materialBView).toBeNull();
	});
});
