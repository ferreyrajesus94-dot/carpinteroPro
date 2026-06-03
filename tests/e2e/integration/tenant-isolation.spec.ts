import { expect, test } from "@playwright/test";
import {
	cleanupSdd7Fixtures,
	createAuthenticatedFixtureClientB,
	seedMaterialIsolationFixtures,
} from "../../../scripts/e2e/fixtures";

test.describe("tenant isolation regression", () => {
	test.afterEach(async () => {
		await cleanupSdd7Fixtures();
	});

	test("authenticated workshop B user cannot read workshop A materials", async () => {
		const fixture = await seedMaterialIsolationFixtures();
		const clientB = await createAuthenticatedFixtureClientB();

		const { data: visibleMaterials, error: listError } = await clientB
			.from("materials")
			.select("id, workshop_id, name")
			.order("name", { ascending: true });
		if (listError) throw listError;

		const { data: workshopAMaterial, error: explicitError } = await clientB
			.from("materials")
			.select("id, workshop_id, name")
			.eq("id", fixture.materialA.id)
			.maybeSingle();
		if (explicitError) throw explicitError;

		expect(visibleMaterials).toEqual([
			expect.objectContaining({
				id: fixture.materialB.id,
				workshop_id: fixture.workshopBId,
				name: "e2e_sdd7_material_b",
			}),
		]);
		expect(visibleMaterials).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: fixture.materialA.id }),
			]),
		);
		expect(workshopAMaterial).toBeNull();
	});
});
