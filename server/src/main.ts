import http from "http";
import express from "express";
import { URL } from "url";
import { Server } from "socket.io";
import crypto from "crypto";
import {
  validate,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsEnum,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayContains,
} from "class-validator";
import { plainToClass } from "class-transformer";

import { HexPlayerColor, switchPlayer } from "src/hex/HexBoard";
import { HexGame, HexGameOptions, HexMoveInfo, HexPlayer } from "src/hex/Hex";
import { DarkHexGame } from "src/hex/DarkHex";

const PORT = process.env.PORT || 4322;

const app = express();
const httpServer = http.createServer(app);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  connectTimeout: 10000,
  pingTimeout: 10000,
});

class HexGameOptionsDto implements HexGameOptions {
  @IsInt()
  @Min(2)
  @Max(32)
  width!: number;

  @IsInt()
  @IsInt()
  @Min(2)
  @Max(32)
  height!: number;

  @IsBoolean()
  reverse!: boolean;

  @IsBoolean()
  swapRule!: boolean;

  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @ArrayContains(["local", "remote"])
  playerTypes!: string[];

  @IsString()
  serverAddress!: string;
}

class HexMoveInfoDto implements HexMoveInfo {
  @IsInt()
  @IsEnum(HexPlayerColor)
  player!: HexPlayerColor;

  @IsInt()
  pos!: number;
}

class MessageDto {
  @IsString()
  source!: string;

  @IsString()
  message!: string;
}

// map of current hex games
const hexGames: Map<string, HexGame> = new Map();

io.of("hex").on("connection", async (socket) => {
  console.log("socket connected!");

  let ownedGameID: string | null = null; // set when a player has joined a game
  let thisGame: HexGame | null = null; // game instance
  let thisPlayer: HexPlayer | null = null; // player instance

  socket.once("disconnect", (reason) => {
    console.log(`a user disconnected: ${reason}`);
    if (thisGame && thisPlayer) {
      thisGame.quit();
    }
    thisGame = null;
    thisPlayer = null;
    // remove game if player is a member
    if (ownedGameID) {
      hexGames.delete(ownedGameID);
    }
  });

  // lots a data validation
  if (typeof socket.handshake.query.gameid === "string") {
    // joining game
    thisGame = hexGames.get(socket.handshake.query.gameid) || null;
    if (thisGame) {
      thisPlayer = thisGame.join(socket, {});
      if (thisPlayer) {
        ownedGameID = socket.handshake.query.gameid;
        socket.emit("joined", {
          ...thisGame.options,
          dark: false,
          playerTypes: [
            thisPlayer.color === HexPlayerColor.Black ? "local" : "remote",
            thisPlayer.color === HexPlayerColor.White ? "local" : "remote",
          ],
        });
        thisGame.start();
      }
    }
  } else {
    if (typeof socket.handshake.query.options === "string") {
      // creating a game
      let hexGameOptions;
      try {
        hexGameOptions = JSON.parse(socket.handshake.query.options);
      } catch {}
      const hexGameOptionsDto = plainToClass(HexGameOptionsDto, hexGameOptions);
      // validate options
      const errors = await validate(hexGameOptionsDto, { forbidUnknownValues: true });
      if (errors.length === 0) {
        let selectedColor: HexPlayerColor | undefined;
        // remote & local game options
        if (hexGameOptionsDto.playerTypes[0] === "local" && hexGameOptionsDto.playerTypes[1] === "remote") {
          selectedColor = HexPlayerColor.Black;
        } else if (hexGameOptionsDto.playerTypes[0] === "remote" && hexGameOptionsDto.playerTypes[1] === "local") {
          selectedColor = HexPlayerColor.White;
        }
        if (selectedColor !== undefined) {
          thisGame = new HexGame(hexGameOptionsDto);
          thisPlayer = thisGame.join(socket, { color: selectedColor });
          ownedGameID = crypto.randomBytes(12).toString("hex");
          hexGames.set(ownedGameID, thisGame);
          try {
            // invite link
            const url = new URL(socket.handshake.headers.origin!);
            url.searchParams.set("game", "hex");
            url.searchParams.set("gameid", ownedGameID);
            url.searchParams.set("serverAddress", encodeURIComponent(hexGameOptionsDto.serverAddress));
            socket.emit("joined", url.toString());
          } catch {}
        }
      }
    }
  }

  if (thisGame && thisPlayer) {
    socket.on("move", async (hexMoveInfo) => {
      if (thisGame && thisGame.currentPlayer === thisPlayer!.color) {
        const hexMoveInfoDto = plainToClass(HexMoveInfoDto, hexMoveInfo);
        const errors = await validate(hexMoveInfoDto, { forbidUnknownValues: true });
        if (errors.length === 0 && hexMoveInfoDto.player === thisPlayer!.color) {
          if (thisGame && thisGame.move(thisPlayer!.color, hexMoveInfoDto.pos)) {
            return;
          }
        }
      }
      socket.disconnect();
    });

    socket.on("swap", async () => {
      if (thisGame && thisGame.currentPlayer === thisPlayer!.color) {
        if (thisGame.swap()) {
          return;
        }
      }
      socket.disconnect();
    });

    socket.on("message", async (message) => {
      const messageDto = plainToClass(MessageDto, message);
      const errors = await validate(messageDto, { forbidUnknownValues: true });
      if (thisGame && thisGame.started && errors.length === 0) {
        thisGame.players[switchPlayer(thisPlayer!.color)]?.socket.emit("message", {
          source: thisPlayer!.color === HexPlayerColor.Black ? "red" : "blue",
          message: messageDto.message,
        });
      }
    });
  } else {
    // if player didn't join or create a game disconnect socket
    socket.disconnect();
  }
});

