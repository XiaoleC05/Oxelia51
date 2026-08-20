import {
  queryClickhouse,
  ClickHouseResourceError,
} from "@oxelia51/shared/src/server";
import { fail } from "assert";

describe("ClickHouse Resource Error Handling", () => {
  describe("queryClickhouse", () => {
    describe("Error transformation with throwIf", () => {
      // It is enough to test different block sizes on one error type only
      [1, 10_000].forEach((blockSize) => {
        it(`should transform OOM errors to ClickHouseResourceError; block size: ${blockSize}`, async () => {
          let res = Array<any>();
          try {
            res = await queryClickhouse<any>({
              query: `SELECT throwIf(number >= 2, 'memory limit exceeded: would use 10.23 GiB') AS v FROM system.numbers LIMIT 2000`,
              clickhouseSettings: { max_block_size: `${blockSize}` },
              tags: {
                surface: "trpc",
                route: "test.resource-error",
                projectId: "project-1",
              },
            });
            fail(
              "Should have thrown an error, observed instead " +
                JSON.stringify(res),
            );
          } catch (error: any) {
            expect(error).toBeInstanceOf(ClickHouseResourceError);
            expect(error.errorType).toBe("MEMORY_LIMIT");
            expect(error.tags).toEqual({
              tag_schema_version: "1",
              surface: "trpc",
              route: "test.resource-error",
              projectId: "project-1",
            });
          }
        });
      });

      it("should transform OvercommitTracker errors", async () => {
        try {
          await queryClickhouse({
            query: `SELECT throwIf(true, 'OvercommitTracker decision: Query was selected to stop by OvercommitTracker')`,
          });
          fail("Should have thrown an error");
        } catch (error: any) {
          expect(error).toBeInstanceOf(ClickHouseResourceError);
          expect(error.errorType).toBe("OVERCOMMIT");
        }
      });

      it("should transform timeout errors", async () => {
        try {
          await queryClickhouse({
            query: `SELECT throwIf(true, 'Timeout exceeded while reading from socket')`,
          });
          fail("Should have thrown an error");
        } catch (error: any) {
          expect(error).toBeInstanceOf(ClickHouseResourceError);
          expect(error.errorType).toBe("TIMEOUT");
        }
      });

      it("should NOT transform regular SQL errors", async () => {
        await expect(
          queryClickhouse({
            query: `SELECT * FROM non_existent_table_xyz123`,
          }),
        ).rejects.toThrow();

        try {
          await queryClickhouse({
            query: `SELECT * FROM non_existent_table_xyz123`,
          });
        } catch (error: any) {
          expect(error).not.toBeInstanceOf(ClickHouseResourceError);
        }
      });

      it("should pass through successful queries", async () => {
        const result = await queryClickhouse<{ test_value: Number }>({
          query: "SELECT 1 as test_value",
        });

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty("test_value");
        expect(result[0].test_value).toBe(1);
      });
    });
  });
});
