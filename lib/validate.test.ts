import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanAlbertClasses, parseInterestList } from "./validate";

test("interest list: bad elements are a 400, not a crash", () => {
  for (const bad of [null, "x", [null], [{ activity: 3, min: 2 }], [{ activity: "boba", min: "2" }], [{ activity: "boba" }]]) {
    assert.equal(parseInterestList(bad, 3).ok, false, JSON.stringify(bad));
  }
});

test("interest list: duplicates collapse (no primary-key error), cap applies after that", () => {
  const r = parseInterestList([{ activity: "boba", min: 2 }, { activity: "boba", min: 3 }, { activity: "chess", min: 2 }], 3);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.rows, [{ activity: "boba", min: 3 }, { activity: "chess", min: 2 }]);
  const four = [1, 2, 3, 4].map((i) => ({ activity: `a${i}`, min: 2 }));
  const tooMany = parseInterestList(four, 3);
  assert.equal(tooMany.ok ? "" : tooMany.code, "TOO_MANY");
});

test("Albert answer: wrong types and shapes are dropped instead of throwing", () => {
  const answer = [
    { course: "MATH-UA 121", day: "Tue", start: "11:00", end: "12:15" },
    { course: "MATH-UA 121", day: "Tue", start: "11:00", end: "12:15" }, // duplicate
    { course: "X", day: "Tue", start: 1100, end: 1215 },                  // numbers, not strings
    { course: "X", day: 2, start: "11:00", end: "12:15" },                // day as number
    { course: "X", day: "Wed", start: "14:00", end: "13:00" },            // ends before it starts
    null, "text",
    { day: "Mon", start: "9:30", end: "10:45" },                          // no course, short hour
  ];
  assert.deepEqual(cleanAlbertClasses(answer), [
    { label: "MATH-UA 121", day: 2, start: "11:00", end: "12:15" },
    { label: "Class", day: 1, start: "09:30", end: "10:45" },
  ]);
  assert.deepEqual(cleanAlbertClasses({ classes: [] }), []);
  assert.equal(cleanAlbertClasses(Array.from({ length: 500 }, (_, i) => ({ course: `C${i}`, day: "Mon", start: "09:00", end: "10:00" }))).length, 60);
});