const darkHexGames: Map<string, DarkHexGame> = new Map();

// lots of code duplication for simplicity
io.of("darkhex").on("connection", async (socket) => {
  console.log("socket connected!");

  let ownedGameID: string | null = null;
  let thisGame: DarkHexGame | null = null;
  let thisPlayer: HexPlayer | null = null;

  socket.once("disconnect", (reason) => {
    console.log(`a user disconnected: ${reason}`);
    if (thisGame && thisPlayer) {
      thisGame.quit();
    }
    thisGame = null;
    thisPlayer = null;
    if (ownedGameID) {
      darkHexGames.delete(ownedGameID);
    }
  });

  if (typeof socket.handshake.query.gameid === "string") {
    thisGame = darkHexGames.get(socket.handshake.query.gameid) || null;
    if (thisGame) {
      thisPlayer = thisGame.join(socket, {});
      if (thisPlayer) {
        ownedGameID = socket.handshake.query.gameid;
        socket.emit("joined", {
          ...thisGame.options,
          dark: false,
          playerTypes: [
            thisPlayer.color === HexPlayerColor.Black ? "local" : "remote",
            thisPlayer.color === HexPlayerColor.White ? "local" : "remote",
          ],
        });
        thisGame.start();
      }
    }
  } else {
    if (typeof socket.handshake.query.options === "string") {
      let hexGameOptions;
      try {
        hexGameOptions = JSON.parse(socket.handshake.query.options);
      } catch {}
      const hexGameOptionsDto = plainToClass(HexGameOptionsDto, hexGameOptions);
      const errors = await validate(hexGameOptionsDto, { forbidUnknownValues: true });
      if (errors.length === 0) {
        let selectedColor: HexPlayerColor | undefined;
        if (hexGameOptionsDto.playerTypes[0] === "local" && hexGameOptionsDto.playerTypes[1] === "remote") {
          selectedColor = HexPlayerColor.Black;
        } else if (hexGameOptionsDto.playerTypes[0] === "remote" && hexGameOptionsDto.playerTypes[1] === "local") {
          selectedColor = HexPlayerColor.White;
        }
        if (selectedColor !== undefined) {
          thisGame = new DarkHexGame(hexGameOptionsDto);
          thisPlayer = thisGame.join(socket, { color: selectedColor });
          ownedGameID = crypto.randomBytes(12).toString("hex");
          darkHexGames.set(ownedGameID, thisGame);
          try {
            const url = new URL(socket.handshake.headers.origin!);
            url.searchParams.set("game", "darkhex");
            url.searchParams.set("gameid", ownedGameID);
            url.searchParams.set("serverAddress", encodeURIComponent(hexGameOptionsDto.serverAddress));
            socket.emit("joined", url.toString());
          } catch {}
        }
      }
    }
  }

  if (thisGame && thisPlayer) {
    socket.on("move", async (hexMoveInfo) => {
      if (thisGame && thisGame.currentPlayer === thisPlayer!.color) {
        const hexMoveInfoDto = plainToClass(HexMoveInfoDto, hexMoveInfo);
        const errors = await validate(hexMoveInfoDto, { forbidUnknownValues: true });
        if (errors.length === 0 && hexMoveInfoDto.player === thisPlayer!.color) {
          if (thisGame && thisGame.move(thisPlayer!.color, hexMoveInfoDto.pos)) {
            return;
          }
        }
      }
      socket.disconnect();
    });

    socket.on("message", async (message) => {
      const messageDto = plainToClass(MessageDto, message);
      const errors = await validate(messageDto, { forbidUnknownValues: true });
      if (thisGame && thisGame.started && errors.length === 0) {
        thisGame.players[switchPlayer(thisPlayer!.color)]?.socket.emit("message", {
          source: thisPlayer!.color === HexPlayerColor.Black ? "red" : "blue",
          message: messageDto.message,
        });
      }
    });
  } else {
    socket.disconnect();
  }
});

httpServer.listen(PORT, () => {
  console.log(`server is listening on port ${PORT}`);
});
