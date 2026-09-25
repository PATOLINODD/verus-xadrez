import { SpriteSheet } from "./SpriteSheet.js";
import { boardState, svgMap } from "./handlePieceState.js";

const piecesLayer = document.getElementById('pieces-layer');
export const squareSize = 80;
const html = String.raw;
export const imagePieces = {};


export function drawChessboard() {
    const c = document.querySelector('canvas#chessboard');
    const size = 80;
    const [rows, cols] = [8, 8];
    c.width = size * rows;
    c.height = size * cols;
    const g2 = c.getContext('2d');


    g2.clearRect(0, 0, c.width, c.height);
    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            const isLight = (x + y) % 2 === 0;
            g2.fillStyle = isLight ? "hsl(20 0% 70%)" : "hsl(20 0% 40%)";
            g2.fillRect(x * size, y * size, size, size);
        }
    }
}


export function renderPieces(boardState) {
    // 1. Clear the layer to prevent duplicating pieces upon re-rendering
    piecesLayer.innerHTML = '';

    // 2. Iterate through rows (Y-axis) and columns (X-axis)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const pieceChar = boardState[row][col];

            // 3. If a piece exists on this square, generate its SVG
            if (pieceChar) {
                const svgId = svgMap[pieceChar];
                const leftPosition = col * squareSize;
                const topPosition = row * squareSize;

                // Replace "0 0 45 45" with the actual viewBox found in your standard.svg file
                const nativeViewBox = "0 0 40 40";

                const pieceHTML = `
                    <div class="chess-piece-wrapper" data-row="${row}" data-col="${col}"
                        style="position: absolute; left: ${leftPosition}px; top: ${topPosition}px; width: ${squareSize}px; height: ${squareSize}px; display: flex; justify-content: center; align-items: center; pointer-events: auto; cursor: grab;">
                        
                        <svg viewBox="${nativeViewBox}" style="width: 85%; height: 85%; pointer-events: none;">
                            <use href="./assets/pieces/standard.svg#${svgId}"></use>
                        </svg>
                        
                    </div>
                `;

                // Inject the generated element directly into the DOM
                piecesLayer.insertAdjacentHTML('beforeend', pieceHTML);
            }
        }
    }
}

export function getSquareCenter(row, col) {
    return {
        x: (col * squareSize) + (squareSize / 2),
        y: (row * squareSize) + (squareSize / 2)
    };
}

const arrowLayer = document.getElementById('arrow-layer');

export function drawArrow(fromRow, fromCol, toRow, toCol) {
    const start = getSquareCenter(fromRow, fromCol);
    const end = getSquareCenter(toRow, toCol);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);

    // Adjust this value to bring the arrowhead closer to or further from the center
    const offset = 35;

    const ratio = (distance - offset) / distance;
    const newEndX = start.x + (dx * ratio);
    const newEndY = start.y + (dy * ratio);

    const lineHTML = `
        <line 
            x1="${start.x}" y1="${start.y}" 
            x2="${newEndX}" y2="${newEndY}" 
            stroke="var(--arrow-color)" 
            stroke-width="9" 
            marker-end="url(#arrowhead)" 
            stroke-linecap=""
            class="annotation-arrow"
        />
    `;

    arrowLayer.insertAdjacentHTML('beforeend', lineHTML);
}

export function clearArrows() {
    // Remove all lines, but preserve the <defs> tag containing the arrowhead
    arrowLayer.querySelectorAll('.annotation-arrow').forEach(arrow => arrow.remove());
}



function rasterizePiece(svgId) {
    const offscreen = document.createElement('canvas');
    offscreen.width = squareSize; // 80
    offscreen.height = squareSize;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });

    // Assuming you have the piece stored as an Image object from our previous extraction logic
    const pieceImg = imagePieces[svgId];

    if (pieceImg) {
        ctx.drawImage(pieceImg, 0, 0, squareSize, squareSize);
    }

    // Return the raw RGBA pixel matrix
    return ctx.getImageData(0, 0, squareSize, squareSize);
}



function createVoronoiShards(imageData, numShards = 15) {
    const shards = Array.from({ length: numShards }, () => ({
        pixels: [],
        // Random center point within the 80x80 bounding box
        centerX: Math.random() * squareSize,
        centerY: Math.random() * squareSize,
        // Random explosion vectors for physics
        velocityX: (Math.random() - 0.5) * 15,
        velocityY: (Math.random() - 0.5) * 15 - 5 // Bias upward slightly
    }));

    const data = imageData.data;

    // Iterate through every pixel in the 80x80 grid
    for (let y = 0; y < squareSize; y++) {
        for (let x = 0; x < squareSize; x++) {
            const index = (y * squareSize + x) * 4;
            const alpha = data[index + 3];

            if (alpha > 0) { // Only process visible parts of the piece
                let closestShard = shards[0];
                let minDistance = Infinity;

                // Find the nearest Voronoi seed using the Pythagorean theorem
                for (const shard of shards) {
                    const dist = Math.hypot(shard.centerX - x, shard.centerY - y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestShard = shard;
                    }
                }

                // Store the pixel data and its local coordinates in the closest shard
                closestShard.pixels.push({
                    x: x, y: y,
                    r: data[index], g: data[index + 1], b: data[index + 2], a: alpha
                });
            }
        }
    }

    return shards.filter(s => s.pixels.length > 0);
}




const fxCanvas = document.getElementById('fx-layer');
const fxCtx = fxCanvas.getContext('2d');

export function triggerExplosion(captureRow, captureCol, capturedSvgId) {
    const imageData = rasterizePiece(capturedSvgId);
    const shards = createVoronoiShards(imageData);

    // Absolute starting coordinates on the main board
    const startX = captureCol * squareSize;
    const startY = captureRow * squareSize;

    let opacity = 1.0;

    function animate() {
        // Clear the FX canvas for the next frame
        fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
        opacity -= 0.02; // Fade out the explosion gradually

        if (opacity <= 0) return; // End the animation loop

        shards.forEach(shard => {
            // Apply physics
            shard.centerX += shard.velocityX;
            shard.centerY += shard.velocityY;
            shard.velocityY += 0.8; // Gravity pulling pieces downward

            // Draw the shard's pixels at its new position
            fxCtx.fillStyle = `rgba(0, 0, 0, ${opacity})`;

            shard.pixels.forEach(p => {
                fxCtx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${opacity})`;
                // Calculate global board position + shard translation + local pixel offset
                const drawX = startX + p.x + (shard.centerX - p.x) * 0.5;
                const drawY = startY + p.y + (shard.centerY - p.y) * 0.5;

                fxCtx.fillRect(drawX, drawY, 1, 1);
            });
        });

        requestAnimationFrame(animate);
    }

    // Hide the captured DOM piece instantly and start the animation
    animate();
}