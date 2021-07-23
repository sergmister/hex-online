import { io, Socket } from "socket.io-client";

import { CellState, HexBoard, HexPlayerColor, HexState, switchPlayer } from "src/hex/HexBoard";
import type { HexAI, ReverseHexAI } from "src/hex/ai/BaseAI";
import { RandomAI } from "src/hex/ai/RandomAI";
import { MostWinningCellAI } from "src/hex/ai/MostWinningCellAI";

export enum HexPlayerType {
  Local = "local",
  Remote = "remote",
  Random = "random",
  MostWinningCell = "most-winning-cell",
  // Resistace = "resistance",
  // MCTS = "mcts",
}

export enum ReverseHexPlayerType {
  Local = "local",
  Remote = "remote",
  Random = "random",
}

export class HexPlayer {
  type: HexPlayerType;
  ai: HexAI | ReverseHexAI | undefined;

  constructor(type: HexPlayerType, ai?: HexAI | ReverseHexAI) {
    this.type = type;
    this.ai = ai;
  }
}

export interface HexMoveInfo {
  player: HexPlayerColor;
  pos: number;
}

export interface HexGameOptions {
  width: number;
  height: number;
  reverse: boolean;
  swapRule: boolean;
  playerTypes: (HexPlayerType | ReverseHexPlayerType)[];
  serverAddress: string;
}

export class HexGame {
  players: (HexPlayer | null)[] = Array(2).fill(null);

  board: HexBoard;
  currentState: HexState;
  currentPlayer: HexPlayerColor;

  onUpdateCallback: (hexGame: HexGame) => void;

  history: { color: HexPlayerColor; pos: number; swap?: true }[] = [];
  messages: { source: string; message: string }[] = [];
  win?: HexPlayerColor;
  started = false;
  quited = false;

  moveInterval?: number;
  socket?: Socket;
  inviteLink?: string;
  options: HexGameOptions;

  constructor(
    { width, height, reverse, swapRule, playerTypes, serverAddress }: HexGameOptions,
    onUpdateCallback: (hexGame: HexGame) => void,
    socket?: Socket,
  ) {
    this.onUpdateCallback = onUpdateCallback;

    if (width !== height) {
      swapRule = false;
    }

    this.options = { width, height, reverse, swapRule, playerTypes, serverAddress };

    this.board = new HexBoard(width, height);
    this.currentState = new HexState(this.board.size);
    this.currentPlayer = HexPlayerColor.Black;

    let online = false;

    if (this.options.reverse) {
      for (let i = 0; i < playerTypes.length; i++) {
        switch (playerTypes[i]) {
          case HexPlayerType.Random:
            this.players[i] = new HexPlayer(HexPlayerType.Random, new RandomAI(this.board));
            break;
          case HexPlayerType.Remote:
            this.players[i] = new HexPlayer(HexPlayerType.Remote);
            online = true;
            break;
          case HexPlayerType.Local:
            this.players[i] = new HexPlayer(HexPlayerType.Local);
            break;
        }
      }
    } else {
      for (let i = 0; i < playerTypes.length; i++) {
        switch (playerTypes[i]) {
          case HexPlayerType.Random:
            this.players[i] = new HexPlayer(HexPlayerType.Random, new RandomAI(this.board));
            break;
          case HexPlayerType.MostWinningCell:
            this.players[i] = new HexPlayer(HexPlayerType.MostWinningCell, new MostWinningCellAI(this.board));
            break;
          case HexPlayerType.Remote:
            this.players[i] = new HexPlayer(HexPlayerType.Remote);
            online = true;
            break;
          case HexPlayerType.Local:
            this.players[i] = new HexPlayer(HexPlayerType.Local);
            break;
        }
      }
    }

    if (online) {
      this.socket_connect(socket);
    } else {
      this.started = true;
    }

    const nextPlayer = this.players[this.currentPlayer];
    if (nextPlayer?.ai) {
      this.moveInterval = setTimeout(() => {
        if (this.options.reverse) {
          this.move((nextPlayer.ai as ReverseHexAI).getReverseHexMove(this.currentState, this.currentPlayer));
        } else {
          this.move((nextPlayer.ai as HexAI).getHexMove(this.currentState, this.currentPlayer));
        }
      }, 100);
    }
  }

  socket_connect(socket?: Socket) {
    if (!socket) {
      const url = new URL("/hex", this.options.serverAddress);
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
        message: `Game: ${this.options.reverse ? "Reverse " : ""}Hex\nWidth: ${this.options.width}\nHeigth: ${
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

    this.socket.on("move", (moveInfo: HexMoveInfo) => {
      if (
        moveInfo.player === this.currentPlayer &&
        this.options.playerTypes[moveInfo.player] === "remote" &&
        this.currentState.board[moveInfo.pos] === CellState.Empty
      ) {
        this.move(moveInfo.pos);
      } else {
        this.quit();
      }
    });

    this.socket.on("swap", () => {
      if (this.options.swapRule && this.history.length === 1) {
        this.swap();
      } else {
        this.quit;
      }
    });

    this.socket.on("message", (message: { source: string; message: string }) => {
      this.messages.push(message);
      this.onUpdateCallback(this);
    });
  }

  sendMessage(message: string) {
    if (this.socket && this.socket.connected && this.started) {
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
    if (this.started && !this.quited && this.win === undefined) {
      if (this.players[this.currentPlayer]?.type === HexPlayerType.Local) {
        if (pos >= 0 && pos < this.board.size) {
          if (this.currentState.board[pos] === CellState.Empty) {
            if (this.socket) {
              this.socket.emit("move", { player: this.currentPlayer, pos } as HexMoveInfo);
            }
            this.move(pos);
          }
        }
      }
    }
  }

  move(pos: number) {
    this.history.push({ pos, color: this.currentPlayer });
    const gameOver = this.board.move(this.currentState, this.currentPlayer, pos);
    if (gameOver) {
      if (this.options.reverse) {
        this.win = switchPlayer(this.currentPlayer);
      } else {
        this.win = this.currentPlayer;
      }
    }
    this.currentPlayer = switchPlayer(this.currentPlayer);
    this.onUpdateCallback(this);

    if (!gameOver) {
      const nextPlayer = this.players[this.currentPlayer];
      if (nextPlayer?.ai) {
        this.moveInterval = setTimeout(() => {
          if (this.options.reverse) {
            this.move((nextPlayer.ai as ReverseHexAI).getReverseHexMove(this.currentState, this.currentPlayer));
          } else {
            this.move((nextPlayer.ai as HexAI).getHexMove(this.currentState, this.currentPlayer));
          }
        }, 100);
      }
    }
  }

  local_swap() {
    if (this.started && !this.quited && this.win === undefined) {
      if (this.players[this.currentPlayer]?.type === HexPlayerType.Local) {
        if (this.options.swapRule && this.history.length === 1) {
          if (this.socket) {
            this.socket.emit("swap");
          }
          this.swap();
        }
      }
    }
  }

  swap() {
    const firstMove = this.history[0];
    const pos = firstMove.pos;
    this.currentState.board[pos] = CellState.Empty;
    const [x, y] = this.board.getXY(pos);
    const swapPos = this.board.getIndex(y, x);
    this.history.push({ pos: swapPos, color: this.currentPlayer, swap: true });
    this.board.move(this.currentState, this.currentPlayer, swapPos);
    this.currentPlayer = switchPlayer(this.currentPlayer);
    this.onUpdateCallback(this);
  }
}
