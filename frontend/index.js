import { drawChessboard, renderPieces, drawArrow, clearArrows, squareSize, triggerExplosion, imagePieces, color, rows, cols } from "./src/drawChessboard.js";
import { boardState, svgMap } from "./src/handlePieceState.js";

drawChessboard();
renderPieces(boardState);


const gameContainer = document.getElementById('game-container');
let drawStartSquare = null;


function getSquareFromEvent(event) {
    const rect = gameContainer.getBoundingClientRect();

    // Calculate mouse position relative to the top-left of the container
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Divide by squareSize and floor the result to get the exact row/col
    return {
        row: Math.floor(y / squareSize),
        col: Math.floor(x / squareSize)
    };
}

gameContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

gameContainer.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        // Left Click alone: Clear all existing arrows on the board
        clearArrows();
    } else if (e.button === 2) {
        e.preventDefault();
        drawStartSquare = getSquareFromEvent(e);
        console.log("right click!");
    }
});

gameContainer.addEventListener('mouseup', (e) => {
    // If the left button is released AND we are currently tracking a drawing gesture
    if (e.button === 2 && drawStartSquare) {
        const drawEndSquare = getSquareFromEvent(e);

        // Validate that the mouse moved to a new square
        if (drawStartSquare.row !== drawEndSquare.row || drawStartSquare.col !== drawEndSquare.col) {
            drawArrow(
                drawStartSquare.row, drawStartSquare.col,
                drawEndSquare.row, drawEndSquare.col
            );
        }

        // Terminate the drawing state
        drawStartSquare = null;
    }
});



const hintsLayer = document.getElementById('hints-layer');

// Expected input: an array of objects, e.g., [{row: 2, col: 4, isCapture: false}, ...]
export function drawHints(legalMoves) {
    // Clear any existing hints
    hintsLayer.innerHTML = '';
    const hintColor = `hsl(${color} 100% 15% / 0.5)`;
    const redColor = "hsl(0 100% 40%)";

    legalMoves.forEach(move => {
        const left = move.col * squareSize;
        const top = move.row * squareSize;

        // Determine the visual style based on whether the move is a capture
        let svgContent = '';
        if (move.isCapture) {
            // Draw a sleek, red X symbol centered in the 80x80 square
            svgContent = `
                <line x1="${(squareSize * 0.25)}" y1="${(squareSize * 0.25)}" x2="${squareSize - (squareSize * 0.25)}" y2="${squareSize - (squareSize * 0.25)}" stroke="${redColor}" stroke-width="${squareSize * 0.075}" stroke-linecap="round" />
                <line x1="${squareSize - (squareSize * 0.25)}" y1="${(squareSize * 0.25)}" x2="${(squareSize * 0.25)}" y2="${squareSize - (squareSize * 0.25)}" stroke="${redColor}" stroke-width="${squareSize * 0.075}" stroke-linecap="round" />
            `;
        } else {
            // Draw a solid dot for empty squares (radius 12)
            svgContent = `<circle cx="${squareSize / 2}" cy="${squareSize / 2}" r="${squareSize * 0.12}" fill="${hintColor}" />`;
        }

        const hintHTML = `
            <svg style="position: absolute; left: ${left}px; top: ${top}px; width: ${squareSize}px; height: ${squareSize}px;">
                ${svgContent}
            </svg>
        `;

        hintsLayer.insertAdjacentHTML('beforeend', hintHTML);
    });
}



export function clearHints() {
    hintsLayer.innerHTML = '';
}





// Returns true if the piece is uppercase (White)
function isWhite(piece) {
    return piece === piece.toUpperCase();
}

// Returns true if the target square contains a piece of the opposite case
function isEnemy(movingPiece, targetPiece) {
    if (!targetPiece) return false; // Empty squares are not enemies
    return isWhite(movingPiece) !== isWhite(targetPiece);
}



export function getSlidingMoves(startRow, startCol, boardState, directions) {
    const moves = [];
    const movingPiece = boardState[startRow][startCol];

    for (const [dRow, dCol] of directions) {
        let currentRow = startRow + dRow;
        let currentCol = startCol + dCol;

        while (currentRow >= 0 && currentRow < 8 && currentCol >= 0 && currentCol < 8) {
            const targetPiece = boardState[currentRow][currentCol];

            if (targetPiece === null) {
                moves.push({ row: currentRow, col: currentCol, isCapture: false });
            } else {
                if (isEnemy(movingPiece, targetPiece)) {
                    moves.push({ row: currentRow, col: currentCol, isCapture: true });
                }
                break; // The slide is blocked by either a friend or an enemy
            }

            currentRow += dRow;
            currentCol += dCol;
        }
    }
    return moves;
}



