class Game {
	constructor(pieces, turn) {
		this.startNewGame(pieces, turn);
	}

	startNewGame(pieces, turn) {
		this._setPieces(pieces);
		this.turn = turn;
		this.clickedPiece = null;
		this.enPassantTarget = null;
		this._enPassantHistory = [null];
		this.halfMoveClock = 0;
		this._halfMoveHistory = [0];
		this.positionCounts = new Map();
		const openingPositionKey = this._positionKey();
		this.positionCounts.set(openingPositionKey, 1);
		this._positionHistory = [openingPositionKey];

		this._events = {
			pieceMove: [],
			kill: [],
			check: [],
			draw: [],
			promotion: [],
			checkMate: [],
			turnChange: []
		};
		this.history = new History();
	}

	_setPieces(pieces) {
		this.pieces = Array(pieces.length);
		pieces.forEach((piece, index) => {
			this.pieces[index] = {
				rank: piece.rank,
				position: piece.position,
				color: piece.color,
				name: piece.name,
				ableToCastle: piece.ableToCastle
			};
		});

		this.pieceMap = new Map(this.pieces.map(piece => [piece.name, piece]));
		this.playerPieces = {
			white: this.pieces.filter(piece => piece.color === 'white'),
			black: this.pieces.filter(piece => piece.color === 'black')
		};
	}

	_removePiece(piece) {
		this.pieces.splice(this.pieces.indexOf(piece), 1);
		this.playerPieces[piece.color].splice(this.playerPieces[piece.color].indexOf(piece), 1);
		this.pieceMap.delete(piece.name);
	}

	_addPiece(piece) {
		this.pieces.push(piece);
		this.playerPieces[piece.color].push(piece);
		this.pieceMap.set(piece.name, piece);
	}

	saveHistory() {
		this.history.save();
		this._enPassantHistory.push(this.enPassantTarget ? { ...this.enPassantTarget } : null);
		this._halfMoveHistory.push(this.halfMoveClock);

		const key = this._positionKey();
		this._positionHistory.push(key);
		this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
	}

	addToHistory(move) {
		this.history.add(move);
	}

	clearEvents() {
		this._events = {};
	}

	undo() {
		const step = this.history.pop();
		if (!step) {
			return false;
		}

		for (const subStep of step) {
			changePosition(subStep.piece, subStep.from);
			if (subStep.from !== 0) {
				if (subStep.to === 0) {
					this._addPiece(subStep.piece);
				}
				else if (subStep.castling) {
					subStep.piece.ableToCastle = true;
				}
				this.triggerEvent('pieceMove', subStep);
			}
			else {
				this._removePiece(subStep.piece);
				this.triggerEvent('kill', subStep.piece);
			}

			if (subStep.from !== 0 && subStep.to !== 0 && (!subStep.castling || subStep.piece.rank === 'king')) {
				this.softChangeTurn();
			}
		}

		this._enPassantHistory.pop();
		this.enPassantTarget = this._enPassantHistory[this._enPassantHistory.length - 1]
			? { ...this._enPassantHistory[this._enPassantHistory.length - 1] }
			: null;

		this._halfMoveHistory.pop();
		this.halfMoveClock = this._halfMoveHistory[this._halfMoveHistory.length - 1] || 0;

		if (this._positionHistory.length > 1) {
			const removedKey = this._positionHistory.pop();
			const count = this.positionCounts.get(removedKey) || 0;
			if (count <= 1) {
				this.positionCounts.delete(removedKey);
			}
			else {
				this.positionCounts.set(removedKey, count - 1);
			}
		}

		return true;
	}

	_positionKey() {
		const piecesKey = this.pieces
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(piece => `${piece.name}:${piece.position}:${piece.color}:${piece.rank}:${piece.ableToCastle ? 1 : 0}`)
			.join('|');

		const enPassantKey = this.enPassantTarget
			? `${this.enPassantTarget.square}:${this.enPassantTarget.pawnPosition}:${this.enPassantTarget.color}`
			: 'none';

		return `${this.turn}:${enPassantKey}:${piecesKey}`;
	}

