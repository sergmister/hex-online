import { io, Socket } from "socket.io-client";

import { CellState, HexBoard, HexPlayerColor, reduceCellState, switchPlayer } from "src/hex/HexBoard";
import type { DarkHexAI, DarkReverseHexAI } from "src/hex/ai/BaseAI";
import { RandomAI } from "src/hex/ai/RandomAI";
import type { HexMoveInfo } from "src/hex/Hex";

export enum DarkHexPlayerType {
  Local = "local",
  Remote = "remote",
  Random = "random",
}

export enum DarkReverseHexPlayerType {
  Local = "local",
  Remote = "remote",
  Random = "random",
}

export class DarkHexPlayer {
  type: DarkHexPlayerType;
  ai: DarkHexAI | DarkReverseHexAI | undefined;

  constructor(type: DarkHexPlayerType, ai?: DarkHexAI | DarkReverseHexAI) {
    this.type = type;
    this.ai = ai;
  }
}

export interface DarkHexGameOptions {
  width: number;
  height: number;
  reverse: boolean;
  swapRule: boolean;
  playerTypes: (DarkHexPlayerType | DarkReverseHexPlayerType)[];
  serverAddress: string;
}

export class DarkHexGame {
  players: (DarkHexPlayer | null)[] = Array(2).fill(null);

  hexBoard: HexBoard;
  currentState?: Uint8Array;
  currentPlayer: HexPlayerColor;
  visibleBoards: (Uint8Array | null)[] = Array(2).fill(null);

  onUpdateCallback: (hexGame: DarkHexGame) => void;

  history?: {
    state: Uint8Array;
    black_visible_board: Uint8Array;
    white_visible_board: Uint8Array;
    last_player?: HexPlayerColor;
    last_move?: number;
    swap?: true;
    win?: HexPlayerColor | undefined;
  }[];
  messages: { source: string; message: string }[] = [];
  win?: HexPlayerColor | undefined;
  started = false;
  quited = false;
  pending = false;
  paused = false;
  loading = false;

  moveInterval?: number;
  socket?: Socket;
  inviteLink?: string;
  options: DarkHexGameOptions;

