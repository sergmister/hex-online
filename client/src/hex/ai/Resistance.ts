import type { CellState, HexBoard, HexState } from "src/hex/HexBoard";

let Size = 11;

export class ResistanceAI {
  hexBoard: HexBoard;

  Fld = new Array(Size);
  Pot = new Array(Size); // electric lumanance values?
  Bridge = new Array(Size);
  Upd = new Array(Size);

  constructor(hexBoard: HexBoard) {
    this.hexBoard = hexBoard;

    for (let i = 0; i < Size; i++) this.Fld[i] = new Array(Size);

    for (let i = 0; i < Size; i++) this.Pot[i] = new Array(Size);
    for (let i = 0; i < Size; i++) {
      for (let j = 0; j < Size; j++) this.Pot[i][j] = new Array(4);
    }

    for (let i = 0; i < Size; i++) this.Bridge[i] = new Array(Size);
    for (let i = 0; i < Size; i++) {
      for (let j = 0; j < Size; j++) this.Bridge[i][j] = new Array(4);
    }

    for (let i = 0; i < Size; i++) this.Upd[i] = new Array(Size);
  }

  getMove(state: HexState) {
    // const emptyCells = [];
    // for (let i = 0; i < this.hexBoard.size; i++) {
    //   if (state.board[i] === CellState.Empty) {
    //     emptyCells.push(i);
    //   }
    // }
    // return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    // const theLevel = 3;
    // let ff = 0;
    // let x_q = 0;
    // let y_q = 0;
    // for (let x = 0; x < this.hexBoard.width; x++) {
    //   for (let y = 0; y < this.hexBoard.height; y++) {
    //     if (this.Fld[x][y] != 0) {
    //       x_q += 2 * x + 1 - Size;
    //       y_q += 2 * y + 1 - Size;
    //     }
    //   }
    // }
    // x_q = Math.sign(x_q);
    // y_q = Math.sign(y_q);
    // for (let x = 0; x < this.hexBoard.width; x++) {
    //   for (let y = 0; y < this.hexBoard.height; y++) {
    //     if (this.Fld[x][y] == 0) {
    //       let mmp = Math.random() * (49 - theLevel * 16);
    //       mmp += (Math.abs(x - 5) + Math.abs(y - 5)) * ff;
    //       mmp += (8 * (x_q * (x - 5) + y_q * (y - 5))) / (MoveCount + 1);
    //       if (theLevel > 2) {
    //         for (kk = 0; kk < 4; kk++) mmp -= Bridge[x][y][kk];
    //       }
    //       pp0 = Pot[x][y][0] + Pot[x][y][1];
    //       pp1 = Pot[x][y][2] + Pot[x][y][3];
    //       mmp += pp0 + pp1;
    //       if (pp0 <= 268 || pp1 <= 268) mmp -= 400; //140+128
    //       vv[x * Size + y] = mmp;
    //       if (mmp < mm) {
    //         mm = mmp;
    //         x_b = x;
    //         y_b = y;
    //       }
    //     }
    //   }
    // }
  }
}
