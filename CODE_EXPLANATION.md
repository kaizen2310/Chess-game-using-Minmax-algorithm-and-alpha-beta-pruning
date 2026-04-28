# Chess Code Explanation

This document explains the full codebase in practical terms: how the project starts, how game state is stored, how moves are generated and validated, how the DOM stays in sync with the model, and how the AI searches for moves.

## 1. High-level overview

This project is a browser-based chess game built with plain HTML, CSS, and JavaScript. There is no bundler, framework, or module system. Every script is loaded directly into the page, so each file exposes globals that later files depend on.

At a high level, the code is split into three layers:

1. UI layer
   - `chess.html` defines the board and menus.
   - `chess.css` styles the board, overlays, highlights, and controls.
   - `Board.js` connects user interaction to the game engine and updates the DOM.

2. Rules engine
   - `piece.js` generates raw movement patterns for each piece type.
   - `Game.js` applies chess rules such as blocking, capture, castling, check, and checkmate.
   - `History.js` stores multi-step move history for undo support.

3. AI layer
   - `SimulationGame.js` is a trimmed-down version of `Game` used only for search.
   - `ai.js` scores positions and runs a depth-limited minimax search.

The important architectural idea is this:

- The source of truth is the JavaScript `pieces` array managed by `Game`.
- The HTML board is only a visual projection of that state.
- `Game` emits events such as `pieceMove`, `kill`, `promotion`, and `turnChange`.
- `Board.js` listens to those events and updates the DOM.

## 2. Load order and startup flow

The script order in `chess.html` matters because the files are not modules:

1. `piece.js`
2. `History.js`
3. `Game.js`
4. `SimulationGame.js`
5. `ai.js`
6. `Board.js`

That order is required because:

- `Game.js` uses helpers from `piece.js` and `History.js`.
- `SimulationGame.js` extends `Game`.
- `ai.js` creates a `SimulationGame`.
- `Board.js` creates the main `Game` instance and calls `ai()`.

The startup sequence is:

1. The browser loads `chess.html` and renders the initial board markup.
2. JavaScript files are loaded in dependency order.
3. `Board.js` creates an initial `pieces` array and instantiates `const game = new Game(pieces, 'white')`.
4. The start screen lets the user choose human vs human or human vs AI.
5. Clicking Start Game calls `startNewGame()` from `Board.js`.
6. `startNewGame()` reads the selected options and calls `startBoard(game, { playAgainst, aiColor, aiLevel })`.
7. `startBoard()` repaints the board from the current game state, wires up UI events, and starts White's turn.

One important implementation detail: `startNewGame()` does not call `game.startNewGame(...)` with the original piece layout. It reuses the same `game` object and redraws from whatever state `game.pieces` currently contains. That means the UI resets, but the underlying game model is not fully reinitialized inside this function.

## 3. Board coordinate system

The project does not use algebraic notation internally. Instead, every square is encoded as a two-digit number:

- Tens digit = rank (row)
- Ones digit = file (column)

Examples:

- `11` = rank 1, file 1 = a1
- `15` = e1
- `81` = a8
- `88` = h8

This encoding makes directional movement simple:

- Up one square: `+10`
- Down one square: `-10`
- Right one square: `+1`
- Left one square: `-1`
- Diagonal up-right: `+11`
- Diagonal up-left: `+9`
- Diagonal down-right: `-9`
- Diagonal down-left: `-11`

Illegal coordinates are filtered out later. For example, anything outside `11` to `88`, or with a ones digit of `0` or `9`, is treated as off-board.

This numeric system is the foundation of almost every move helper in the project.

## 4. Core data model

The game does not use `Piece` classes. Each piece is a plain object with fields like these:

```js
{
  rank: 'rook',
  position: 11,
  color: 'white',
  name: 'whiteRook1',
  ableToCastle: true
}
```

Field meanings:

