import type { DarkHexAI, DarkReverseHexAI, HexAI, ReverseHexAI } from "src/hex/ai/BaseAI";
import { CellState, HexBoard, HexPlayerColor, HexState } from "src/hex/HexBoard";

export class RandomAI implements HexAI, DarkHexAI, ReverseHexAI, DarkReverseHexAI {
  hexBoard: HexBoard;

  constructor(hexBoard: HexBoard) {
    this.hexBoard = hexBoard;
  }

  getHexMove(state: HexState, player: HexPlayerColor) {
    const emptyCells = [];
    for (let i = 0; i < this.hexBoard.size; i++) {
      if (state.board[i] === CellState.Empty) {
        emptyCells.push(i);
      }
    }
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  getDarkHexMove(visibleBoard: Uint8Array, player: HexPlayerColor) {
    const emptyCells = [];
    for (let i = 0; i < this.hexBoard.size; i++) {
      if (visibleBoard[i] === CellState.Empty) {
        emptyCells.push(i);
      }
    }
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  getReverseHexMove(state: HexState, player: HexPlayerColor) {
    const emptyCells = [];
    for (let i = 0; i < this.hexBoard.size; i++) {
      if (state.board[i] === CellState.Empty) {
        emptyCells.push(i);
      }
    }
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  getDarkReverseHexMove(visibleBoard: Uint8Array, player: HexPlayerColor) {
    const emptyCells = [];
    for (let i = 0; i < this.hexBoard.size; i++) {
      if (visibleBoard[i] === CellState.Empty) {
        emptyCells.push(i);
      }
    }
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
}
