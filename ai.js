var ai = (aiTurn, aiLevel = 'dumb') => {
	const simulationGame = new SimulationGame([], 'white');
	const humanTurn = aiTurn === 'white' ? 'black' : 'white';

	const depthByLevel = {
		dumb: 2,
		easy: 4,
		medium: 6,
		hard: 8
	};

	const timeBudgetByLevel = {
		dumb: 120,
		easy: 350,
		medium: 1200,
		hard: 3500
	};

	const deepest = depthByLevel[aiLevel] || depthByLevel.medium;
	const timeBudget = timeBudgetByLevel[aiLevel] || timeBudgetByLevel.medium;

	const pieceValues = {
		pawn: 100,
		knight: 320,
		bishop: 330,
		rook: 500,
		queen: 900,
		king: 0
	};

	const pawnTable = [
		0, 0, 0, 0, 0, 0, 0, 0,
		50, 50, 50, 50, 50, 50, 50, 50,
		10, 10, 20, 30, 30, 20, 10, 10,
		5, 5, 10, 25, 25, 10, 5, 5,
		0, 0, 0, 20, 20, 0, 0, 0,
		5, -5, -10, 0, 0, -10, -5, 5,
		5, 10, 10, -20, -20, 10, 10, 5,
		0, 0, 0, 0, 0, 0, 0, 0
	];

	const knightTable = [
		-50, -40, -30, -30, -30, -30, -40, -50,
		-40, -20, 0, 0, 0, 0, -20, -40,
		-30, 0, 10, 15, 15, 10, 0, -30,
		-30, 5, 15, 20, 20, 15, 5, -30,
		-30, 0, 15, 20, 20, 15, 0, -30,
		-30, 5, 10, 15, 15, 10, 5, -30,
		-40, -20, 0, 5, 5, 0, -20, -40,
		-50, -40, -30, -30, -30, -30, -40, -50
	];

	const bishopTable = [
		-20, -10, -10, -10, -10, -10, -10, -20,
		-10, 0, 0, 0, 0, 0, 0, -10,
		-10, 0, 5, 10, 10, 5, 0, -10,
		-10, 5, 5, 10, 10, 5, 5, -10,
		-10, 0, 10, 10, 10, 10, 0, -10,
		-10, 10, 10, 10, 10, 10, 10, -10,
		-10, 5, 0, 0, 0, 0, 5, -10,
		-20, -10, -10, -10, -10, -10, -10, -20
	];

	const rookTable = [
		0, 0, 0, 5, 5, 0, 0, 0,
		-5, 0, 0, 0, 0, 0, 0, -5,
		-5, 0, 0, 0, 0, 0, 0, -5,
		-5, 0, 0, 0, 0, 0, 0, -5,
		-5, 0, 0, 0, 0, 0, 0, -5,
		-5, 0, 0, 0, 0, 0, 0, -5,
		5, 10, 10, 10, 10, 10, 10, 5,
		0, 0, 0, 0, 0, 0, 0, 0
	];

	const queenTable = [
		-20, -10, -10, -5, -5, -10, -10, -20,
		-10, 0, 0, 0, 0, 5, 0, -10,
		-10, 0, 5, 5, 5, 5, 5, -10,
		-5, 0, 5, 5, 5, 5, 0, -5,
		0, 0, 5, 5, 5, 5, 0, -5,
		-10, 5, 5, 5, 5, 5, 0, -10,
		-10, 0, 5, 0, 0, 0, 0, -10,
		-20, -10, -10, -5, -5, -10, -10, -20
	];

	const kingTable = [
		-30, -40, -40, -50, -50, -40, -40, -30,
		-30, -40, -40, -50, -50, -40, -40, -30,
		-30, -40, -40, -50, -50, -40, -40, -30,
		-30, -40, -40, -50, -50, -40, -40, -30,
		-20, -30, -30, -40, -40, -30, -30, -20,
		-10, -20, -20, -20, -20, -20, -20, -10,
		20, 20, 0, 0, 0, 0, 20, 20,
		20, 30, 10, 0, 0, 10, 30, 20
	];

	const tables = {
		pawn: pawnTable,
		knight: knightTable,
		bishop: bishopTable,
		rook: rookTable,
		queen: queenTable,
		king: kingTable
	};

	const isTestEnv = () => {
		const url = new URL(location.href);
		const params = new URLSearchParams(url.searchParams);
		return Boolean(params.get('testing'));
	};

	const boardIndex = position => {
		const row = Math.floor(position / 10) - 1;
		const column = (position % 10) - 1;
		return row * 8 + column;
	};

	const mirrorIndex = (index, color) => {
		const row = Math.floor(index / 8);
		const column = index % 8;
		const mirroredRow = color === 'white' ? row : 7 - row;
		return mirroredRow * 8 + column;
	};

	const pieceSquareScore = piece => {
		const table = tables[piece.rank];
		if (!table) {
			return 0;
		}

		const index = boardIndex(piece.position);
		if (index < 0 || index > 63) {
			return 0;
		}

		return table[mirrorIndex(index, piece.color)] || 0;
	};

	const attackedSquares = piece => {
		if (piece.rank === 'pawn') {
			return getAllowedMoves(piece)[0] || [];
		}

		return simulationGame.unblockedPositions(piece, getAllowedMoves(piece), false);
	};

	const squareAttackedByColor = (game, square, color) => {
		const previousClickedPiece = game.clickedPiece;
		for (const piece of game.getPiecesByColor(color)) {
			game.setClickedPiece(piece);
			if (attackedSquares(piece).indexOf(square) !== -1) {
				game.setClickedPiece(previousClickedPiece);
				return true;
			}
			if (piece.rank !== 'pawn') {
				const legalAttacks = game.unblockedPositions(piece, getAllowedMoves(piece), false);
				if (legalAttacks.indexOf(square) !== -1) {
					game.setClickedPiece(previousClickedPiece);
					return true;
				}
			}
		}
		game.setClickedPiece(previousClickedPiece);
		return false;
	};

	const isHanging = (game, piece) => {
		const enemyColor = piece.color === 'white' ? 'black' : 'white';
		const attacked = squareAttackedByColor(game, piece.position, enemyColor);
		if (!attacked) {
			return false;
		}

		return !squareAttackedByColor(game, piece.position, piece.color);
	};

	const kingSafetyScore = game => {
		let score = 0;
		for (const color of ['white', 'black']) {
			const king = game.getPieceByName(color + 'King');
			if (!king) continue;

			const direction = color === 'white' ? 1 : -1;
			const shieldSquares = [king.position + direction * 9, king.position + direction * 10, king.position + direction * 11];
			for (const square of shieldSquares) {
				const piece = game.getPieceByPos(square);
				if (!piece || piece.color !== color || piece.rank !== 'pawn') {
					score += color === aiTurn ? -12 : 12;
				}
			}

			if (game.king_checked(color)) {
				score += color === aiTurn ? -60 : 60;
			}
		}
		return score;
	};

	const mobilityScore = game => {
		let score = 0;
		for (const piece of game.pieces) {
			const previousClickedPiece = game.clickedPiece;
			game.setClickedPiece(piece);
			const legalMoves = game.unblockedPositions(piece, getAllowedMoves(piece), false);
			game.setClickedPiece(previousClickedPiece);
			const sideScore = legalMoves.length * 2;
			score += piece.color === aiTurn ? sideScore : -sideScore;
		}
		return score;
	};

	const evaluateBoard = game => {
		if (!game.getPieceByName(aiTurn + 'King')) {
			return -Infinity;
		}
		if (!game.getPieceByName(humanTurn + 'King')) {
			return Infinity;
		}

		let score = 0;
		for (const piece of game.pieces) {
			const material = pieceValues[piece.rank] || 0;
			const positional = pieceSquareScore(piece) * 0.25;
			const hangingPenalty = isHanging(game, piece) ? material * 0.35 : 0;
			const pieceScore = material + positional - hangingPenalty;
			score += piece.color === aiTurn ? pieceScore : -pieceScore;
		}

		score += mobilityScore(game);
		score += kingSafetyScore(game);

		if (game.king_checked(humanTurn)) {
			score += 40;
		}
		if (game.king_checked(aiTurn)) {
			score -= 40;
		}

		return score;
	};

	const terminalScore = (game, turn) => {
		if (!game.getPieceByName(aiTurn + 'King')) {
			return -Infinity;
		}
		if (!game.getPieceByName(humanTurn + 'King')) {
			return Infinity;
		}

		if (game.king_dead(turn)) {
			return game.king_checked(turn)
				? (turn === aiTurn ? -Infinity : Infinity)
				: 0;
		}

		return null;
	};

	const moveHeuristic = (game, move, turn) => {
		const piece = game.getPieceByName(move.pieceName);
		let score = pieceSquareScore({ ...piece, position: move.position }) - pieceSquareScore(piece);

		const captureTarget = game.getPieceByPos(move.position) || game._getEnPassantCapture(piece, move.position);
		if (captureTarget) {
			score += 10 * (pieceValues[captureTarget.rank] || 0) - (pieceValues[piece.rank] || 0);
		}

		if (piece.rank === 'pawn' && (move.position > 80 || move.position < 20)) {
			score += 120;
		}
		if (piece.rank === 'king' && Math.abs(move.position - piece.position) === 2) {
			score += 35;
		}

		const record = game.applyMove(move);
		const givesCheck = game.king_checked(game.turn);
		game.undoMove(record);
		if (givesCheck) {
			score += 75;
		}

		return turn === aiTurn ? score : -score;
	};

	const orderedMoves = (game, turn) => {
		const moves = [];
		for (const piece of game.getPiecesByColor(turn)) {
			const allowedMoves = game.getPieceAllowedMoves(piece.name);
			for (const position of allowedMoves) {
				moves.push({
					pieceName: piece.name,
					position,
					score: moveHeuristic(game, { pieceName: piece.name, position }, turn)
				});
			}
		}

		return moves.sort((a, b) => b.score - a.score);
	};

	const quiescence = (game, turn, alpha, beta, depth) => {
		const standPat = evaluateBoard(game);
		if (depth <= 0) {
			return standPat;
		}

		if (turn === aiTurn) {
			if (standPat >= beta) {
				return beta;
			}
			alpha = Math.max(alpha, standPat);
		}
		else {
			if (standPat <= alpha) {
				return alpha;
			}
			beta = Math.min(beta, standPat);
		}

		const moves = orderedMoves(game, turn).filter(move => {
			const piece = game.getPieceByName(move.pieceName);
			return Boolean(game.getPieceByPos(move.position) || game._getEnPassantCapture(piece, move.position));
		});

		let bestScore = standPat;
		for (const move of moves) {
			const record = game.applyMove(move);
			const score = quiescence(game, game.turn, alpha, beta, depth - 1);
			game.undoMove(record);

			if (turn === aiTurn) {
				bestScore = Math.max(bestScore, score);
				alpha = Math.max(alpha, bestScore);
			}
			else {
				bestScore = Math.min(bestScore, score);
				beta = Math.min(beta, bestScore);
			}

			if (beta <= alpha) {
				break;
			}
		}

		return bestScore;
	};

	const boardKey = (game, turn, depth) => {
		const piecesKey = game.pieces
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(piece => `${piece.name}:${piece.position}:${piece.color}:${piece.rank}:${piece.ableToCastle ? 1 : 0}`)
			.join('|');

		const enPassantKey = game.enPassantTarget
			? `${game.enPassantTarget.square}:${game.enPassantTarget.pawnPosition}:${game.enPassantTarget.color}`
			: 'none';

		return `${turn}:${depth}:${enPassantKey}:${piecesKey}`;
	};

	const transpositionTable = new Map();

	const search = (game, turn, depth, alpha, beta) => {
		const terminal = terminalScore(game, turn);
		if (terminal !== null) {
			return { move: null, score: terminal };
		}

		const key = boardKey(game, turn, depth);
		const cached = transpositionTable.get(key);
		if (cached && cached.depth >= depth) {
			return cached.result;
		}

		if (depth <= 0) {
			return { move: null, score: quiescence(game, turn, alpha, beta, 4) };
		}

		const moves = orderedMoves(game, turn);
		if (!moves.length) {
			return { move: null, score: game.king_checked(turn) ? (turn === aiTurn ? -Infinity : Infinity) : 0 };
		}

		const maximizing = turn === aiTurn;
		let bestMove = null;
		let bestScore = maximizing ? -Infinity : Infinity;

		for (const move of moves) {
			const record = game.applyMove(move);
			const result = search(game, game.turn, depth - 1, alpha, beta);
			game.undoMove(record);

			if (maximizing) {
				if (result.score > bestScore) {
					bestScore = result.score;
					bestMove = move;
				}
				alpha = Math.max(alpha, bestScore);
			}
			else {
				if (result.score < bestScore) {
					bestScore = result.score;
					bestMove = move;
				}
				beta = Math.min(beta, bestScore);
			}

			if (beta <= alpha) {
				break;
			}
		}

		const result = { move: bestMove, score: bestScore };
		transpositionTable.set(key, { depth, result });
		return result;
	};

	const iterativeDeepening = (pieces, callback) => {
		simulationGame.startNewGame(pieces, aiTurn);
		let bestResult = { move: null, score: -Infinity };
		const startedAt = Date.now();

		for (let depth = 1; depth <= deepest; depth++) {
			const result = search(simulationGame, aiTurn, depth, -Infinity, Infinity);
			if (result.move) {
				bestResult = result;
			}

			if (Date.now() - startedAt > timeBudget) {
				break;
			}
		}

		callback(bestResult);
	};

	const play = (pieces, callback) => {
		setTimeout(() => {
			if (isTestEnv()) {
				testFuncTime(() => iterativeDeepening(pieces, callback));
			}
			else {
				iterativeDeepening(pieces, callback);
			}
		}, 50);
	};

	return { play };
};

const isTestEnv = function() {
	const url = new URL(location.href);
	const params = new URLSearchParams(url.searchParams);
	return Boolean(params.get('testing'));
};

const testFuncTime = func => {
	const label = 'Timer ' + Date.now();
	console.time(label);
	const output = func();
	console.log('Output:', output);
	console.timeLog(label);
	return output;
};

window.ai = ai;