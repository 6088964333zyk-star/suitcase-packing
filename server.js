const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// 静态文件
app.use(express.static(__dirname));

// API
const MAX_ITEMS = 5;

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

function tryPlace([ex, ey, ez], cursor, boxL, boxW, boxH) {
    let { x, y, z, maxRowHeight, maxLayerHeight } = cursor;
    let wraps = 0;

    if (x + ex > boxL) {
        x = 0;
        y += maxRowHeight;
        maxRowHeight = 0;
        wraps++;
    }
    if (x + ex > boxL) return null;

    if (y + ey > boxW) {
        y = 0;
        z += maxLayerHeight;
        maxLayerHeight = 0;
        wraps++;
    }
    if (y + ey > boxW) return null;

    if (z + ez > boxH) return null;

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

function packItems(box, items) {
    if (items.length > MAX_ITEMS) {
        return { canFit: false, reason: "Too many items", placements: [] };
    }

    const [boxL, boxW, boxH] = box.split(",").map(Number);

    const sortedItems = items
        .map(item => ({
            dims: item,
            volume: item[0] * item[1] * item[2]
        }))
        .sort((a, b) => b.volume - a.volume);

    let cursor = { x: 0, y: 0, z: 0, maxRowHeight: 0, maxLayerHeight: 0 };
    const placements = [];

    for (const obj of sortedItems) {
        const candidates = getOrientations(obj.dims)
            .map(o => ({ o, r: tryPlace(o, cursor, boxL, boxW, boxH) }))
            .filter(c => c.r);

        if (!candidates.length) {
            return { canFit: false, placements };
        }

        candidates.sort((a, b) =>
            a.r.wraps - b.r.wraps ||
            a.o[2] - b.o[2]
        );

        const best = candidates[0];

        placements.push({
            item: obj.dims,
            position: best.r.position,
            rotation: best.o
        });

        cursor = best.r.next;
    }

    return { canFit: true, placements };
}

app.post("/pack", (req, res) => {
    const { box, items } = req.body;
    res.json(packItems(box, items));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});