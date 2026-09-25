import { drawChessboard, renderPieces, drawArrow, clearArrows, squareSize, triggerExplosion, imagePieces } from "./src/drawChessboard.js";
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

    // Divide by squareSize (80) and floor the result to get the exact row/col
    return {
        row: Math.floor(y / squareSize),
        col: Math.floor(x / squareSize)
    };
}

gameContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

gameContainer.addEventListener('mousedown', (e) => {
    // Ensure we are only responding to the left mouse button
    if (e.button === 0) {

        if (e.altKey) {
            // Alt + Left Click: Prevent default browser behavior and start drawing
            e.preventDefault();
            drawStartSquare = getSquareFromEvent(e);
        } else {
            // Left Click alone: Clear all existing arrows on the board
            clearArrows();
        }

    }
});

gameContainer.addEventListener('mouseup', (e) => {
    // If the left button is released AND we are currently tracking a drawing gesture
    if (e.button === 0 && drawStartSquare) {
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
    const color = "hsl(200 100% 60% / 1)";
    const redColor = "hsl(0 100% 40%)";

    legalMoves.forEach(move => {
        const left = move.col * squareSize;
        const top = move.row * squareSize;

        // Determine the visual style based on whether the move is a capture
        let svgContent = '';
        if (move.isCapture) {
            // Draw a sleek, red X symbol centered in the 80x80 square
            svgContent = `
                <line x1="25" y1="25" x2="55" y2="55" stroke="${redColor}" stroke-width="6" stroke-linecap="round" />
                <line x1="55" y1="25" x2="25" y2="55" stroke="${redColor}" stroke-width="6" stroke-linecap="round" />
            `;
        } else {
            // Draw a solid dot for empty squares (radius 12)
            svgContent = `<circle cx="40" cy="40" r="12" fill="${color}" />`;
        }

        const hintHTML = `
            <svg 
                style="position: absolute; left: ${left}px; top: ${top}px; width: ${squareSize}px; height: ${squareSize}px;"
            >
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

    return moves;
}



// This will hold an object: { row, col, moves: [] }
let activeSelection = null;

export async function executeMove(fromSquare, toSquare, boardState) {
    // Clear the hints immediately so the UI feels responsive
    clearHints();

    // 1. Wait for the WAAPI translation to finish visually
    await animatePiece(fromSquare, toSquare);

    // 2. Update the underlying data matrix
    const piece = boardState[fromSquare.row][fromSquare.col];
    
    const isPiece = svgMap[boardState[toSquare.row][toSquare.col]];
    boardState[toSquare.row][toSquare.col] = piece;
    boardState[fromSquare.row][fromSquare.col] = null;

    if(isPiece) {
        triggerExplosion(toSquare.row, toSquare.col, isPiece);
    }
        
    

    // 3. Re-render the DOM to lock the piece into its new absolute position
    renderPieces(boardState);
}


export async function animatePiece(fromSquare, toSquare) {
    // 1. Locate the specific DOM element using the data attributes
    const pieceElement = document.querySelector(`.chess-piece-wrapper[data-row="${fromSquare.row}"][data-col="${fromSquare.col}"]`);

    if (!pieceElement) return;

    // 2. Calculate the exact pixel distance to travel on the X and Y axes
    const deltaX = (toSquare.col - fromSquare.col) * squareSize;
    const deltaY = (toSquare.row - fromSquare.row) * squareSize;

    const dx = Math.random() * (max - min) + min;

    // 3. Bring the animating piece to the front so it does not slide under others
    pieceElement.style.zIndex = "100";

    // 4. Define and execute the Web Animation API keyframes
    const animation = pieceElement.animate([
        { transform: 'translate(0px, 0px)' },
        { transform: `translate(${deltaX}px, ${deltaY}px)` }
    ], {
        duration: 250, // 250ms is standard for UI interaction speeds
        easing: 'ease-in', // An easing curve that starts fast and decelerates smoothly
        fill: 'forwards' // Hold the piece at the final position when the animation ends
    });

    // 5. Pause code execution until the animation completely finishes
    await animation.finished;
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