import { io, Socket } from "socket.io-client";

import { CellState, HexBoard, HexPlayerColor, HexState, reduceCellState, switchPlayer } from "src/hex/HexBoard";
import type { DarkHexAI, DarkReverseHexAI } from "src/hex/ai/BaseAI";
import { RandomAI } from "src/hex/ai/RandomAI";
import type { HexMoveInfo } from "src/hex/Hex";

import { SERVER_URL } from "src/hex/communication";

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
}

export class DarkHexGame {
  players: (DarkHexPlayer | null)[] = Array(2).fill(null);

  board: HexBoard;
  currentState?: HexState;
  currentPlayer: HexPlayerColor;
  visibleBoards: (Uint8Array | null)[] = Array(2).fill(null);

  onUpdateCallback: (hexGame: DarkHexGame) => void;

  history: { color: HexPlayerColor; pos?: number; swap?: true }[] = [];
  messages: { source: string; message: string }[] = [];
  win?: HexPlayerColor;
  started = false;
  quited = false;
  pending = false;

  moveInterval?: number;
  socket?: Socket;
  inviteLink?: string;
  options: DarkHexGameOptions;

  constructor(
    { width, height, reverse, swapRule, playerTypes }: DarkHexGameOptions,
    onUpdateCallback: (hexGame: DarkHexGame) => void,
    socket?: Socket,
  ) {
    this.onUpdateCallback = onUpdateCallback;

    this.options = { width, height, reverse, swapRule, playerTypes };

    this.board = new HexBoard(width, height);
    this.currentPlayer = HexPlayerColor.Black;

    let online = false;

    if (this.options.reverse) {
      for (let i = 0; i < playerTypes.length; i++) {
        switch (playerTypes[i]) {
          case DarkHexPlayerType.Random:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Random, new RandomAI(this.board));
            break;
          case DarkHexPlayerType.Remote:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Remote);
            online = true;
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
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Random, new RandomAI(this.board));
            break;
          case DarkHexPlayerType.Remote:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Remote);
            online = true;
            break;
          case DarkHexPlayerType.Local:
            this.players[i] = new DarkHexPlayer(DarkHexPlayerType.Local);
            break;
        }
      }
    }

    for (let i = 0; i < playerTypes.length; i++) {
      if (playerTypes[i] !== "remote") {
        this.visibleBoards[i] = new Uint8Array(width * height);
      }
    }

    if (online) {
      this.socket_connect(socket);
    } else {
      this.currentState = new HexState(this.board.size);
      this.started = true;
    }

    const nextPlayer = this.players[this.currentPlayer];
    if (nextPlayer?.ai) {
      this.moveInterval = setTimeout(() => {
        if (this.options.reverse) {
          this.move(
            (nextPlayer.ai as DarkReverseHexAI).getDarkReverseHexMove(
              this.visibleBoards[this.currentPlayer]!,
              this.currentPlayer,
            ),
          );
        } else {
          this.move(
            (nextPlayer.ai as DarkHexAI).getDarkHexMove(this.visibleBoards[this.currentPlayer]!, this.currentPlayer),
          );
        }
      }, 100);
    }
  }

  socket_connect(socket?: Socket) {
    if (!socket) {
      socket = io(SERVER_URL + "darkhex", {
        query: { options: JSON.stringify(this.options) },
        reconnection: false,
        path: "/socket.io",
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
      this.currentState = { board: new Uint8Array(board) };
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

  local_move(pos: number) {
    if (this.started && !this.quited && this.win === undefined && !this.pending) {
      if (this.players[this.currentPlayer]?.type === "local") {
        if (pos >= 0 && pos < this.board.size) {
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
    if (this.currentState!.board[pos] === CellState.Empty) {
      this.history?.push({ pos, color: this.currentPlayer });
      gameOver = this.board.move(this.currentState!, this.currentPlayer, pos);
      this.visibleBoards[this.currentPlayer]![pos] = reduceCellState(this.currentState!.board[pos]);
      if (gameOver) {
        if (this.options.reverse) {
          this.win = switchPlayer(this.currentPlayer);
        } else {
          this.win = this.currentPlayer;
        }
      }
      this.currentPlayer = switchPlayer(this.currentPlayer);
    } else {
      this.visibleBoards[this.currentPlayer]![pos] = reduceCellState(this.currentState!.board[pos]);
    }
    this.onUpdateCallback(this);

    if (!gameOver) {
      const nextPlayer = this.players[this.currentPlayer];
      if (nextPlayer?.ai) {
        this.moveInterval = setTimeout(() => {
          if (this.options.reverse) {
            this.move(
              (nextPlayer.ai as DarkReverseHexAI).getDarkReverseHexMove(
                this.visibleBoards[this.currentPlayer]!,
                this.currentPlayer,
              ),
            );
          } else {
            this.move(
              (nextPlayer.ai as DarkHexAI).getDarkHexMove(this.visibleBoards[this.currentPlayer]!, this.currentPlayer),
            );
          }
        }, 100);
      }
    }
  }
}
