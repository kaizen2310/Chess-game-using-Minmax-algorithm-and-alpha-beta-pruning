# ♟️ Chess Game - Browser-Based Implementation

A fully-featured, browser-based chess game built with **vanilla JavaScript, HTML, and CSS**. Play against another human player or challenge an AI opponent with adjustable difficulty levels.

## Features

✨ **Core Gameplay**
- Complete implementation of standard chess rules (castling, en passant, pawn promotion, check/checkmate detection)
- Two game modes: Human vs. Human or Human vs. AI
- Choose your color (white or black) when playing against AI
- Move validation and illegal move prevention
- Turn-based gameplay with clear UI feedback

🤖 **AI Opponent**
- Minimax algorithm with alpha-beta pruning for optimal move selection
- Four difficulty levels: **Dumb, Easy, Medium, Hard**
- Position evaluation based on piece values and board control
- Intelligent depth-limited search (adjustable by difficulty)
- Responsive AI decision-making

🎨 **User Interface**
- Clean, responsive board design with chess piece SVGs
- Intuitive click-to-move interaction
- Visual highlights for selected pieces and valid moves
- Game status indicators (check, checkmate, turn information)
- Overlay menus for game settings and options
- Mobile-friendly viewport configuration

🔧 **Architecture**
- **No external dependencies** - pure vanilla JavaScript
- **No bundler required** - runs directly in the browser
- **Clean separation of concerns** - UI layer, Rules engine, and AI layer
- **Event-driven updates** - DOM stays in sync with game model
- **Extensible design** - easy to add new features or customize behavior

## Project Structure

```
chess/
├── index.html              # Main HTML file with board markup
├── chess.css               # Styling for board, pieces, and UI elements
├── piece.js                # Piece movement pattern generation
├── Game.js                 # Core game rules engine (castling, check, checkmate)
├── History.js              # Move history management for undo support
├── SimulationGame.js       # Lightweight game copy for AI search
├── ai.js                   # Minimax algorithm with position evaluation
├── Board.js                # UI controller linking game model to DOM
├── CODE_EXPLANATION.md     # Detailed technical documentation
├── chess.css               # Game styling and board layout
├── img/                    # Chess piece images and assets
└── favicon.ico             # Website icon
```

## How to Play

### Getting Started

1. Open `index.html` in your web browser
2. On the start screen, choose your opponent:
   - **Human**: Play against another person on the same board
   - **AI**: Challenge the computer opponent

### Choosing Difficulty (AI Mode)

When playing against AI, select your difficulty level:
- **Dumb** - AI searches 2 moves ahead (easiest)
- **Easy** - AI searches 2 moves ahead with better heuristics
- **Medium** - AI searches 3 moves ahead
- **Hard** - AI searches 4 moves ahead (most challenging)

### Making Moves

1. Click on a piece to select it
2. Valid move squares will be highlighted
3. Click on a highlighted square to move the piece
4. For pawn promotion, a dialog will appear to select your promoted piece
5. The game automatically detects check, checkmate, and stalemate conditions

### Game Rules