  constructor(
    { width, height, reverse, swapRule, playerTypes, serverAddress }: DarkHexGameOptions,
    onUpdateCallback: (hexGame: DarkHexGame) => void,
    socket?: Socket,
  ) {
    this.onUpdateCallback = onUpdateCallback;

    this.options = { width, height, reverse, swapRule, playerTypes, serverAddress };

    this.hexBoard = new HexBoard(width, height);
    this.currentPlayer = HexPlayerColor.Black;

    let online = false;

    if (this.options.reverse) {
      for (let i = 0; i < playerTypes.length; i++) {
        switch (playerTypes[i]) {
          case DarkHexPlayerType.Random:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Random, new RandomAI(this.hexBoard));
            break;
          case DarkHexPlayerType.Remote:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Remote);
            break;
          case DarkHexPlayerType.Local:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Local);
            break;
        }
      }
    } else {
      for (let i = 0; i < playerTypes.length; i++) {
        switch (playerTypes[i]) {
          case DarkHexPlayerType.Random:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Random, new RandomAI(this.hexBoard));
            break;
          case DarkHexPlayerType.Remote:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Remote);
            break;
          case DarkHexPlayerType.Local:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Local);
            break;
        }
      }
    }

    for (let i = 0; i < playerTypes.length; i++) {
      if (playerTypes[i] === "remote") {
        online = true;
      } else {
        this.visibleBoards[i] = new Uint8Array(width * height);
      }
    }

    if (online) {
      this.socket_connect(socket);
    } else {
      this.currentState = new Uint8Array(this.hexBoard.size).fill(CellState.Empty);
      this.history = [
        {
          state: this.currentState.slice(),
          black_visible_board: this.visibleBoards[0]!.slice(),
          white_visible_board: this.visibleBoards[1]!.slice(),
        },
      ];
      this.started = true;
    }

    this.next_play();
  }

  socket_connect(socket?: Socket) {
    if (!socket) {
      const url = new URL("/darkhex", this.options.serverAddress);
      socket = io(url.toString(), {
        query: { options: JSON.stringify(this.options) },
        reconnection: false,
      });

      socket.on("joined", (inviteLink: string) => {
        this.inviteLink = inviteLink;
        this.messages.push({ source: "link", message: inviteLink });
        this.messages.push({
          source: "game",
          message: "You are player " + (this.options.playerTypes[0] === "local" ? "red" : "blue"),
        });
        this.onUpdateCallback(this);
      });
    } else {
      this.messages.push({
        source: "game",
        message: `Game: Dark ${this.options.reverse ? "Reverse " : ""}Hex\nWidth: ${this.options.width}\nHeigth: ${
          this.options.height
        }\nSwap rule: ${this.options.swapRule ? "True" : "False"}`,
      });
      this.messages.push({
        source: "game",
        message: "You are player " + (this.options.playerTypes[0] === "local" ? "red" : "blue"),
      });
    }

    this.socket = socket;

    this.socket.once("disconnect", () => {
      this.quit();
    });

    this.socket.on("connect_error", () => {
      this.quit();
    });

    this.socket.on("started", () => {
      this.start();
    });

    this.socket.on("move", ({ state, pos, switchColor }: { state: CellState; pos?: number; switchColor: boolean }) => {
      this.remote_move({ state, pos, switchColor });
    });

    this.socket.on("win", ({ win, board }: { win: HexPlayerColor; board: ArrayBuffer }) => {
      this.win = win;
      this.currentState = new Uint8Array(board);
      this.onUpdateCallback(this);
    });

    this.socket.on("message", (message: { source: string; message: string }) => {
      this.messages.push(message);
      this.onUpdateCallback(this);
    });
  }

  sendMessage(message: string) {
    if (this.socket) {
      const msg = { source: this.options.playerTypes[0] === "local" ? "red" : "blue", message };
      this.messages.push(msg);
      this.socket.emit("message", msg);
      this.onUpdateCallback(this);
    }
  }

  start() {
    this.started = true;
    this.messages.push({ source: "game", message: "Game started" });
    this.onUpdateCallback(this);
  }

  quit() {
    this.quited = true;
    this.messages.push({ source: "game", message: "A player has quit or disconnected" });
    if (this.moveInterval !== undefined) {
      clearInterval(this.moveInterval);
    }
    this.socket?.disconnect();
    this.onUpdateCallback(this);
  }

  play() {
    this.paused = false;
    this.onUpdateCallback(this);
    this.next_play();
  }

  pause() {
    this.paused = true;
    this.onUpdateCallback(this);
  }

  step_back() {
    if (!this.loading && this.history) {
      if (this.history.length >= 2) {
        this.history.pop();
        this.currentState = this.history[this.history.length - 1].state.slice();
        this.visibleBoards[0] = this.history[this.history.length - 1].black_visible_board.slice();
        this.visibleBoards[1] = this.history[this.history.length - 1].white_visible_board.slice();
        this.currentPlayer = switchPlayer(this.currentPlayer);
        this.win = this.history[this.history.length - 1].win;
        this.onUpdateCallback(this);
      }
    }
  }

  step_forward() {
    if (!this.loading) {
      this.next_play();
    }
  }

  local_move(pos: number) {
    if (this.started && !this.quited && this.win === undefined && !this.pending) {
      if (this.players[this.currentPlayer]?.type === "local") {
        if (pos >= 0 && pos < this.hexBoard.size) {
          if (this.visibleBoards[this.currentPlayer]![pos] === CellState.Empty) {
            if (this.socket) {
              this.pending = true;
              this.socket.emit("move", { player: this.currentPlayer, pos } as HexMoveInfo);
            } else {
              this.move(pos);
            }
          }
        }
      }
    }
  }

  remote_move({ state, pos, switchColor }: { state: CellState; pos: number | undefined; switchColor: boolean }) {
    this.pending = false;
    if (pos !== undefined) {
      this.visibleBoards[this.currentPlayer]![pos] = state;
    }
    if (switchColor) {
      this.currentPlayer = switchPlayer(this.currentPlayer);
    }
    this.onUpdateCallback(this);
  }

  move(pos: number) {
    let gameOver = false;
    if (this.currentState![pos] === CellState.Empty) {
      gameOver = this.hexBoard.move(this.currentState!, this.currentPlayer, pos);
      this.visibleBoards[this.currentPlayer]![pos] = reduceCellState(this.currentState![pos]);
      if (gameOver) {
        if (this.options.reverse) {
          this.win = switchPlayer(this.currentPlayer);
        } else {
          this.win = this.currentPlayer;
        }
      }
      this.history?.push({
        state: this.currentState!.slice(),
        black_visible_board: this.visibleBoards[0]!.slice(),
        white_visible_board: this.visibleBoards[1]!.slice(),
        last_player: this.currentPlayer,
        last_move: pos,
        win: this.win,
      });
      this.currentPlayer = switchPlayer(this.currentPlayer);
    } else {
      this.visibleBoards[this.currentPlayer]![pos] = reduceCellState(this.currentState![pos]);
    }
    this.onUpdateCallback(this);

    if (!this.paused) {
      this.next_play();
    }
  }

  async next_play() {
    if (this.win === undefined) {
      const nextPlayer = this.players[this.currentPlayer];
      if (nextPlayer?.ai) {
        let t1 = Date.now();
        let move;
        this.loading = true;
        if (this.options.reverse) {
          move = (nextPlayer.ai as DarkReverseHexAI).getDarkReverseHexMove(
            this.visibleBoards[this.currentPlayer]!,
            this.currentPlayer,
          );
        } else {
          move = (nextPlayer.ai as DarkHexAI).getDarkHexMove(
            this.visibleBoards[this.currentPlayer]!,
            this.currentPlayer,
          );
        }
        await new Promise((r) => setTimeout(r, 100 - (Date.now() - t1)));
        this.move(move);
        this.loading = false;
      }
    }
  }
}
