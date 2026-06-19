const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Suitcase Packing Backend Running");
});

const MAX_ITEMS = 5;

// all 6 axis-aligned rotations of [l, w, h], deduped (cubes/equal dims collapse)
function getOrientations([l, w, h]) {
    const perms = [
        [l, w, h], [l, h, w],
        [w, l, h], [w, h, l],
        [h, l, w], [h, w, l]
    ];
    const seen = new Set();
    return perms.filter(p => {
        const key = p.join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// shelf-packing rule: fill a row along x, stack rows along y into a layer,
// stack layers along z. Returns null if the orientation can't be placed
// at/after the current cursor, otherwise the chosen position, the resulting
// cursor, and how many row/layer wraps it took (fewer wraps = tighter fit).
function tryPlace([ex, ey, ez], cursor, boxL, boxW, boxH) {
    let { x, y, z, maxRowHeight, maxLayerHeight } = cursor;
    let wraps = 0;

    if (x + ex > boxL) {
        x = 0;
        y += maxRowHeight;
        maxRowHeight = 0;
        wraps++;
    }
    if (x + ex > boxL) return null; // wider than the box even on a fresh row

    if (y + ey > boxW) {
        y = 0;
        z += maxLayerHeight;
        maxLayerHeight = 0;
        wraps++;
    }
    if (y + ey > boxW) return null; // deeper than the box even on a fresh layer

    if (z + ez > boxH) return null; // taller than the remaining box height

    return {
        position: [x, y, z],
        wraps,
        next: {
            x: x + ex,
            y,
            z,
            maxRowHeight: Math.max(maxRowHeight, ey),
            maxLayerHeight: Math.max(maxLayerHeight, ez)
        }
    };
}

// pure packing algorithm: box is "L,W,H", items is an array of [l,w,h].
// returns { canFit, placements, reason? } — no Express/HTTP concerns here,
// so it can be unit tested directly.
function packItems(box, items) {
    if (items.length > MAX_ITEMS) {
        return { canFit: false, reason: `Too many items (max ${MAX_ITEMS})`, placements: [] };
    }

    const [boxL, boxW, boxH] = box.split(",").map(Number);

    // largest volume first
    const sortedItems = items
        .map(item => ({
            dims: item,
            volume: item[0] * item[1] * item[2]
        }))
        .sort((a, b) => b.volume - a.volume);

    let cursor = { x: 0, y: 0, z: 0, maxRowHeight: 0, maxLayerHeight: 0 };
    const placements = [];

    for (const obj of sortedItems) {
        // try every rotation at the current cursor, keep the ones that fit
        const candidates = getOrientations(obj.dims)
            .map(orientation => ({ orientation, result: tryPlace(orientation, cursor, boxL, boxW, boxH) }))
            .filter(c => c.result !== null);

        if (candidates.length === 0) {
            return {
                canFit: false,
                reason: `Item (${obj.dims.join(",")}) does not fit in any orientation`,
                placements
            };
        }

        // best fit = fewest row/layer wraps, then the orientation that leaves
        // the smallest vertical footprint for what comes next
        candidates.sort((a, b) =>
            a.result.wraps - b.result.wraps ||
            a.orientation[2] - b.orientation[2]
        );
        const best = candidates[0];

        placements.push({
            item: obj.dims,
            position: best.result.position,
            rotation: best.orientation
        });

        cursor = best.result.next;
    }

    return { canFit: true, placements };
}

app.post("/pack", (req, res) => {
    const { box, items } = req.body;
    res.json(packItems(box, items));
});

if (require.main === module) {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = { getOrientations, tryPlace, packItems, MAX_ITEMS };