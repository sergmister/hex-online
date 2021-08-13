export enum HexPlayerColor {
  Black,
  White,
}

export enum CellState {
  Empty,
  White,
  WhiteWest,
  WhiteEast,
  WhiteWin,
  Black,
  BlackNorth,
  BlackSouth,
  BlackWin,
}

// this class computes moves in hex to determine if there is a winner
export class HexBoard {
  width: number;
  height: number;
  size: number;
  neighbor_list: Int16Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.size = this.width * this.height;
    this.neighbor_list = new Int16Array(this.size * 6);

    // -1 means no no neighbor
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const index = this.getIndex(x, y) * 6;

        this.neighbor_list[index + 0] = y > 0 ? this.getIndex(x, y - 1) : -1;
        this.neighbor_list[index + 1] = y > 0 && x < this.width - 1 ? this.getIndex(x + 1, y - 1) : -1;
        this.neighbor_list[index + 2] = x < this.width - 1 ? this.getIndex(x + 1, y) : -1;
        this.neighbor_list[index + 3] = y < this.height - 1 ? this.getIndex(x, y + 1) : -1;
        this.neighbor_list[index + 4] = x > 0 && y < this.height - 1 ? this.getIndex(x - 1, y + 1) : -1;
        this.neighbor_list[index + 5] = x > 0 ? this.getIndex(x - 1, y) : -1;
      }
    }
  }

  getIndex(x: number, y: number) {
    return y * this.width + x;
  }

  getXY(pos: number) {
    const x = pos % this.width;
    const y = Math.floor(pos / this.width);
    return [x, y];
  }

  dfs(state: Uint8Array, pos: number, eq_cell_state: CellState, move_cell_state: CellState) {
    for (let i = 0; i < 6; i++) {
      const neighbor = this.neighbor_list[pos * 6 + i];
      if (state[neighbor] === eq_cell_state) {
        state[neighbor] = move_cell_state;
        this.dfs(state, neighbor, eq_cell_state, move_cell_state);
      }
    }
  }

  move(state: Uint8Array, player: HexPlayerColor, pos: number): boolean {
    switch (player) {
      case HexPlayerColor.Black: {
        let north_connected = false;
        let south_connected = false;
        if (pos < this.width) {
          north_connected = true;
        } else if (pos >= this.size - this.width) {
          south_connected = true;
        }
        for (let i = 0; i < 6; i++) {
          const neighbor = this.neighbor_list[pos * 6 + i];
          if (state[neighbor] === CellState.BlackNorth) {
            north_connected = true;
          } else if (state[neighbor] === CellState.BlackSouth) {
            south_connected = true;
          }
        }
        if (north_connected && south_connected) {
          state[pos] = CellState.BlackWin;
          return true;
        } else if (north_connected) {
          state[pos] = CellState.BlackNorth;
          this.dfs(state, pos, CellState.Black, CellState.BlackNorth);
        } else if (south_connected) {
          state[pos] = CellState.BlackSouth;
          this.dfs(state, pos, CellState.Black, CellState.BlackSouth);
        } else {
          state[pos] = CellState.Black;
        }
        break;
      }

      case HexPlayerColor.White: {
        let west_connected = false;
        let east_connected = false;
        if (pos % this.width === 0) {
          west_connected = true;
        } else if (pos % this.width === this.width - 1) {
          east_connected = true;
        }
        for (let i = 0; i < 6; i++) {
          const neighbor = this.neighbor_list[pos * 6 + i];
          if (state[neighbor] === CellState.WhiteWest) {
            west_connected = true;
          } else if (state[neighbor] === CellState.WhiteEast) {
            east_connected = true;
          }
        }
        if (west_connected && east_connected) {
          state[pos] = CellState.WhiteWin;
          return true;
        } else if (west_connected) {
          state[pos] = CellState.WhiteWest;
          this.dfs(state, pos, CellState.White, CellState.WhiteWest);
        } else if (east_connected) {
          state[pos] = CellState.WhiteEast;
          this.dfs(state, pos, CellState.White, CellState.WhiteEast);
        } else {
          state[pos] = CellState.White;
        }
        break;
      }
    }

    return false;
  }
}

export const switchPlayer = (player: HexPlayerColor): HexPlayerColor => {
  return player === HexPlayerColor.Black ? HexPlayerColor.White : HexPlayerColor.Black;
};

export const reduceCellState = (cellState: CellState): CellState => {
  switch (cellState) {
    case CellState.Empty:
      return CellState.Empty;
    case CellState.Black:
    case CellState.BlackNorth:
    case CellState.BlackSouth:
    case CellState.BlackWin:
      return CellState.Black;
    case CellState.White:
    case CellState.WhiteEast:
    case CellState.WhiteWest:
    case CellState.WhiteWin:
      return CellState.White;
  }
};