export function getPawnMoves(startRow, startCol, boardState) {
    const moves = [];
    const movingPiece = boardState[startRow][startCol];
    const isWhitePiece = isWhite(movingPiece);

    // White moves UP the matrix (-1), Black moves DOWN (+1)
    const direction = isWhitePiece ? -1 : 1;

    // White pawns start on row 6, Black pawns start on row 1
    const startingRow = isWhitePiece ? 6 : 1;

    const nextRow = startRow + direction;

    // Ensure the next row is within the bounds of the board
    if (nextRow < 0 || nextRow > 7) return moves;

    // 1. Single Step Forward
    if (boardState[nextRow][startCol] === null) {
        moves.push({ row: nextRow, col: startCol, isCapture: false });

        // 2. Double Step Forward (Requires the single step to be empty first)
        if (startRow === startingRow) {
            const doubleStepRow = startRow + (direction * 2);
            if (boardState[doubleStepRow][startCol] === null) {
                moves.push({ row: doubleStepRow, col: startCol, isCapture: false });
            }
        }
    }


    // 3. Diagonal Captures (Left and Right)
    const captureCols = [startCol - 1, startCol + 1];

    for (const targetCol of captureCols) {
        // Verify the column index is within the 0-7 matrix bounds
        if (targetCol >= 0 && targetCol <= 7) {
            const targetPiece = boardState[nextRow][targetCol];

            // If a piece exists there AND it is an enemy, it is a valid capture
            if (targetPiece !== null && isEnemy(movingPiece, targetPiece)) {
                moves.push({ row: nextRow, col: targetCol, isCapture: true });
            }
        }
    }

    // ... existing diagonal capture logic ...

    // 4. En Passant Validation
    if (lastMove && lastMove.pieceChar.toLowerCase() === 'p') {
        // Did the enemy pawn just move exactly two squares?
        const wasDoubleStep = Math.abs(lastMove.fromRow - lastMove.toRow) === 2;

        // Did it land immediately to the left or right of our moving pawn?
        const isAdjacent = lastMove.toRow === startRow && Math.abs(lastMove.toCol - startCol) === 1;

        if (wasDoubleStep && isAdjacent) {
            // The legal destination is one square diagonally forward, behind the enemy pawn
            moves.push({
                row: nextRow,
                col: lastMove.toCol,
                isCapture: true
            });
        }
    }

    return moves;
}


// This will hold an object: { row, col, moves: [] }
let activeSelection = null;
let lastMove = null; // Will store: { pieceChar, fromRow, fromCol, toRow, toCol }

export async function executeMove(fromSquare, toSquare, boardState) {
    clearHints();

    const movingPieceChar = boardState[fromSquare.row][fromSquare.col];
    const targetPieceChar = boardState[toSquare.row][toSquare.col];
    
    // Wait for the WAAPI translation to finish visually
    await animatePiece(fromSquare, toSquare);

    // Mathematical En Passant Detection:
    // A pawn is moving diagonally (columns differ) into a completely empty square.
    const isEnPassant = movingPieceChar.toLowerCase() === 'p' &&
        fromSquare.col !== toSquare.col &&
        !targetPieceChar;
        
    if (targetPieceChar) {
        // Standard Capture
        triggerExplosion(toSquare.row, toSquare.col, svgMap[targetPieceChar]);
        const capturedElement = document.querySelector(`.chess-piece-wrapper[data-row="${toSquare.row}"][data-col="${toSquare.col}"]`);
        if (capturedElement) capturedElement.style.display = 'none';

    } else if (isEnPassant) {
        // En Passant Capture
        const capturedRow = fromSquare.row; // The enemy pawn is on our starting row
        const capturedCol = toSquare.col;   // The enemy pawn is in our target column
        const capturedPieceChar = boardState[capturedRow][capturedCol];

        triggerExplosion(capturedRow, capturedCol, svgMap[capturedPieceChar]);

        const capturedElement = document.querySelector(`.chess-piece-wrapper[data-row="${capturedRow}"][data-col="${capturedCol}"]`);
        if (capturedElement) capturedElement.style.display = 'none';

        // Delete the enemy pawn from the array immediately
        boardState[capturedRow][capturedCol] = null;
    }


    // Update the underlying data matrix
    boardState[toSquare.row][toSquare.col] = movingPieceChar;
    boardState[fromSquare.row][fromSquare.col] = null;

    // Record this move so the engine can evaluate En Passant on the NEXT turn
    lastMove = {
        pieceChar: movingPieceChar,
        fromRow: fromSquare.row,
        fromCol: fromSquare.col,
        toRow: toSquare.row,
        toCol: toSquare.col
    };

    renderPieces(boardState);
}