- `rank`: piece type (`pawn`, `knight`, `bishop`, `rook`, `queen`, `king`)
- `position`: two-digit square code
- `color`: `white` or `black`
- `name`: unique identifier used by both the engine and the DOM
- `ableToCastle`: only relevant for kings and rooks

Inside `Game`, the main state is:

- `this.pieces`: flat array of all active pieces
- `this.playerPieces.white`: cached array of white pieces
- `this.playerPieces.black`: cached array of black pieces
- `this.turn`: whose turn it is
- `this.clickedPiece`: temporary pointer used while calculating legal moves
- `this._events`: event registry for the UI layer
- `this.history`: a `History` instance

## 5. File-by-file explanation

### `chess.html`

This file contains all static markup for the app.

Main sections:

- Start scene
  - Lets the player choose opponent type.
  - Shows color selection only when AI mode is selected.
  - Calls `startNewGame()` when the button is clicked.

- End scene
  - Hidden overlay shown on checkmate.
  - Displays the winning color.

- Board container
  - Contains 64 `.square` divs arranged row by row.
  - Each square has an `id` equal to the numeric board coordinate.
  - Many squares initially contain `<img>` elements for the starting pieces.

- Turn indicator
  - The `<p id="turn">` element shows whose turn it is.

- Semataries
  - Captured pieces are moved into the white and black capture areas.
  - The code groups captured pieces by rank.

- Board flip button
  - Calls `boardAnimate()` to rotate the board and piece images.

Inline scripts at the bottom:

- `boardAnimate()`
  - Toggles CSS classes that rotate the board 180 degrees.
  - Also rotates each piece image so they appear upright after the board rotates.

- `changeColorSelect()`
  - Shows or hides the color picker depending on whether AI mode is selected.

Although the HTML includes all pieces up front, `startBoard()` in `Board.js` clears and rebuilds the board from the JavaScript model. So the initial markup is mainly bootstrapping content.

### `chess.css`

This file handles layout, appearance, and animation.

Important style groups:

- Board layout
  - `.board-container` centers the board.
  - `#board` keeps the board square using `aspect-ratio`.
  - `#board div div` sizes each square to one eighth of the board width.

- Square coloring
  - `.even` and `.odd` row wrappers use `nth-child` selectors to alternate light and dark tiles.

- Piece rendering
  - `img.piece` makes piece images fill the square.

- Move feedback
  - `.allowed` marks legal destination squares.
  - `.clicked-square` marks the currently selected origin square.
  - `.last-move` highlights the previous move.

- Board rotation
  - `.animate`, `.animate-backward`, `.forward`, and `.backward` are used by `boardAnimate()`.

- Overlay scenes
  - `.scene`, `.overlay`, and `.show` implement the start and end screens.

- Controls
  - Radio inputs are visually hidden.
  - Labels are styled to behave like buttons.
  - `.button` and `.button-big` style the start button.

The CSS is presentation-only. No game logic is stored here, but several class names are tightly coupled to `Board.js`.

### `piece.js`

This file is the raw move generator. It does not know about turns, check, or even whether another piece is blocking the path. It only describes geometric movement patterns.

#### `changePosition(piece, position, castle = false)`

This mutates a piece object's `position` field.

It also updates castling rights:

- If a king moves during a castle operation, `ableToCastle` becomes `false`.
- If a rook moves at all, `ableToCastle` becomes `false`.

#### Directional helpers

These functions generate straight or diagonal rays from the current piece position:

- `getMovesTop`
- `getMovesBottom`
- `getMovesRight`
- `getMovesLeft`
- `getMovesTopRight`
- `getMovesTopLeft`
- `getMovesBottomRight`
- `getMovesBottomLeft`

For sliding pieces, each helper returns a list of squares in one direction until the edge of the board. They do not stop when another piece would block the path. That part is handled later by `Game.unblockedPositions()`.

#### Piece-specific move generators

- `getPawnAllowedMoves(pawn)`
  - Returns two arrays: attack squares and forward movement squares.
  - White pawns move with `+10`; black pawns move with `-10`.
  - A pawn gets an extra two-square move from its starting rank.

