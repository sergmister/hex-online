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

export class HexBoard {
  width: number;
  height: number;
  size: number;
  neighbor_list: number[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.size = this.width * this.height;
    this.neighbor_list = Array(this.size)
      .fill(0)
      .map((u) => (u = []));

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const cell = this.neighbor_list[this.getIndex(x, y)];
        if (x > 0) {
          cell.push(this.getIndex(x - 1, y));
        }
        if (y > 0) {
          cell.push(this.getIndex(x, y - 1));
        }
        if (x < this.width - 1) {
          cell.push(this.getIndex(x + 1, y));
        }
        if (y < this.height - 1) {
          cell.push(this.getIndex(x, y + 1));
        }
        if (x > 0 && y < this.height - 1) {
          cell.push(this.getIndex(x - 1, y + 1));
        }
        if (y > 0 && x < this.width - 1) {
          cell.push(this.getIndex(x + 1, y - 1));
        }
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

  dfs(board: Uint8Array, pos: number, eq_cell_state: CellState, move_cell_state: CellState) {
    const neighbors = this.neighbor_list[pos];
    for (const neighbor of neighbors) {
      if (board[neighbor] === eq_cell_state) {
        board[neighbor] = move_cell_state;
        this.dfs(board, neighbor, eq_cell_state, move_cell_state);
      }
    }
  }

  move(board: Uint8Array, player: HexPlayerColor, pos: number): boolean {
    switch (player) {
      case HexPlayerColor.Black: {
        let north_connected = false;
        let south_connected = false;
        if (pos < this.width) {
          north_connected = true;
        } else if (pos >= this.size - this.width) {
          south_connected = true;
        }
        const neighbors = this.neighbor_list[pos];
        for (const neighbor of neighbors) {
          if (board[neighbor] === CellState.BlackNorth) {
            north_connected = true;
          } else if (board[neighbor] === CellState.BlackSouth) {
            south_connected = true;
          }
        }
        if (north_connected && south_connected) {
          board[pos] = CellState.BlackWin;
          return true;
        } else if (north_connected) {
          board[pos] = CellState.BlackNorth;
          this.dfs(board, pos, CellState.Black, CellState.BlackNorth);
        } else if (south_connected) {
          board[pos] = CellState.BlackSouth;
          this.dfs(board, pos, CellState.Black, CellState.BlackSouth);
        } else {
          board[pos] = CellState.Black;
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
        const neighbors = this.neighbor_list[pos];
        for (const neighbor of neighbors) {
          if (board[neighbor] === CellState.WhiteWest) {
            west_connected = true;
          } else if (board[neighbor] === CellState.WhiteEast) {
            east_connected = true;
          }
        }
        if (west_connected && east_connected) {
          board[pos] = CellState.WhiteWin;
          return true;
        } else if (west_connected) {
          board[pos] = CellState.WhiteWest;
          this.dfs(board, pos, CellState.White, CellState.WhiteWest);
        } else if (east_connected) {
          board[pos] = CellState.WhiteEast;
          this.dfs(board, pos, CellState.White, CellState.WhiteEast);
        } else {
          board[pos] = CellState.White;
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
