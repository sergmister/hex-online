import type { DarkHexAI, DarkReverseHexAI, HexAI, ReverseHexAI } from "src/hex/ai/BaseAI";
import { CellState, HexBoard, HexPlayerColor } from "src/hex/HexBoard";

export class RandomAI implements HexAI, DarkHexAI, ReverseHexAI, DarkReverseHexAI {
  hexBoard: HexBoard;

  constructor(hexBoard: HexBoard) {
    this.hexBoard = hexBoard;
  }

  private move(state: Uint8Array, player: HexPlayerColor) {
    const emptyCells = [];
    for (let i = 0; i < this.hexBoard.size; i++) {
      if (state[i] === CellState.Empty) {
        emptyCells.push(i);
      }
    }
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  getHexMove(state: Uint8Array, player: HexPlayerColor) {
    return this.move(state, player);
  }

  getDarkHexMove(visibleBoard: Uint8Array, player: HexPlayerColor) {
    return this.move(visibleBoard, player);
  }

  getReverseHexMove(state: Uint8Array, player: HexPlayerColor) {
    return this.move(state, player);
  }

  getDarkReverseHexMove(visibleBoard: Uint8Array, player: HexPlayerColor) {
    return this.move(visibleBoard, player);
  }
}