- `getKnightAllowedMoves(knight)`
  - Returns eight possible L-shaped jumps.
  - Each move is wrapped in its own one-item array so it can be processed like a movement group.

- `getKingAllowedMoves(king)`
  - Returns the eight adjacent squares.

- `getBishopAllowedMoves(bishop)`
  - Returns four diagonal rays.

- `getRookAllowedMoves(rook)`
  - Returns four orthogonal rays.

- `getQueenAllowedMoves(queen)`
  - Combines rook and bishop movement into eight directional groups.

#### `getAllowedMoves(piece)`

This is the dispatch function that calls the correct helper based on `piece.rank`.

At this stage the returned moves are still only pseudo-legal patterns. Real legality is enforced in `Game.js`.

### `History.js`

This file implements a compact move history structure.

The model has two levels:

- `this._lastStep`: collects all sub-actions of the current turn
- `this._history`: stores completed turns

That design matters because one visible move can contain several state changes, for example:

- a capture plus a move
- king move plus rook move during castling
- pawn move plus promotion

Methods:

- `add(step)`
  - Appends a sub-step to the current turn.

- `save()`
  - Pushes the current turn into `_history` and clears `_lastStep`.

- `pop()`
  - Returns the most recent full turn.

- `lastMove()`
  - Returns the latest saved turn without removing it.

`History` is only used by `Game`, not by `SimulationGame`.

### `Game.js`

This is the real chess engine. It is responsible for legal move filtering, captures, promotions, castling, check detection, and the event system.

#### Construction and reset

- `constructor(pieces, turn)`
  - Immediately calls `startNewGame(pieces, turn)`.

- `startNewGame(pieces, turn)`
  - Clones the piece list into a new internal state.
  - Resets the turn, clicked piece, event registry, and history.

- `_setPieces(pieces)`
  - Creates a shallow clone of each piece object.
  - Builds `playerPieces.white` and `playerPieces.black` caches.

#### Piece collection helpers

- `_removePiece(piece)` removes a piece from both `this.pieces` and the color cache.
- `_addPiece(piece)` restores a piece to both collections.
- `getPiecesByColor(color)` returns the cached list.
- `getPlayerPositions(color)` returns just the positions for a side.
- `getPieceByName(name)` finds a piece by its unique name.
- `getPieceByPos(position)` finds a piece occupying a square.
- `positionHasExistingPiece(position)` is a convenience wrapper.

#### Event system

The engine exposes an observer-style API:

- `on(eventName, callback)` registers listeners.
- `triggerEvent(eventName, params)` runs all listeners for that event.

Events defined during setup:

- `pieceMove`
- `kill`
- `check`
- `promotion`
- `checkMate`
- `turnChange`

This event system is what lets the game logic stay mostly separate from DOM manipulation.

#### Turn handling

- `softChangeTurn()` flips the turn and emits `turnChange`.
- `changeTurn()` calls `softChangeTurn()` and then saves the move history.

The distinction matters because undo uses `softChangeTurn()` without creating new history entries.

#### Filtering board coordinates

`filterPositions(positions)` removes off-board coordinates.

It keeps only positions that:

- are greater than `10`
- are less than `89`
- do not have a ones digit of `0` or `9`

This is how the engine cleans up the raw numeric move patterns from `piece.js`.

#### `unblockedPositions(piece, allowedPositions, checking = true)`

This is one of the most important methods in the codebase.

Its job is to convert pseudo-legal movement patterns into actually usable move squares.

It does this by considering:

- friendly occupied squares
- enemy occupied squares
- whether moving there would leave your own king in check

How it works for pawns:

- Attack squares are only allowed if an enemy piece is there.
- Forward squares are only allowed if empty.
- Forward movement stops as soon as a blocking piece is encountered.
- If `checking` is true, forward or capture moves that expose the king are rejected.

How it works for non-pawns:

