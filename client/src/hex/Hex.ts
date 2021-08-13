import { io, Socket } from "socket.io-client";

import { CellState, HexBoard, HexPlayerColor, switchPlayer } from "src/hex/HexBoard";
import type { HexAI, ReverseHexAI } from "src/hex/ai/BaseAI";
import { RandomAI } from "src/hex/ai/RandomAI";
import { MostWinningCellAI } from "src/hex/ai/MostWinningCellAI";
import { MCTSAI } from "src/hex/ai/MCTS";
import { MiaiAI } from "src/hex/ai/Miai";

export enum HexPlayerType {
  Local = "local",
  Remote = "remote",
  Random = "random",
  MostWinningCell = "most-winning-cell",
  MCTS = "mcts",
  Miai = "miai",
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

interface HexMoveInfo {
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

// class that manages an instance of a hex game
export class HexGame {
  // list of players to filled
  players: (HexPlayer | null)[] = Array(2).fill(null);

  hexBoard: HexBoard;
  currentState: Uint8Array;
  currentPlayer: HexPlayerColor;

  // called when the game makes an update and needs to sync state with svelte
  onUpdateCallback: (hexGame: HexGame) => void;

  history: {
    state: Uint8Array;
    last_player?: HexPlayerColor;
    last_move?: number;
    swap?: true;
    win?: HexPlayerColor | undefined;
  }[];
  messages: { source: string; message: string }[] = [];

  win: HexPlayerColor | undefined; // set when the game is won
  started = false; // set what the game has started
  quited = false; // set when is online and a player disconnects
  paused = false; // set when the pause button is pressed (only effects AI)
  loading = false; // set while AI is calculating move to prevent potential race condition

  socket?: Socket; // socket io instance (game is online if this is set)
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

    this.hexBoard = new HexBoard(width, height);
    this.currentState = new Uint8Array(this.hexBoard.size).fill(CellState.Empty);
    this.currentPlayer = HexPlayerColor.Black;

    this.history = [{ state: this.currentState.slice() }];

    let online = false;

    // set players from options
    if (this.options.reverse) {
      for (let i = 0; i < playerTypes.length; i++) {
        switch (playerTypes[i]) {
          case HexPlayerType.Random:
            this.players[i] = new HexPlayer(HexPlayerType.Random, new RandomAI(this.hexBoard));
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
            this.players[i] = new HexPlayer(HexPlayerType.Random, new RandomAI(this.hexBoard));
            break;
          case HexPlayerType.MostWinningCell:
            this.players[i] = new HexPlayer(HexPlayerType.MostWinningCell, new MostWinningCellAI(this.hexBoard));
            break;
          case HexPlayerType.MCTS:
            this.players[i] = new HexPlayer(HexPlayerType.MCTS, new MCTSAI(this.hexBoard));
            break;
          case HexPlayerType.Miai:
            this.players[i] = new HexPlayer(HexPlayerType.Miai, new MiaiAI(this.hexBoard));
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

    // next_play called in case the first player is AI
    this.next_play();
  }

  // sets up socket io and connects to server
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
        this.currentState[moveInfo.pos] === CellState.Empty
      ) {
        this.move(moveInfo.pos);
      } else {
        this.quit();
      }
    });

    this.socket.on("swap", () => {
      if (this.options.swapRule && this.history.length === 2) {
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

  // undo
  step_back() {
    if (!this.loading) {
      if (this.history.length >= 2) {
        this.history.pop();
        this.currentState = this.history[this.history.length - 1].state.slice();
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

  // called when a cell is clicked
  // checks validity of move and makes appropriate actions
  local_move(pos: number) {
    if (this.started && !this.quited && this.win === undefined) {
      if (this.players[this.currentPlayer]?.type === "local") {
        if (pos >= 0 && pos < this.hexBoard.size) {
          if (this.currentState[pos] === CellState.Empty) {
            if (this.socket) {
              this.socket.emit("move", { player: this.currentPlayer, pos } as HexMoveInfo);
            }
            this.move(pos);
          }
        }
      }
    }
  }

  // called when a move is to be made
  // this function assumes the move is valid
  // this function will check for a game over and if the next player is AI
  move(pos: number) {
    const gameOver = this.hexBoard.move(this.currentState, this.currentPlayer, pos);
    if (gameOver) {
      if (this.options.reverse) {
        this.win = switchPlayer(this.currentPlayer);
      } else {
        this.win = this.currentPlayer;
      }
    }
    this.history.push({
      state: this.currentState.slice(),
      last_player: this.currentPlayer,
      last_move: pos,
      win: this.win,
    });
    this.currentPlayer = switchPlayer(this.currentPlayer);
    this.onUpdateCallback(this);

    if (!this.paused) {
      this.next_play();
    }
  }

  // checks if AI is next play and makes a move accordingly
  next_play() {
    // timeout ensures svelte has time update the board before the next move is made
    setTimeout(async () => {
      if (this.win === undefined) {
        const nextPlayer = this.players[this.currentPlayer];
        if (nextPlayer?.ai) {
          let t1 = Date.now();
          let move;
          this.loading = true;
          if (this.options.reverse) {
            move = (nextPlayer.ai as ReverseHexAI).getReverseHexMove(this.currentState, this.currentPlayer);
          } else {
            move = (nextPlayer.ai as HexAI).getHexMove(this.currentState, this.currentPlayer);
          }
          // set minimum time of 100 ms for aesthetic reasons
          await new Promise((r) => setTimeout(r, 100 - (Date.now() - t1)));
          this.move(move);
          this.loading = false;
        }
      }
    }, 10);
  }

  // called when swap button pressed, checks validity of swap
  local_swap() {
    if (this.started && !this.quited && this.win === undefined) {
      if (this.players[this.currentPlayer]?.type === HexPlayerType.Local) {
        if (this.options.swapRule && this.history.length === 2) {
          if (this.socket) {
            this.socket.emit("swap");
          }
          this.swap();
        }
      }
    }
  }

  // swaps, assumes swap is valid
  swap() {
    const pos = this.history[1].last_move!;
    this.currentState[pos] = CellState.Empty;
    const [x, y] = this.hexBoard.getXY(pos);
    const swapPos = this.hexBoard.getIndex(y, x);
    this.hexBoard.move(this.currentState, this.currentPlayer, swapPos);
    this.history.push({
      state: this.currentState.slice(),
      last_player: this.currentPlayer,
      last_move: pos,
      swap: true,
    });
    this.currentPlayer = switchPlayer(this.currentPlayer);
    this.onUpdateCallback(this);
  }
}