	_hasInsufficientMaterial() {
		const pieces = this.pieces;
		const nonKingPieces = pieces.filter(piece => piece.rank !== 'king');

		if (nonKingPieces.length === 0) {
			return true;
		}

		if (nonKingPieces.length === 1) {
			const lonePiece = nonKingPieces[0];
			return lonePiece.rank === 'bishop' || lonePiece.rank === 'knight';
		}

		if (nonKingPieces.length === 2) {
			const whiteNonKing = nonKingPieces.filter(piece => piece.color === 'white');
			const blackNonKing = nonKingPieces.filter(piece => piece.color === 'black');

			if (whiteNonKing.length === 1 && blackNonKing.length === 1) {
				const whitePiece = whiteNonKing[0];
				const blackPiece = blackNonKing[0];
				if (whitePiece.rank === 'bishop' && blackPiece.rank === 'bishop') {
					const whiteSquareColor = (Math.floor(whitePiece.position / 10) + (whitePiece.position % 10)) % 2;
					const blackSquareColor = (Math.floor(blackPiece.position / 10) + (blackPiece.position % 10)) % 2;
					return whiteSquareColor === blackSquareColor;
				}
				if ((whitePiece.rank === 'bishop' || whitePiece.rank === 'knight') && (blackPiece.rank === 'bishop' || blackPiece.rank === 'knight')) {
					return true;
				}
			}
		}

		return false;
	}

	_drawReason() {
		if (this.halfMoveClock >= 100) {
			return 'fifty-move';
		}

		const repetitionCount = this.positionCounts.get(this._positionKey()) || 0;
		if (repetitionCount >= 3) {
			return 'threefold-repetition';
		}

		if (this._hasInsufficientMaterial()) {
			return 'insufficient-material';
		}

		return null;
	}

	_triggerDraw(reason) {
		this.triggerEvent('draw', { reason, color: this.turn });
		this.clearEvents();
	}

	on(eventName, callback) {
		if (this._events[eventName] && typeof callback === 'function') {
			this._events[eventName].push(callback);
		}
	}

	softChangeTurn() {
		this.turn = this.turn === 'white' ? 'black' : 'white';
		this.triggerEvent('turnChange', this.turn);
	}

	changeTurn() {
		this.softChangeTurn();
		this.saveHistory();
	}

	getPiecesByColor(color) {
		return this.playerPieces[color];
	}

	getPlayerPositions(color) {
		return this.getPiecesByColor(color).map(piece => piece.position);
	}

	filterPositions(positions) {
		return positions.filter(pos => {
			const file = pos % 10;
			return pos > 10 && pos < 89 && file !== 9 && file !== 0;
		});
	}

	unblockedPositions(piece, allowedPositions, checking = true) {
		const unblockedPositions = [];
		const myColor = piece.color;
		const otherColor = piece.color === 'white' ? 'black' : 'white';

		const myBlockedPositions = this.getPlayerPositions(myColor);
		const otherBlockedPositions = this.getPlayerPositions(otherColor);

		if (piece.rank === 'pawn') {
			for (const move of allowedPositions[0]) {
				if (checking && this.myKingChecked(move)) continue;
				if (otherBlockedPositions.indexOf(move) !== -1) unblockedPositions.push(move);
			}

			for (const move of allowedPositions[1]) {
				if (myBlockedPositions.indexOf(move) !== -1 || otherBlockedPositions.indexOf(move) !== -1) {
					break;
				}
				else if (checking && this.myKingChecked(move, false)) {
					continue;
				}
				unblockedPositions.push(move);
			}
		}
		else {
			allowedPositions.forEach(allowedPositionsGroup => {
				for (const move of allowedPositionsGroup) {
					if (myBlockedPositions.indexOf(move) !== -1) {
						break;
					}
					else if (checking && this.myKingChecked(move)) {
						if (otherBlockedPositions.indexOf(move) !== -1) {
							break;
						}
						continue;
					}
					unblockedPositions.push(move);

					if (otherBlockedPositions.indexOf(move) !== -1) {
						break;
					}
				}
			});
		}

		return this.filterPositions(unblockedPositions);
	}

	getPieceAllowedMoves(pieceName) {
		const piece = this.getPieceByName(pieceName);
		if (!piece || this.turn !== piece.color) {
			return [];
		}

		this.setClickedPiece(piece);

		let pieceAllowedMoves = getAllowedMoves(piece);
		if (piece.rank === 'king') {
			pieceAllowedMoves = this.getCastlingSquares(piece, pieceAllowedMoves);
		}

		const legalMoves = this.unblockedPositions(piece, pieceAllowedMoves, true);
		return this._addEnPassantMoves(piece, pieceAllowedMoves, legalMoves);
	}