- For each directional group, it walks squares in order.
- If the square contains one of your own pieces, that direction stops immediately.
- If moving there would expose your king and `checking` is true, that square is skipped.
- If the square contains an enemy piece, the square is included and the direction then stops.
- Otherwise the square is added and the search continues.

This method is the bridge between raw movement geometry and real legal movement.

#### `getPieceAllowedMoves(pieceName)`

This is the main public method used by the UI.

Steps:

1. Find the piece by name.
2. Make sure it is that side's turn.
3. Store the piece in `this.clickedPiece`.
4. Get its base movement pattern from `getAllowedMoves(piece)`.
5. If the piece is a king, inject castling squares using `getCastlingSquares()`.
6. Return fully filtered legal moves using `unblockedPositions(..., true)`.

#### `getCastlingSquares(king, allowedMoves)`

This adds castling destinations to the king's normal moves.

Conditions checked:

- The king must still be allowed to castle.
- The king must not currently be in check.
- The corresponding rook must still have castling rights.
- The squares between king and rook must be empty.
- The king may not pass through or land on a checked square.

If queenside castling is allowed, the move is pushed into one king movement group.
If kingside castling is allowed, the move is pushed into another group.

The code depends on rooks being named exactly `whiteRook1`, `whiteRook2`, `blackRook1`, and `blackRook2`.

#### `movePiece(pieceName, position)`

This is the main state-changing method.

Flow:

1. Find the piece.
2. Convert `position` to an integer.
3. Verify the destination is in `getPieceAllowedMoves(piece.name)`.
4. If an enemy piece is on the square, call `kill(existedPiece)`.
5. Detect castling if the moving piece is a king with castling rights and the target is two squares away.
6. If castling, move the rook first via `castleRook(...)`.
7. Move the king or normal piece using `changePosition(...)`.
8. Record the move in history.
9. Emit `pieceMove`.
10. If a pawn reached the back rank, call `promote(...)`.
11. Change turn.
12. After the turn changes, check whether the new side to move is in check.
13. If that side has no legal escape, trigger checkmate.

If the destination is illegal, the method returns `false`.

#### Capture, castling, and promotion helpers

- `kill(piece)`
  - Removes the piece from active state.
  - Records a history step where `to` becomes `0`.
  - Emits `kill`.

- `castleRook(rookName)`
  - Moves the relevant rook to its castled square.
  - Emits `pieceMove`.
  - Adds the rook movement to history as part of the same turn.

- `promote(pawn)`
  - Renames the piece from `Pawn` to `Queen`.
  - Changes `rank` to `queen`.
  - Records a synthetic history step with `from: 0`.
  - Emits `promotion`.

Promotion is automatic and always becomes a queen. There is no underpromotion UI.

#### Self-check prevention

`myKingChecked(pos, kill = true)` temporarily simulates moving `this.clickedPiece` to a target square.

It works by:

1. Saving the original position.
2. Temporarily moving the current piece.
3. Temporarily removing any captured enemy piece if needed.
4. Calling `king_checked(piece.color)`.
5. Restoring the original state.

If the simulated move leaves the moving side's king attacked, the method returns `1`, otherwise `0`.

This is the core legality test that prevents illegal moves like moving a pinned piece away from the king.

#### Check and checkmate detection

- `king_checked(color)`
  - Finds the king for the given color.
  - Iterates over every enemy piece.
  - For each enemy piece, computes attack squares using `unblockedPositions(..., false)`.
  - If any enemy legal attack includes the king's square, the king is in check.

- `king_dead(color)`
  - Iterates through every piece of that color.
  - Calculates legal moves for each.
  - If any legal move exists, the king is not dead.
  - If no legal move exists, returns `1`.

Despite the name, `king_dead` really means "the side has no legal moves." In `movePiece()`, it is only treated as checkmate if the side is also in check.

#### Undo support

`undo()` replays the last stored turn in reverse-style logical steps by walking the saved sub-steps and restoring positions or pieces.

It can restore:

- moved pieces
- captured pieces
- castling rights for castling moves

