const assert = require("assert");
const { getOrientations, packItems } = require("./server");

function test(name, fn) {
    fn();
    console.log(`ok - ${name}`);
}

test("getOrientations dedups a cube to a single orientation", () => {
    const orientations = getOrientations([5, 5, 5]);
    assert.strictEqual(orientations.length, 1);
});

test("getOrientations returns all 6 permutations for distinct dims", () => {
    const orientations = getOrientations([2, 3, 4]);
    assert.strictEqual(orientations.length, 6);
});

test("packs an item that already fits without rotating it", () => {
    const result = packItems("30,20,15", [[10, 5, 5]]);
    assert.strictEqual(result.canFit, true);
    assert.deepStrictEqual(result.placements[0].rotation, [10, 5, 5]);
    assert.deepStrictEqual(result.placements[0].position, [0, 0, 0]);
});

test("rotates an item that only fits sideways", () => {
    // 30 only fits along the box's 30-length edge, not the 20-width edge
    const result = packItems("30,20,15", [[5, 30, 5]]);
    assert.strictEqual(result.canFit, true);
    assert.deepStrictEqual(result.placements[0].rotation, [30, 5, 5]);
});

test("reports failure when an item is too big in every orientation", () => {
    const result = packItems("30,20,15", [[25, 25, 25]]);
    assert.strictEqual(result.canFit, false);
    assert.match(result.reason, /does not fit in any orientation/);
});

test("enforces the max item cap", () => {
    const items = [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]];
    const result = packItems("30,20,15", items);
    assert.strictEqual(result.canFit, false);
    assert.match(result.reason, /Too many items/);
});

console.log("\nAll tests passed.");