	_addEnPassantMoves(piece, allowedPositions, legalMoves) {
		if (!this.enPassantTarget || piece.rank !== 'pawn' || piece.color === this.enPassantTarget.color) {
			return legalMoves;
		}

		const attackSquares = allowedPositions[0] || [];
		if (attackSquares.indexOf(this.enPassantTarget.square) === -1) {
			return legalMoves;
		}

		if (legalMoves.indexOf(this.enPassantTarget.square) !== -1) {
			return legalMoves;
		}

		if (this.getPieceByPos(this.enPassantTarget.square)) {
			return legalMoves;
		}

		const capturedPawn = this.getPieceByPos(this.enPassantTarget.pawnPosition);
		if (!capturedPawn || capturedPawn.color === piece.color) {
			return legalMoves;
		}

		const originalClickedPiece = this.clickedPiece;
		this.clickedPiece = piece;
		const kingSafe = !this.myKingChecked(this.enPassantTarget.square, true);
		this.clickedPiece = originalClickedPiece;

		if (kingSafe) {
			legalMoves.push(this.enPassantTarget.square);
		}

		return legalMoves;
	}

	_setEnPassantTarget(piece, prevPosition, position) {
		if (piece.rank === 'pawn' && Math.abs(position - prevPosition) === 20) {
			this.enPassantTarget = {
				square: (prevPosition + position) / 2,
				pawnPosition: position,
				color: piece.color
			};
		}
		else {
			this.enPassantTarget = null;
		}
	}

	_getEnPassantCapture(piece, position) {
		if (!this.enPassantTarget || piece.rank !== 'pawn' || piece.color === this.enPassantTarget.color) {
			return null;
		}

		if (position !== this.enPassantTarget.square) {
			return null;
		}

		const capturedPawn = this.getPieceByPos(this.enPassantTarget.pawnPosition);
		if (!capturedPawn || capturedPawn.color === piece.color) {
			return null;
		}

		return capturedPawn;
	}

	getCastlingSquares(king, allowedMoves) {
		if (!king.ableToCastle || this.king_checked(this.turn)) return allowedMoves;

		const rook1 = this.getPieceByName(this.turn + 'Rook1');
		const rook2 = this.getPieceByName(this.turn + 'Rook2');

		if (rook1 && rook1.ableToCastle) {
			const castlingPosition = rook1.position + 2;
			if (
				!this.positionHasExistingPiece(castlingPosition - 1) &&
				!this.positionHasExistingPiece(castlingPosition) && !this.myKingChecked(castlingPosition, true) &&
				!this.positionHasExistingPiece(castlingPosition + 1) && !this.myKingChecked(castlingPosition + 1, true)
			) {
				allowedMoves[1].push(castlingPosition);
			}
		}

		if (rook2 && rook2.ableToCastle) {
			const castlingPosition = rook2.position - 1;
			if (
				!this.positionHasExistingPiece(castlingPosition - 1) && !this.myKingChecked(castlingPosition - 1, true) &&
				!this.positionHasExistingPiece(castlingPosition) && !this.myKingChecked(castlingPosition, true)
			) {
				allowedMoves[0].push(castlingPosition);
			}
		}

		return allowedMoves;
	}

	getPieceByName(piecename) {
		return this.pieceMap.get(piecename);
	}

	getPieceByPos(position) {
		for (const piece of this.pieces) {
			if (piece.position == position) {
				return piece;
			}
		}
	}

	positionHasExistingPiece(position) {
		return this.getPieceByPos(position) !== undefined;
	}

	setClickedPiece(piece) {
		this.clickedPiece = piece;
	}

	triggerEvent(eventName, params) {
		if (this._events[eventName]) {
			for (const cb of this._events[eventName]) {
				cb(params);
			}
		}
	}