All standard chess rules are implemented:
- **Piece Movement** - Each piece moves according to standard chess rules
- **Castling** - Available when conditions are met (king/rook haven't moved, no pieces in between, not in check)
- **En Passant** - Special pawn capture when opponent's pawn moves two squares
- **Pawn Promotion** - Pawns automatically promote to Q/R/B/N when reaching the back rank
- **Check Detection** - Game alerts when the king is in check
- **Checkmate** - Game ends when a player is in check and cannot escape
- **Stalemate** - Draw condition when no legal moves available but not in check

## Technical Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────┐
│           UI Layer (Board.js)               │
│  (DOM manipulation, user interaction)       │
└────────────────┬────────────────────────────┘
                 │
┌────────────────┴────────────────────────────┐
│   Rules Engine (Game.js, piece.js)          │
│  (Move validation, piece logic, rules)      │
└────────────────┬────────────────────────────┘
                 │
┌────────────────┴────────────────────────────┐
│   AI Layer (ai.js, SimulationGame.js)       │
│  (Minimax search, position evaluation)      │
└─────────────────────────────────────────────┘
```

### Coordinate System

The board uses an internal numeric encoding instead of algebraic notation:
- **11** = a1 (bottom-left)
- **15** = e1 (white king's starting position)
- **81** = a8 (top-left)
- **88** = h8 (top-right)

Movement is calculated using directional offsets:
- `+10` = up one rank
- `-10` = down one rank
- `±1` = left/right one file
- `±9, ±11` = diagonal moves

### Data Model

The game state is represented by a simple JavaScript array of piece objects:

```javascript
{
  rank: 'rook',           // piece type
  position: 11,           // current board position
  color: 'white',         // piece color
  name: 'whiteRook1',     // unique identifier
  ableToCastle: true      // castling eligibility
}
```

### Event System

The Game class emits events that Board.js listens to for DOM updates:
- `pieceMove` - triggered when a piece moves
- `kill` - triggered when a piece is captured
- `promotion` - triggered when a pawn promotes
- `check` - triggered when king is in check
- `checkMate` - triggered when checkmate occurs
- `turnChange` - triggered when turn switches

## Script Load Order

Scripts must load in dependency order (no module system):

1. **piece.js** - Base movement patterns
2. **History.js** - Move history tracking
3. **Game.js** - Main rules engine
4. **SimulationGame.js** - AI game simulation
5. **ai.js** - AI decision making
6. **Board.js** - UI controller (initializes game)

## AI Algorithm Details

### Minimax with Alpha-Beta Pruning

The AI uses the minimax algorithm to evaluate positions:
- **Depth-limited search** - varies by difficulty (2-4 plies)
- **Alpha-beta pruning** - eliminates branches that won't affect the result
- **Piece value scoring** - uses standard chess piece values:
  - Pawn: 1 point
  - Knight/Bishop: 3 points
  - Rook: 5 points
  - Queen: 9 points

### Position Evaluation

Beyond material value, the AI considers:
- **Central control** - bonus for pieces in the center squares (d4, d5, e4, e5)
- **Wider center control** - smaller bonus for pieces controlling key squares
- **Board state** - checkmate/stalemate detection at leaf nodes
- **Move ordering** - prioritizes capturing moves and checks

## Browser Compatibility

- **Modern browsers** - Chrome, Firefox, Safari, Edge
- **Mobile browsers** - Responsive design works on tablets and phones
- **No transpilation needed** - Uses standard JavaScript ES6+

## Performance Considerations

- AI response time: 1-3 seconds depending on difficulty level
- Efficient move generation using directional patterns
- Shallow search depth keeps computation manageable
- SimulationGame provides fast game state cloning for AI analysis

## Customization

### Adjusting AI Difficulty

Edit the `depthByLevel` object in `ai.js` to change search depth:

```javascript
const depthByLevel = {
    dumb: 2,    // Shallower = easier
    easy: 2,
    medium: 3,
    hard: 4     // Deeper = harder
};
```

### Modifying Piece Values

Change piece evaluation weights in the `ranks` object:

```javascript
const ranks = { 
    pawn: 1, 
    king: 2, 
    bishop: 3, 
    knight: 3, 
    rook: 5, 
    queen: 9 
};
```

### Styling

All UI styling is in `chess.css`. Customize:
- Board colors and dimensions
- Piece designs and sizes
- Menu styling and layout
- Highlights and overlay effects

## Development & Debugging

### Game State

Access the current game state in the browser console:
```javascript
game.pieces              // Array of all pieces
game.turn                // Current player ('white' or 'black')
game.clickedPiece        // Currently selected piece
game.history             // Move history
```

### Available Methods

```javascript
// Get piece by name
game.getPieceByName('whiteKing')

// Check game status
game.king_dead('black')
game.isCheckmate('white')
game.isStalemate()

// Get possible moves
game.getPossibleMoves(position)

// Make a move
game.move(fromPos, toPos, promotion='queen')
```

## Contributing

Feel free to extend this project:
- Add move history/undo functionality
- Implement chess notation display (algebraic notation)
- Add game analysis features
- Improve AI evaluation function
- Add time controls
- Implement online multiplayer
- Add opening theory database
- Create move animation effects

## Author

Shreeparth Torawane
https://github.com/kaizen2310
## License

This project is free to use and modify for personal and educational purposes.

## Technical Highlights

- **Zero Dependencies** - Pure vanilla JavaScript, no frameworks or libraries
- **Efficient Search** - Minimax with alpha-beta pruning for intelligent AI
- **Clean Code** - Well-organized layers with clear separation of concerns
- **Complete Rules** - Full implementation of standard chess rules
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **No Build Step** - Load directly in browser, perfect for learning

## Future Enhancements

Potential features for future versions:
- Game replay and move analysis
- Opening book integration
- Endgame tablebase support
- Multiplayer online play
- Puzzle mode
- Move timing and statistics
- Dark mode theme
- Move notation (PGN format)
- Elo rating for AI difficulty

---

**Enjoy your game!** ♟️ Play against friends or challenge the AI. May the best strategist win!