export async function animatePiece(fromSquare, toSquare) {
    const pieceElement = document.querySelector(`.chess-piece-wrapper[data-row="${fromSquare.row}"][data-col="${fromSquare.col}"]`);
    if (!pieceElement) return;

    const deltaX = (toSquare.col - fromSquare.col) * squareSize;
    const deltaY = (toSquare.row - fromSquare.row) * squareSize;
    pieceElement.style.zIndex = "100";

    const href = pieceElement.querySelector('use').getAttribute('href');
    const svgId = href.split('#')[1];
    const img = imagePieces[svgId];
    const gameContainer = document.getElementById('game-container');

    // Create a dedicated, temporary canvas specifically for this trail
    const trailCanvas = document.createElement('canvas');
    trailCanvas.width = squareSize * cols;
    trailCanvas.height = squareSize * rows;
    trailCanvas.style.cssText = "position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none;";
    gameContainer.appendChild(trailCanvas);
    const trailCtx = trailCanvas.getContext('2d');

    let isAnimating = true;
    const ghosts = [];

    // 1. Frame Rate Controller (Adjust this value to test different densities)
    // 60 = ultra-smooth/dense, 24 = cinematic, 12 = stylized/sparse stop-motion
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    let previousTimestamp = performance.now();

    // 2. Accept the timestamp parameter
    function renderTrail(currentTimestamp) {

        // Calculate the exact milliseconds elapsed since the last drawn frame
        const elapsed = currentTimestamp - previousTimestamp;

        // If the elapsed time is less than our target interval, skip drawing entirely
        if (elapsed < frameInterval) {
            if (isAnimating || ghosts.length > 0) {
                requestAnimationFrame(renderTrail);
            } else {
                trailCanvas.remove();
            }
            return; // Terminate execution for this frame
        }

        // Update the timestamp for the next cycle, modulo the remainder to prevent time drift
        previousTimestamp = currentTimestamp - (elapsed % frameInterval);

        // --- YOUR EXISTING RENDER LOGIC BELOW ---
        trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);

        if (isAnimating) {
            const rect = pieceElement.getBoundingClientRect();
            const containerRect = gameContainer.getBoundingClientRect();
            const x = rect.left - containerRect.left;
            const y = rect.top - containerRect.top;
            ghosts.push({ x, y, opacity: 0.4 });
        }

        for (let i = ghosts.length - 1; i >= 0; i--) {
            const ghost = ghosts[i];
            trailCtx.globalAlpha = ghost.opacity;

            if (img) {
                trailCtx.drawImage(img, ghost.x, ghost.y, squareSize, squareSize);
                trailCtx.globalCompositeOperation = 'source-atop';
                trailCtx.fillStyle = 'hsl(0 100% 40% / 1)';
                trailCtx.fillRect(ghost.x, ghost.y, squareSize, squareSize);
                trailCtx.globalCompositeOperation = 'source-over';
            }

            // Note: If you drastically lower the FPS (e.g., to 12), you may want to 
            // increase this decay value (e.g., to 0.10) so the ghosts still fade out quickly.
            ghost.opacity -= 0.05;

            if (ghost.opacity <= 0) ghosts.splice(i, 1);
        }

        trailCtx.globalAlpha = 1.0;

        if (isAnimating || ghosts.length > 0) {
            requestAnimationFrame(renderTrail);
        } else {
            trailCanvas.remove();
        }
    }

    requestAnimationFrame(renderTrail); // is calling without the parameter good here?

    const animation = pieceElement.animate([
        { transform: 'translate(0px, 0px)' },
        { transform: `translate(${deltaX}px, ${deltaY}px)` }
    ], {
        duration: 180,
        easing: 'ease-in',
        fill: 'forwards'
    });

    await animation.finished;
    isAnimating = false;
}