	movePiece(pieceName, position) {
		const piece = this.getPieceByName(pieceName);
		position = parseInt(position);

		if (piece && this.getPieceAllowedMoves(piece.name).indexOf(position) !== -1) {
			const prevPosition = piece.position;
			const existedPiece = this.getPieceByPos(position) || this._getEnPassantCapture(piece, position);
			const isCapture = Boolean(existedPiece);

			if (existedPiece) {
				this.kill(existedPiece);
			}

			const castling = !existedPiece && piece.rank === 'king' && piece.ableToCastle === true;

			if (castling) {
				if (position - prevPosition === 2) {
					this.castleRook(piece.color + 'Rook2');
				}
				else if (position - prevPosition === -2) {
					this.castleRook(piece.color + 'Rook1');
				}
				changePosition(piece, position, true);
			}
			else {
				changePosition(piece, position);
			}

			this._setEnPassantTarget(piece, prevPosition, position);

			const move = { from: prevPosition, to: position, piece: piece, castling };
			this.addToHistory(move);
			this.triggerEvent('pieceMove', move);

			if (piece.rank === 'pawn' && (position > 80 || position < 20)) {
				this.promote(piece);
			}

			this.halfMoveClock = (piece.rank === 'pawn' || isCapture) ? 0 : this.halfMoveClock + 1;

			this.changeTurn();

			if (this.king_checked(this.turn)) {
				this.triggerEvent('check', this.turn);

				if (this.king_dead(this.turn)) {
					this.checkmate(piece.color);
				}
			}
			else if (this.king_dead(this.turn)) {
				this._triggerDraw('stalemate');
			}
			else {
				const reason = this._drawReason();
				if (reason) {
					this._triggerDraw(reason);
				}
			}

			return true;
		}

		return false;
	}

	kill(piece) {
		this._removePiece(piece);
		this.addToHistory({ from: piece.position, to: 0, piece: piece });
		this.triggerEvent('kill', piece);
	}

	castleRook(rookName) {
		const rook = this.getPieceByName(rookName);
		const prevPosition = rook.position;
		const newPosition = rookName.indexOf('Rook2') !== -1 ? rook.position - 2 : rook.position + 3;

		changePosition(rook, newPosition);
		const move = { from: prevPosition, to: newPosition, piece: rook, castling: true };
		this.triggerEvent('pieceMove', move);
		this.addToHistory(move);
	}

	promote(pawn) {
		this.pieceMap.delete(pawn.name);
		pawn.name = pawn.name.replace('Pawn', 'Queen');
		pawn.rank = 'queen';
		this.pieceMap.set(pawn.name, pawn);
		this.addToHistory({ from: 0, to: pawn.position, piece: pawn });
		this.triggerEvent('promotion', pawn);
	}

	myKingChecked(pos, kill = true) {
		const piece = this.clickedPiece;
		const originalPosition = piece.position;
		const otherPiece = this.getPieceByPos(pos);
		const shouldKillOtherPiece = kill && otherPiece && otherPiece.rank !== 'king';

		changePosition(piece, pos);
		if (shouldKillOtherPiece) {
			this._removePiece(otherPiece);
		}

		if (this.king_checked(piece.color)) {
			changePosition(piece, originalPosition);
			if (shouldKillOtherPiece) {
				this._addPiece(otherPiece);
			}
			return 1;
		}

		changePosition(piece, originalPosition);
		if (shouldKillOtherPiece) {
			this._addPiece(otherPiece);
		}
		return 0;
	}

	king_dead(color) {
		const pieces = this.getPiecesByColor(color);
		for (const piece of pieces) {
			this.setClickedPiece(piece);
			const allowedMoves = this.unblockedPositions(piece, getAllowedMoves(piece), true);
			if (allowedMoves.length) {
				this.setClickedPiece(null);
				return 0;
			}
		}
		this.setClickedPiece(null);
		return 1;
	}

	king_checked(color) {
		const previousClickedPiece = this.clickedPiece;
		const king = this.getPieceByName(color + 'King');
		if (!king) {
			return true;
		}

		const enemyColor = color === 'white' ? 'black' : 'white';
		const enemyPieces = this.getPiecesByColor(enemyColor);
		for (const enemyPiece of enemyPieces) {
			this.setClickedPiece(enemyPiece);
			const allowedMoves = this.unblockedPositions(enemyPiece, getAllowedMoves(enemyPiece), false);
			if (allowedMoves.indexOf(king.position) !== -1) {
				this.setClickedPiece(previousClickedPiece);
				return 1;
			}
		}

		this.setClickedPiece(previousClickedPiece);
		return 0;
	}

	checkmate(color) {
		this.triggerEvent('checkMate', color);
		this.clearEvents();
	}
}