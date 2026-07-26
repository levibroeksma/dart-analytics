import { describe, expect, it } from "vitest";
import * as rulesetTypes from "@lib/types";
import { REFINEMENT_CONTRACTS } from "@lib/game/rulesets/refinement-contract";

// Executes every boundary the refinement contract declares. Unlike a text
// scan over test sources, nothing here can be satisfied by a comment, a test
// title or a dummy assertion: each case runs safeParse against the real schema
// and asserts the real outcome, and every rejection must be attributed to the
// field the contract claims to cover.

const exportedSchemas: Record<string, unknown> = rulesetTypes;

describe("ruleset refinement contract", () => {
  it("declares at least one refined schema", () => {
    expect(REFINEMENT_CONTRACTS.length).toBeGreaterThan(0);
  });

  for (const contract of REFINEMENT_CONTRACTS) {
    describe(contract.schemaName, () => {
      it("names a schema that types.ts actually exports under that name", () => {
        expect(exportedSchemas[contract.schemaName]).toBe(contract.schema);
      });

      it("declares at least one refined field", () => {
        expect(contract.fields.length).toBeGreaterThan(0);
      });

      for (const field of contract.fields) {
        describe(field.field, () => {
          it("declares both accepted and rejected boundaries", () => {
            expect(field.accept.length).toBeGreaterThan(0);
            expect(field.reject.length).toBeGreaterThan(0);
          });

          for (const probe of field.accept) {
            it(`accepts ${probe.label}`, () => {
              const result = contract.schema.safeParse(probe.config);
              expect(result.success).toBe(true);
            });
          }

          for (const probe of field.reject) {
            it(`rejects ${probe.label}`, () => {
              const result = contract.schema.safeParse(probe.config);
              expect(result.success).toBe(false);
              if (result.success) return;
              const blamedFields = result.error.issues.flatMap((issue) =>
                issue.path.map((segment) => String(segment)),
              );
              expect(blamedFields).toContain(field.field);
            });
          }
        });
      }
    });
  }
});