gameContainer.addEventListener('mousedown', (e) => {
    // Ignore right-clicks or Alt-clicks used for drawing arrows
    if (e.button !== 0 || e.altKey) return;

    const clickedSquare = getSquareFromEvent(e);
    const clickedRow = clickedSquare.row;
    const clickedCol = clickedSquare.col;

    // Scenario A: The user is trying to move an already selected piece
    if (activeSelection) {
        const isValidDestination = activeSelection.moves.find(
            m => m.row === clickedRow && m.col === clickedCol
        );

        if (isValidDestination) {
            // Execute the state update and UI render
            executeMove(activeSelection, clickedSquare, boardState);

            // Clear the selection so the next click starts fresh
            activeSelection = null;
            return; // Terminate execution immediately
        }
    }

    // Scenario B: The user is clicking a piece to select it
    const pieceChar = boardState[clickedRow][clickedCol];

    if (pieceChar) {
        // Assume getLegalMoves routes to the specific piece logic (like getRookMoves)
        const legalMoves = getLegalMoves(clickedRow, clickedCol, boardState);

        // Store the selection in memory
        activeSelection = { row: clickedRow, col: clickedCol, moves: legalMoves };

        // Draw the visual indicators
        drawHints(legalMoves);
    } else {
        // Scenario C: The user clicked an empty square. Cancel any active selection.
        activeSelection = null;
        clearHints();
    }
});






export function getLegalMoves(row, col, boardState) {
    const pieceChar = boardState[row][col];

    // Safety check: if the square is empty, there are no moves
    if (!pieceChar) return [];

    const normalizedPiece = pieceChar.toLowerCase();

    // Route the coordinate data to the correct algorithmic function
    switch (normalizedPiece) {
        case 'p':
            return getPawnMoves(row, col, boardState);
        case 'r':
            return getRookMoves(row, col, boardState);
        case 'n':
            return getKnightMoves(row, col, boardState);
        case 'b':
            return getBishopMoves(row, col, boardState);
        case 'q':
            return getQueenMoves(row, col, boardState);
        case 'k':
            return getKingMoves(row, col, boardState);
        default:
            return [];
    }
}



export function getBishopMoves(row, col, boardState) {
    const diagonalVectors = [
        [-1, -1], [-1, 1], // Northwest, Northeast
        [1, -1], [1, 1]    // Southwest, Southeast
    ];
    return getSlidingMoves(row, col, boardState, diagonalVectors);
}

export function getQueenMoves(row, col, boardState) {
    const omniVectors = [
        [-1, 0], [1, 0], [0, -1], [0, 1],       // Orthogonal (Rook)
        [-1, -1], [-1, 1], [1, -1], [1, 1]      // Diagonal (Bishop)
    ];
    return getSlidingMoves(row, col, boardState, omniVectors);
}

// You can also refactor your existing getRookMoves to use this:
export function getRookMoves(row, col, boardState) {
    const orthogonalVectors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    return getSlidingMoves(row, col, boardState, orthogonalVectors);
}




export function getKnightMoves(startRow, startCol, boardState) {
    const moves = [];
    const movingPiece = boardState[startRow][startCol];

    // The 8 possible "L" shape jumps
    const knightJumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    for (const [dRow, dCol] of knightJumps) {
        const targetRow = startRow + dRow;
        const targetCol = startCol + dCol;

        if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
            const targetPiece = boardState[targetRow][targetCol];

            if (targetPiece === null) {
                moves.push({ row: targetRow, col: targetCol, isCapture: false });
            } else if (isEnemy(movingPiece, targetPiece)) {
                moves.push({ row: targetRow, col: targetCol, isCapture: true });

            }
        }
    }
    return moves;
}

export function getKingMoves(startRow, startCol, boardState) {
    const moves = [];
    const movingPiece = boardState[startRow][startCol];

    // The 8 immediately adjacent squares
    const kingSteps = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    for (const [dRow, dCol] of kingSteps) {
        const targetRow = startRow + dRow;
        const targetCol = startCol + dCol;

        if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
            const targetPiece = boardState[targetRow][targetCol];

            if (targetPiece === null) {
                moves.push({ row: targetRow, col: targetCol, isCapture: false });
            } else if (isEnemy(movingPiece, targetPiece)) {
                moves.push({ row: targetRow, col: targetCol, isCapture: true });

            }
        }
    }
    return moves;
}



fetch('./assets/pieces/standard.svg')
    .then(response => response.text())
    .then(svgText => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");

        // Inject the SVG into the DOM to prevent flickering
        const hiddenDiv = document.createElement('div');
        hiddenDiv.style.display = 'none';
        hiddenDiv.innerHTML = svgText;
        document.body.appendChild(hiddenDiv);

        // Iterate through the svgMap to extract each piece's <g> tag
        for (const [char, svgId] of Object.entries(svgMap)) {
            const groupElement = svgDoc.getElementById(svgId);

            if (groupElement) {
                // Wrap the extracted group in a clean SVG structure
                const isolatedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${groupElement.outerHTML}</svg>`;

                // Convert the string to a Data URI and assign it to a valid Canvas Image object
                const img = new Image();
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(isolatedSvg);

                // Store the valid Image object using the SVG ID as the key
                imagePieces[svgId] = img;
            }
        }
    });