The engine has undo support, but the current UI does not expose an undo button.

#### End-of-game behavior

`checkmate(color)` emits `checkMate` and then clears the event registry.

That effectively freezes interaction because the UI no longer receives engine events.

### `SimulationGame.js`

This class exists to let the AI explore future moves cheaply.

It extends `Game`, but deliberately disables features the AI does not need:

- `saveHistory()` does nothing
- `addToHistory()` does nothing
- `triggerEvent()` does nothing
- `clearEvents()` does nothing
- `undo()` does nothing
- `checkmate()` does nothing

Why this exists:

- The AI needs all move legality logic from `Game`.
- The AI does not need DOM events or move history during search.
- Reusing `Game` avoids writing a second rules engine.

Behavior differences worth noting:

- `king_checked(color)` immediately returns `true` if the king does not exist.
  - This helps the AI treat king loss as a terminal losing position.

- `movePiece(pieceName, position)` skips the public legality check used by the UI-facing `Game.movePiece()`.
  - The AI only feeds it moves that already came from `getPieceAllowedMoves()`.

So `SimulationGame` is effectively a stripped search engine wrapper around the same move rules.

### `ai.js`

This file creates the AI player. The exported value is a factory function:

```js
const ai = (aiTurn) => { ... }
```

Calling `ai('black')` returns an object with a `play(pieces, callback)` method.

#### Piece values and heuristics

The AI uses a simple material table:

- pawn = 1
- king = 2
- bishop = 3
- knight = 3
- rook = 5
- queen = 9

The king having value `2` is not meant to represent its real strategic value. The engine handles king loss and forced mate as terminal states separately.

The AI also gives small positional bonuses:

- exact center squares (`44`, `45`, `54`, `55`) multiply a piece's value by `1.05`
- wider center squares (`43`, `46`, `53`, `56`) multiply by `1.02`

#### Scoring function

`score(pieces)` sums the weighted values of all remaining pieces:

- AI pieces add positive value
- opponent pieces add negative value

This is a simple heuristic. It mostly measures material balance with a small center-control bonus.

#### Search depth

`const deepest = 3`

The AI looks ahead up to three recursive layers. That is a shallow search, but it keeps the game responsive in the browser.

#### Minimax flow

`minimax(pieces, turn, depth = 0)` works like this:

1. Reset `simulationGame` to the provided position and turn.
2. Check terminal conditions.
   - If the human king is missing or the human side has no legal moves, return `-Infinity`.
   - If the AI king is missing or the AI side has no legal moves, return `Infinity`.
3. Initialize `bestPlay` with the worst possible score for the side to move.
4. Loop through every piece in `pieces`.
5. Ask `simulationGame.getPieceAllowedMoves(piece.name)` for legal moves.
   - Pieces of the wrong color naturally return an empty list.
6. For each move:
   - Save the move description.
   - Apply the move in `simulationGame`.
   - Score the resulting board.
   - Either stop early or recurse deeper.
   - If the resulting score is better for the current side, update `bestPlay`.
   - Reset the simulation by calling `simulationGame.startNewGame(pieces, turn)` again.

The AI returns the best move found plus its score.

#### Async wrapper

`play(pieces, callback)` wraps minimax in `setTimeout(..., 100)`.

That small delay does two things:

- lets the UI update to show "thinking..."
- avoids blocking the click handler synchronously

#### Test helpers

- `isTestEnv()` checks the URL for a `testing` query parameter.
- `testFuncTime(func)` logs execution timing.

These are only used to instrument the AI in a testing context.

#### Important reality check about the AI

The README says the project uses minimax with alpha-beta pruning. The actual code definitely uses minimax, but there is no alpha-beta implementation here. There are a couple of shortcut helpers:

- `isBetterScore(...)`
- `isScoreGoodEnough(...)`

Those act as early decision heuristics, but they are not alpha-beta pruning because the search does not maintain alpha and beta bounds.

### `Board.js`

This file is the bridge between the engine and the page.

