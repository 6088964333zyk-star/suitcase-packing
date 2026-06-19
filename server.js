const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/**
 * 关键修改 1：
 * 让 Express 可以直接托管前端静态文件（index.html / JS / CSS）
 */
app.use(express.static(__dirname));

/**
 * 关键修改 2：
 * 明确 "/" 返回 index.html（保证访问主页就是前端）
 */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const MAX_ITEMS = 5;

// all 6 axis-aligned rotations of [l, w, h], deduped
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
        return { canFit: false, reason: `Too many items (max ${MAX_ITEMS})`, placements: [] };
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
            .map(orientation => ({
                orientation,
                result: tryPlace(orientation, cursor, boxL, boxW, boxH)
            }))
            .filter(c => c.result !== null);

        if (candidates.length === 0) {
            return {
                canFit: false,
                reason: `Item (${obj.dims.join(",")}) does not fit in any orientation`,
                placements
            };
        }

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

/**
 * Render / 本地启动兼容
 */
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = { getOrientations, tryPlace, packItems, MAX_ITEMS };