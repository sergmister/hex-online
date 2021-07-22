import { Socket } from "socket.io";

import { CellState, HexBoard, HexPlayerColor, HexState, switchPlayer } from "src/hex/HexBoard";

export class HexPlayer {
  socket: Socket;
  color: HexPlayerColor;

  constructor(socket: Socket, color: HexPlayerColor) {
    this.socket = socket;
    this.color = color;
  }
}

export interface HexMoveInfo {
  player: HexPlayerColor;
  pos: number;
}

export interface HexGameOptions {
  width: number;
  height: number;
  reverse: boolean;
  swapRule: boolean;
}

export class HexGame {
  players: (HexPlayer | null)[] = Array(2).fill(null);

  board: HexBoard;
  currentState: HexState;
  currentPlayer: HexPlayerColor;

  history: { pos: number; color: HexPlayerColor; swap?: true }[] = [];
  win?: HexPlayerColor;
  started = false;
  quited = false;

  options: HexGameOptions;

  constructor({ width, height, reverse, swapRule }: HexGameOptions) {
    this.options = { width, height, reverse, swapRule };

    this.board = new HexBoard(width, height);
    this.currentState = new HexState(this.board.size);
    this.currentPlayer = HexPlayerColor.Black;
  }

  start() {
    this.started = true;
    for (const player of this.players) {
      if (player) {
        player.socket.emit("started");
      }
    }
  }

  quit() {
    this.quited = true;
    for (const [i, player] of this.players.entries()) {
      if (player !== null) {
        player.socket.disconnect();
        this.players[i] = null;
      }
    }
  }

  join(socket: Socket, { auth, color }: { auth?: string; color?: HexPlayerColor }): HexPlayer | null {
    if (color) {
      if (this.players[color] === null) {
        this.players[color] = new HexPlayer(socket, color);
        return this.players[color];
      }
    } else {
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i] === null) {
          this.players[i] = new HexPlayer(socket, i);
          return this.players[i];
        }
      }
    }
    return null;
  }

  move(color: HexPlayerColor, pos: number): boolean {
    if (this.started && !this.quited && this.win === undefined) {
      if (color === this.currentPlayer) {
        if (pos >= 0 && pos < this.board.size) {
          if (this.currentState.board[pos] === CellState.Empty) {
            this.history.push({ pos, color: this.currentPlayer });
            const gameOver = this.board.move(this.currentState, color, pos);
            this.players[switchPlayer(color)]!.socket.emit("move", { player: color, pos } as HexMoveInfo);
            if (gameOver) {
              if (this.options.reverse) {
                this.win = switchPlayer(this.currentPlayer);
              } else {
                this.win = this.currentPlayer;
              }
            }
            this.currentPlayer = switchPlayer(this.currentPlayer);
            return true;
          }
        }
      }
    }
    return false;
  }

  swap(): boolean {
    if (this.started && !this.quited && this.win === undefined) {
      if (this.options.swapRule && this.history.length === 1) {
        const firstMove = this.history[0];
        const pos = firstMove.pos;
        this.currentState.board[pos] = CellState.Empty;
        const [x, y] = this.board.getXY(pos);
        const swapPos = this.board.getIndex(y, x);
        this.players[switchPlayer(this.currentPlayer)]!.socket.emit("swap");
        this.history.push({ pos: swapPos, color: this.currentPlayer, swap: true });
        this.board.move(this.currentState, this.currentPlayer, swapPos);
        this.currentPlayer = switchPlayer(this.currentPlayer);
        return true;
      }
    }
    return false;
  }
}