#### `startBoard(game, options = ...)`

This is the main UI setup function.

It does several jobs:

- creates an AI player if AI mode is enabled
- caches important DOM nodes
- repaints the board from the current game state
- installs click and drag/drop listeners
- subscribes to game events
- starts the first turn

#### DOM cache and board reset

At the top it grabs:

- `#board`
- all `.square` nodes
- both semataries
- `#turn`

Then it defines:

- `resetSematary()`
  - clears all captured-piece containers

- `resetBoard()`
  - clears every square
  - loops over `game.pieces`
  - inserts a fresh `<img>` for each piece based on its current state
  - hides the end scene

This means the UI does not rely on the original piece images in the HTML after startup.

#### Game state string

`setGameState(state)` assigns to `gameState` and updates the turn text when the AI is thinking.

One noteworthy detail: `gameState` is assigned without `let`, `const`, or `var`, which means it becomes an implicit global variable.

#### Move highlighting

- `setAllowedSquares(pieceImg)`
  - remembers the clicked piece name
  - asks `game.getPieceAllowedMoves(clickedPieceName)` for legal moves
  - highlights the source square and all allowed destination squares

- `clearSquares()`
  - removes `.allowed` and `.clicked-square` classes

- `setLastMoveSquares(from, to)`
  - clears old `.last-move` marks
  - highlights the previous origin and destination squares

#### User move flow

`movePiece(square)` is the UI-side move dispatcher.

It works like this:

1. If the AI is currently thinking, do nothing.
2. Read the clicked target square id.
3. Ask the game whether a piece currently occupies that square.
4. If the clicked square contains a friendly piece for the side to move, treat the click as a selection change and show that piece's legal moves.
5. Otherwise try to move the previously selected piece to the clicked square using `game.movePiece(clickedPieceName, position)`.

So the same function handles both selecting a piece and committing a move.

#### DOM event listeners

Board squares get:

- `click`
- `dragover`
- `drop`

Piece images get:

- `dragstart`
- `drop`

The drag/drop support is lightweight. It still routes all actual movement through the same `movePiece(square)` function.

#### Turn start and AI integration

`startTurn(turn)`:

1. Sets the UI state string.
2. Updates the turn indicator text.
3. If AI mode is enabled and the current turn matches the AI color:
   - set the state to `ai_thinking`
   - call `aiPlayer.play(game.pieces, callback)`
   - when the callback returns, move the chosen piece through the real game engine

The AI therefore never updates the DOM directly. It still uses `game.movePiece(...)`, which guarantees the same rule path as a human move.

#### Engine event subscriptions

`Board.js` listens to the engine and reacts as follows:

- `pieceMove`
  - move the piece image to the new square in the DOM
  - clear selection highlights
  - highlight the last move

- `turnChange`
  - call `startTurn(turn)`

- `promotion`
  - replace the square HTML with a queen image matching the promoted side

- `kill`
  - remove the piece image from the board
  - append it to the proper sematary section

- `checkMate`
  - show the end scene
  - display the winner text
  - mark the UI state as `checkmate`

#### Initial pieces and game instance

Below `startBoard`, the file defines the starting position as a literal array of piece objects and then creates:

```js
const game = new Game(pieces, 'white');
```

This is the main runtime engine used by the whole app.

#### `startNewGame()`

This function reads the selected form inputs:

- opponent type
- human color
- derived AI color

Then it calls `startBoard(game, { playAgainst, aiColor, aiLevel })`.

`aiLevel` is currently hard-coded to `'dumb'` and is not used anywhere by `ai.js`.

#### UI helper functions

- `showColorSelect()` adds the `show` class to the color selector
- `hideColorSelect()` removes the `show` class

These are called by the inline HTML script in `chess.html`.

## 6. End-to-end move lifecycle

Here is the full path of a normal human move from click to board update:

1. The player clicks a piece or starts dragging it.
2. `Board.js` calls `game.getPieceAllowedMoves(pieceName)`.
3. `Game` asks `piece.js` for pseudo-legal movement patterns.
4. `Game.unblockedPositions()` filters out blocked squares and self-checking moves.
5. `Board.js` highlights the returned destination squares.
6. The player clicks a destination square.
7. `Board.js` calls `game.movePiece(clickedPieceName, destination)`.
8. `Game.movePiece()` validates the move, updates the model, records history, and emits events.
9. `Board.js` receives `pieceMove`, `kill`, `promotion`, and `turnChange` events and updates the DOM.
10. If AI mode is active and it is now the AI's turn, `ai.js` searches for a move and feeds the chosen move back into `game.movePiece()`.

That loop continues until checkmate triggers the end overlay.

## 7. Supported rules and missing rules

Rules implemented in the current code:

- normal movement for all standard pieces
- turn-based play
- captures
- self-check prevention
- check detection
- checkmate detection
- castling
- pawn promotion to queen
- human vs human mode
- human vs AI mode

Rules or features not implemented, or not fully exposed:

- en passant
- underpromotion to rook, bishop, or knight
- stalemate handling as a separate draw result
- threefold repetition
- fifty-move rule
- insufficient material detection
- visible check indicator in the UI
- exposed undo button in the UI
- multiple AI difficulty levels

## 8. Important implementation quirks

These are not just style details; they matter when reading or extending the code.

### Global-script coupling

Because the app uses plain script tags instead of modules, every file depends on previous files creating globals. If the script order changes, the app will break.

### The DOM is rebuilt from model state

The initial HTML pieces are not the long-term source of truth. `startBoard()` clears the board and redraws it from `game.pieces`. When debugging, trust the JavaScript state first.

### "New game" does not fully reset the engine

`startNewGame()` redraws and rewires the UI but does not create a fresh `Game` instance or call `game.startNewGame(...)` with the original layout. If you want a true restart feature, this is the first place to change.

### Promotion rewrites the square HTML

On promotion, `Board.js` replaces the square's `innerHTML` with a queen image. That updates the appearance correctly, but it does not attach fresh drag listeners to that new image. Click-based movement still works because square clicks go through the engine, but promoted-piece drag behavior may be incomplete.

### README vs actual AI implementation

The README advertises alpha-beta pruning, but the code in `ai.js` does not implement alpha-beta bounds. The best description of the current AI is "depth-limited minimax with a simple material-and-center heuristic and a couple of early exit shortcuts."

### Naming assumptions are part of the rules

Castling logic depends on rook names like `whiteRook1` and `whiteRook2`. Promotion depends on replacing `Pawn` with `Queen` inside the piece name string. Those naming conventions are part of the engine behavior.

## 9. How to read this code efficiently

If you want to understand or modify the project, the most useful reading order is:

1. `chess.html`
   - See what exists in the page.
2. `Board.js`
   - Understand how the page talks to the engine.
3. `Game.js`
   - Learn the real rule enforcement.
4. `piece.js`
   - See where raw move patterns come from.
5. `SimulationGame.js`
   - Notice what the AI reuses and what it skips.
6. `ai.js`
   - Understand how moves are scored and selected.
7. `History.js`
   - Read the undo structure last.

That order matches how the app feels from the outside in: page first, then UI wiring, then rules, then AI.

## 10. Summary

This codebase is a small, understandable chess app with a clear separation between:

- move pattern generation in `piece.js`
- rule enforcement and state management in `Game.js`
- DOM synchronization in `Board.js`
- simulation-based search in `SimulationGame.js` and `ai.js`

The design is simple but effective:

- piece objects are plain JavaScript objects
- board coordinates are numeric and easy to compute with
- the engine emits events rather than directly touching the DOM
- the AI reuses the same rule engine through a lighter simulation subclass

If you want to extend the project, the biggest leverage points are:

- `Game.movePiece()` for rules
- `Game.unblockedPositions()` for legality
- `Board.js` for UI behavior
- `ai.js` for strength and search quality

That is the full structure of how this chess project works.