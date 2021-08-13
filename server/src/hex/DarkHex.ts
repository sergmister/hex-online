import { Socket } from "socket.io";

import { CellState, HexBoard, HexPlayerColor, reduceCellState, switchPlayer } from "src/hex/HexBoard";
import { HexGameOptions, HexPlayer } from "src/hex/Hex";

export class DarkHexGame {
  players: (HexPlayer | null)[] = Array(2).fill(null);

  hexBoard: HexBoard;
  currentState: Uint8Array;
  currentPlayer: HexPlayerColor;

  history: { pos: number; color: HexPlayerColor }[] = [];
  win?: HexPlayerColor;
  started = false;
  quited = false;

  options: HexGameOptions;

  constructor({ width, height, reverse, swapRule }: HexGameOptions) {
    this.options = { width, height, reverse, swapRule };

    this.hexBoard = new HexBoard(width, height);
    this.currentState = new Uint8Array(this.hexBoard.size).fill(CellState.Empty);
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
        if (pos >= 0 && pos < this.hexBoard.size) {
          if (this.currentState[pos] === CellState.Empty) {
            this.history.push({ pos, color: this.currentPlayer });
            const gameOver = this.hexBoard.move(this.currentState, color, pos);
            this.players[color]!.socket.emit("move", {
              state: reduceCellState(this.currentState[pos]),
              pos,
              switchColor: true,
            });
            this.players[switchPlayer(color)]!.socket.emit("move", {
              state: reduceCellState(this.currentState[pos]),
              switchColor: true,
            });
            if (gameOver) {
              if (this.options.reverse) {
                this.win = switchPlayer(this.currentPlayer);
              } else {
                this.win = this.currentPlayer;
              }
              this.players[color]!.socket.emit("win", { win: this.win, board: this.currentState });
              this.players[switchPlayer(color)]!.socket.emit("win", { win: this.win, board: this.currentState });
            }
            this.currentPlayer = switchPlayer(this.currentPlayer);
            return true;
          } else {
            this.players[color]!.socket.emit("move", {
              state: reduceCellState(this.currentState[pos]),
              pos,
              switchColor: false,
            });
            return true;
          }
        }
      }
    }
    return false;
  }
}
