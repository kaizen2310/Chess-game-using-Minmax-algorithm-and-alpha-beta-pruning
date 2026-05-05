class SimulationGame extends Game {

    startNewGame(pieces, turn) {
        super.startNewGame(pieces, turn);
        this._enPassantHistory = [null];
	}

	saveHistory() {}

	addToHistory(move) {}

    triggerEvent(eventName, params) {}

    clearEvents() {}

	undo() {}

    getPieceAllowedMoves(pieceName){
        return super.getPieceAllowedMoves(pieceName);
    }

    movePiece(pieceName, position) {
        return super.movePiece(pieceName, position);
    }

    applyMove(move) {
        const piece = this.getPieceByName(move.pieceName);
        const position = parseInt(move.position);
        const previousEnPassantTarget = this.enPassantTarget ? { ...this.enPassantTarget } : null;
        const previousName = piece.name;
        const previousRank = piece.rank;
        const previousAbleToCastle = piece.ableToCastle;
        const previousTurn = this.turn;
        const prevPosition = piece.position;

        const record = {
            piece,
            prevPosition,
            position,
            previousName,
            previousRank,
            previousAbleToCastle,
            previousTurn,
            previousEnPassantTarget,
            capturedPiece: null,
            capturedPosition: null,
            castling: false,
            rookRecord: null,
            promoted: false
        };

        const capturedPiece = this.getPieceByPos(position) || this._getEnPassantCapture(piece, position);
        if (capturedPiece) {
            record.capturedPiece = capturedPiece;
            record.capturedPosition = capturedPiece.position;
            this._removePiece(capturedPiece);
        }

        const castling = !capturedPiece && piece.rank === 'king' && piece.ableToCastle === true && Math.abs(position - prevPosition) === 2;
        record.castling = castling;

        if (castling) {
            const rookName = position - prevPosition === 2 ? piece.color + 'Rook2' : piece.color + 'Rook1';
            const rook = this.getPieceByName(rookName);
            const rookFrom = rook.position;
            const rookTo = rookName.indexOf('Rook2') !== -1 ? rook.position - 2 : rook.position + 3;
            record.rookRecord = {
                rook,
                rookName,
                rookFrom,
                rookTo,
                rookAbleToCastle: rook.ableToCastle
            };
            changePosition(rook, rookTo);
        }

        changePosition(piece, position, castling);
        this._setEnPassantTarget(piece, prevPosition, position);

        if (piece.rank === 'pawn' && (position > 80 || position < 20)) {
            record.promoted = true;
            this.pieceMap.delete(piece.name);
            piece.name = piece.name.replace('Pawn', 'Queen');
            piece.rank = 'queen';
            this.pieceMap.set(piece.name, piece);
        }

        this.turn = this.turn === 'white' ? 'black' : 'white';
        return record;
    }

    undoMove(record) {
        if (!record) {
            return;
        }

        this.turn = record.previousTurn;
        this.enPassantTarget = record.previousEnPassantTarget ? { ...record.previousEnPassantTarget } : null;

        if (record.promoted) {
            this.pieceMap.delete(record.piece.name);
            record.piece.name = record.previousName;
            record.piece.rank = record.previousRank;
            this.pieceMap.set(record.piece.name, record.piece);
        }

        changePosition(record.piece, record.prevPosition);
        record.piece.ableToCastle = record.previousAbleToCastle;

        if (record.rookRecord) {
            const rook = record.rookRecord.rook;
            changePosition(rook, record.rookRecord.rookFrom);
            rook.ableToCastle = record.rookRecord.rookAbleToCastle;
        }

        if (record.capturedPiece) {
            record.capturedPiece.position = record.capturedPosition;
            this._addPiece(record.capturedPiece);
        }
    }

    king_checked(color) {
        const piece = this.clickedPiece;
        const king = this.getPieceByName(color + 'King');
        if (!king) {
            return true;
        }
        const enemyColor = (color === 'white') ? 'black' : 'white';
        const enemyPieces = this.getPiecesByColor(enemyColor);
        for (const enemyPiece of enemyPieces) {
            this.setClickedPiece(enemyPiece);
            const allowedMoves = this.unblockedPositions(enemyPiece, getAllowedMoves(enemyPiece), false);
            if (allowedMoves.indexOf(king.position) !== -1) {
                this.setClickedPiece(piece);
                return 1;
            }
        }
        this.setClickedPiece(piece);
        return 0;
    }

    checkmate(color){}
}