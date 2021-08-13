export enum HexPlayerColor {
  Black,
  White,
}

// indicates what sides a cell is connected to
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
  miai_neighbor_list: Int16Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.size = this.width * this.height;
    this.neighbor_list = new Int16Array(this.size * 6); // list representing neighboring cells
    this.miai_neighbor_list = new Int16Array(this.size * 6); // list representing miai neighboring cells

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

    // -1 is north side
    // -2 is south side
    // -3 is west side
    // -4 is east side
    // -5 means nothing and is used when a cell is on an edge
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const index = this.getIndex(x, y) * 6;

        if (y === 0 || x === this.width - 1) {
          this.miai_neighbor_list[index + 0] = -5;
        } else if (y === 1) {
          this.miai_neighbor_list[index + 0] = -1;
        } else {
          this.miai_neighbor_list[index + 0] = this.getIndex(x + 1, y - 2);
        }

        if (x === this.width - 1 || y === 0) {
          this.miai_neighbor_list[index + 1] = -5;
        } else if (x === this.width - 2) {
          this.miai_neighbor_list[index + 1] = -4;
        } else {
          this.miai_neighbor_list[index + 1] = this.getIndex(x + 2, y - 1);
        }

        if (x === this.width - 1 || y === this.height - 1) {
          this.miai_neighbor_list[index + 2] = -5;
        } else {
          this.miai_neighbor_list[index + 2] = this.getIndex(x + 1, y + 1);
        }

        if (y === this.height - 1 || x === 0) {
          this.miai_neighbor_list[index + 3] = -5;
        } else if (y === this.height - 2) {
          this.miai_neighbor_list[index + 3] = -2;
        } else {
          this.miai_neighbor_list[index + 3] = this.getIndex(x - 1, y + 2);
        }

        if (x === 0 || y === this.height - 1) {
          this.miai_neighbor_list[index + 4] = -5;
        } else if (x === 1) {
          this.miai_neighbor_list[index + 4] = -3;
        } else {
          this.miai_neighbor_list[index + 4] = this.getIndex(x - 2, y + 1);
        }

        if (x === 0 || y === 0) {
          this.miai_neighbor_list[index + 5] = -5;
        } else {
          this.miai_neighbor_list[index + 5] = this.getIndex(x - 1, y - 1);
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

  // depth first search to ensure all cells have proper connectivity
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

  // dfs with the ability for cells to connect via miai
  miaiConnectivityDfs(state: Uint8Array, pos: number, eq_cell_state: CellState, move_cell_state: CellState) {
    for (let i = 0; i < 6; i++) {
      const neighbor = this.neighbor_list[pos * 6 + i];
      if (state[neighbor] === eq_cell_state) {
        state[neighbor] = move_cell_state;
        this.dfs(state, neighbor, eq_cell_state, move_cell_state);
      }
    }

    for (let i = 0; i < 6; i++) {
      const miaiNeighbor = this.miai_neighbor_list[pos * 6 + i];
      if (miaiNeighbor >= 0) {
        if (state[miaiNeighbor] === eq_cell_state) {
          const neighbor1 = this.neighbor_list[pos * 6 + i];
          const neighbor2 = this.neighbor_list[pos * 6 + ((i + 1) % 6)];
          if (neighbor1 === CellState.Empty && neighbor2 === CellState.Empty) {
            state[miaiNeighbor] = move_cell_state;
            this.dfs(state, miaiNeighbor, eq_cell_state, move_cell_state);
          }
        }
      }
    }
  }

  miaiConnectivityMove(state: Uint8Array, reply: Int16Array, player: HexPlayerColor, pos: number): boolean {
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
          if (neighbor !== -1) {
            if (state[neighbor] === CellState.BlackNorth) {
              north_connected = true;
            } else if (state[neighbor] === CellState.BlackSouth) {
              south_connected = true;
            }
          }

          const miaiNeighbor = this.miai_neighbor_list[pos * 6 + i];
          if (miaiNeighbor !== -5) {
            const neighbor1 = this.neighbor_list[pos * 6 + i];
            const neighbor2 = this.neighbor_list[pos * 6 + ((i + 1) % 6)];
            if (
              neighbor1 !== -1 &&
              neighbor2 !== -1 &&
              state[neighbor1] === CellState.Empty &&
              state[neighbor2] === CellState.Empty
            ) {
              if (miaiNeighbor >= 0) {
                switch (state[miaiNeighbor]) {
                  case CellState.Black:
                  case CellState.BlackNorth:
                  case CellState.BlackSouth:
                  case CellState.BlackWin:
                    reply[neighbor1] = neighbor2;
                    reply[neighbor2] = neighbor1;
                    break;
                }

                switch (state[miaiNeighbor]) {
                  case CellState.BlackNorth:
                    north_connected = true;
                    break;
                  case CellState.BlackSouth:
                    south_connected = true;
                    break;
                }
              } else if (miaiNeighbor === -1) {
                north_connected = true;
                reply[neighbor1] = neighbor2;
                reply[neighbor2] = neighbor1;
              } else if (miaiNeighbor === -2) {
                south_connected = true;
                reply[neighbor1] = neighbor2;
                reply[neighbor2] = neighbor1;
              }
            }
          }
        }

        if (north_connected && south_connected) {
          state[pos] = CellState.BlackWin;
          return true;
        } else if (north_connected) {
          state[pos] = CellState.BlackNorth;
          this.miaiConnectivityDfs(state, pos, CellState.Black, CellState.BlackNorth);
        } else if (south_connected) {
          state[pos] = CellState.BlackSouth;
          this.miaiConnectivityDfs(state, pos, CellState.Black, CellState.BlackSouth);
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
          if (neighbor !== -1) {
            if (state[neighbor] === CellState.WhiteWest) {
              west_connected = true;
            } else if (state[neighbor] === CellState.WhiteEast) {
              east_connected = true;
            }
          }

          const miaiNeighbor = this.miai_neighbor_list[pos * 6 + i];
          if (miaiNeighbor !== -5) {
            const neighbor1 = this.neighbor_list[pos * 6 + i];
            const neighbor2 = this.neighbor_list[pos * 6 + ((i + 1) % 6)];
            if (
              neighbor1 !== -1 &&
              neighbor2 !== -1 &&
              state[neighbor1] === CellState.Empty &&
              state[neighbor2] === CellState.Empty
            ) {
              if (miaiNeighbor >= 0) {
                switch (state[miaiNeighbor]) {
                  case CellState.White:
                  case CellState.WhiteWest:
                  case CellState.WhiteEast:
                  case CellState.WhiteWin:
                    reply[neighbor1] = neighbor2;
                    reply[neighbor2] = neighbor1;
                    break;
                }

                switch (state[miaiNeighbor]) {
                  case CellState.WhiteWest:
                    west_connected = true;
                    break;
                  case CellState.WhiteEast:
                    east_connected = true;
                    break;
                }
              } else if (miaiNeighbor === -3) {
                west_connected = true;
                reply[neighbor1] = neighbor2;
                reply[neighbor2] = neighbor1;
              } else if (miaiNeighbor === -4) {
                east_connected = true;
                reply[neighbor1] = neighbor2;
                reply[neighbor2] = neighbor1;
              }
            }
          }
        }

        if (west_connected && east_connected) {
          state[pos] = CellState.WhiteWin;
          return true;
        } else if (west_connected) {
          state[pos] = CellState.WhiteWest;
          this.miaiConnectivityDfs(state, pos, CellState.White, CellState.WhiteWest);
        } else if (east_connected) {
          state[pos] = CellState.WhiteEast;
          this.miaiConnectivityDfs(state, pos, CellState.White, CellState.WhiteEast);
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
