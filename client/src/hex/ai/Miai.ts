import type { HexAI } from "src/hex/ai/BaseAI";
import type { CellState, HexBoard, HexPlayerColor, switchPlayer } from "src/hex/HexBoard";

import { init, HexBoard as HexBoardWasm, HexPlayerColor as HexPlayerColorWasm, MCTSAI } from "hexy";
init();

export class MiaiAI implements HexAI {
  hexBoardWasm: HexBoardWasm;
  mctsAI: MCTSAI;

  constructor(hexBoard: HexBoard) {
    this.hexBoardWasm = HexBoardWasm.new(hexBoard.width, hexBoard.height);
    this.mctsAI = MCTSAI.new(this.hexBoardWasm);
  }

  getHexMove(state: Uint8Array, player: HexPlayerColor) {
    return this.mctsAI.get_hex_move(state, player);
  }
}
