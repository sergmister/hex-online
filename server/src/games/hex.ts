import { Socket } from "socket.io";

import { CLIENT_URL } from "src/main";

export enum HexPlayerColor {
  Black,
  White,
}

// game id + 1 of 3 permission tokens

class Spectator {
  socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
  }
}

// export type HexPlayerType = "local" | "remote" | "random" | "resistace" | "mcts";
export enum HexPlayerType {
  Local = "local",
  Remote = "remote",
  // Random = "random",
  // Resistace = "resistance",
  // MCTS = "mcts",
}

export class HexPlayer {
  game: HexGame;
  socket: Socket;
  color: HexPlayerColor;

  constructor(game: HexGame, socket: Socket, color: HexPlayerColor) {
    this.game = game;
    this.socket = socket;
    this.color = color;
  }

  move(pos: number): boolean {
    return this.game.move(this.color, pos);
  }
}

enum CellState {
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

export interface HexMoveInfo {
  player: HexPlayerColor;
  pos: number;
}

class HexState {
  board: CellState[];
  currentPlayer: HexPlayerColor;

  constructor(size: number) {
    this.board = Array(size).fill(CellState.Empty);
    this.currentPlayer = HexPlayerColor.Black;
  }
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

  dfs(state: HexState, pos: number, eq_cell_state: CellState, move_cell_state: CellState) {
    const neighbors = this.neighbor_list[pos];
    for (const neighbor of neighbors) {
      if (state.board[neighbor] === eq_cell_state) {
        state.board[neighbor] = move_cell_state;
        this.dfs(state, neighbor, eq_cell_state, move_cell_state);
      }
    }
  }

  move(state: HexState, pos: number): boolean {
    switch (state.currentPlayer) {
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
          if (state.board[neighbor] === CellState.BlackNorth) {
            north_connected = true;
          } else if (state.board[neighbor] === CellState.BlackSouth) {
            south_connected = true;
          }
        }
        if (north_connected && south_connected) {
          state.board[pos] = CellState.BlackWin;
          return true;
        } else if (north_connected) {
          state.board[pos] = CellState.BlackNorth;
          this.dfs(state, pos, CellState.Black, CellState.BlackNorth);
        } else if (south_connected) {
          state.board[pos] = CellState.BlackSouth;
          this.dfs(state, pos, CellState.Black, CellState.BlackSouth);
        } else {
          state.board[pos] = CellState.Black;
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
          if (state.board[neighbor] === CellState.WhiteWest) {
            west_connected = true;
          } else if (state.board[neighbor] === CellState.WhiteEast) {
            east_connected = true;
          }
        }
        if (west_connected && east_connected) {
          state.board[pos] = CellState.WhiteWin;
          return true;
        } else if (west_connected) {
          state.board[pos] = CellState.WhiteWest;
          this.dfs(state, pos, CellState.White, CellState.WhiteWest);
        } else if (east_connected) {
          state.board[pos] = CellState.WhiteEast;
          this.dfs(state, pos, CellState.White, CellState.WhiteEast);
        } else {
          state.board[pos] = CellState.White;
        }
        break;
      }
    }

    state.currentPlayer = state.currentPlayer === HexPlayerColor.Black ? HexPlayerColor.White : HexPlayerColor.Black;
    return false;
  }
}

export interface HexGameOptions {
  width: number;
  height: number;
  swap_rule: boolean;
  dark: boolean;
  reverse: boolean;
}

export class HexGame {
  // player_black?: HexPlayer;
  // player_white?: HexPlayer;
  players: (HexPlayer | null)[] = Array(2).fill(null);
  // inviteLink: string;

  board: HexBoard;
  currentState: HexState;

  history: { pos: number; color: HexPlayerColor; swap?: true }[] = [];
  win?: HexPlayerColor;
  started = false;
  quited = false;

  options: HexGameOptions;

  constructor({ width = 11, height = 11, swap_rule = false, dark = false, reverse = false }: Partial<HexGameOptions>) {
    // this.player_black = new Player();
    // this.player_white = new Player();

    this.options = { width, height, swap_rule, dark, reverse };

    // const url = new URL(CLIENT_URL);
    // url.searchParams.append("gameid", )
    // this.inviteLink = ;
    this.board = new HexBoard(width, height);
    this.currentState = new HexState(this.board.size);
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
    for (const player of this.players) {
      if (player) {
        player.socket.disconnect();
      }
    }
  }

  // join(socket: Socket, { auth, color }: HexJoinOptions): HexPlayer | null {
  //   const black_available = !this.player_black;
  //   const white_available = !this.player_black;
  //   switch (color) {
  //     case "black":
  //       if (black_available) {
  //         this.player_black = new HexPlayer(this, socket, HexPlayerColor.Black);
  //         return this.player_black;
  //       } else if (white_available) {
  //         this.player_white = new HexPlayer(this, socket, HexPlayerColor.White);
  //         return this.player_white;
  //       }
  //       break;
  //     case "white":
  //       if (white_available) {
  //         this.player_white = new HexPlayer(this, socket, HexPlayerColor.White);
  //         return this.player_white;
  //       } else if (black_available) {
  //         this.player_black = new HexPlayer(this, socket, HexPlayerColor.Black);
  //         return this.player_black;
  //       }
  //       break;
  //   }

  //   return null;
  // }

  join(socket: Socket, { auth, color }: { auth?: string; color?: HexPlayerColor }): HexPlayer | null {
    if (color) {
      if (this.players[color] === null) {
        this.players[color] = new HexPlayer(this, socket, color);
        return this.players[color];
      }
    } else {
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i] === null) {
          this.players[i] = new HexPlayer(this, socket, i);
          return this.players[i];
        }
      }
    }
    return null;
  }

  move(playerColor: HexPlayerColor, pos: number): boolean {
    if (this.started && this.win === undefined && !this.quited) {
      if (playerColor === this.currentState.currentPlayer) {
        if (pos === -1) {
          if (this.options.swap_rule && this.history.length === 1) {
            this.players[
              playerColor === HexPlayerColor.Black ? HexPlayerColor.White : HexPlayerColor.Black
            ]!.socket.emit("move", { player: this.currentState.currentPlayer, pos } as HexMoveInfo);
            this.swap();
            return true;
          }
        } else if (pos >= 0 && pos < this.board.size) {
          if (this.currentState.board[pos] === CellState.Empty) {
            const gameOver = this.board.move(this.currentState, pos);
            this.players[
              playerColor === HexPlayerColor.Black ? HexPlayerColor.White : HexPlayerColor.Black
            ]!.socket.emit("move", { player: playerColor, pos } as HexMoveInfo);
            if (gameOver) {
              this.win = this.currentState.currentPlayer;
            }
            return true;
          }
        }
      }
    }

    return false;
  }

  swap() {
    const firstMove = this.history[1];
    const pos = firstMove.pos;
    this.history.push({ pos, color: this.currentState.currentPlayer, swap: true });
    this.board.move(this.currentState, pos);
  }
}
