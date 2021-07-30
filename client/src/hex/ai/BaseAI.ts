import type { HexPlayerColor } from "src/hex/HexBoard";

export interface HexAI {
  getHexMove(state: Uint8Array, player: HexPlayerColor): number;
}

export interface DarkHexAI {
  getDarkHexMove(visibleBoard: Uint8Array, player: HexPlayerColor): number;
}

export interface ReverseHexAI {
  getReverseHexMove(state: Uint8Array, player: HexPlayerColor): number;
}

export interface DarkReverseHexAI {
  getDarkReverseHexMove(visibleBoard: Uint8Array, player: HexPlayerColor): number;
}
