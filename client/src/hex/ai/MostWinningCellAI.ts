import type { HexAI } from "src/hex/ai/BaseAI";
import { CellState, HexBoard, HexPlayerColor, HexState, switchPlayer } from "src/hex/HexBoard";

export class MostWinningCellAI implements HexAI {
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

    const winArray: number[] = new Array(this.hexBoard.size).fill(0);

    for (let i = 0; i < 10000; i++) {
      const newState: HexState = { board: state.board.slice() };
      let currentPlayer = player;
      const newEmptyCells = emptyCells.slice();
      shuffle(newEmptyCells);
      for (const pos of newEmptyCells) {
        if (this.hexBoard.move(newState, currentPlayer, pos)) {
          if (currentPlayer === player) {
            winArray[pos] += 1;
          }
          break;
        }
        currentPlayer = switchPlayer(currentPlayer);
      }
    }

    let max = -1;
    let maxIndex = 0;

    for (const emptyCell of emptyCells) {
      if (winArray[emptyCell] > max) {
        maxIndex = emptyCell;
        max = winArray[emptyCell];
      }
    }

    return maxIndex;
  }
}

const shuffle = (array: any[]) => {
  for (let currentIndex = array.length; currentIndex !== 0; ) {
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
};
