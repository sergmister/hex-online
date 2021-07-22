import http from "http";
import express from "express";
import { URL } from "url";
import { Server, Socket } from "socket.io";
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
const baseURL = `http://localhost:${PORT}`;
export const CLIENT_URL = "http://localhost:5000/";

const app = express();
const httpServer = http.createServer(app);

app.use(express.json());

export const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5000",
    methods: ["GET", "POST"],
  },
  connectTimeout: 10000,
  pingTimeout: 10000,
  // path: "",
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

const hexGames: Map<string, HexGame> = new Map();

io.of("hex").on("connection", async (socket) => {
  // console.log("socket connected!");

  let ownedGameID: string | null = null;
  let thisGame: HexGame | null = null;
  let thisPlayer: HexPlayer | null = null;

  socket.once("disconnect", (reason) => {
    // console.log(`a user disconnected: ${reason}`);
    if (thisGame && thisPlayer) {
      thisGame.quit();
    }
    thisGame = null;
    thisPlayer = null;
    if (ownedGameID) {
      hexGames.delete(ownedGameID);
    }
  });

  if (typeof socket.handshake.query.gameid === "string") {
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
          thisGame = new HexGame(hexGameOptionsDto);
          thisPlayer = thisGame.join(socket, { color: selectedColor });
          ownedGameID = crypto.randomBytes(12).toString("base64url");
          hexGames.set(ownedGameID, thisGame);
          const url = new URL(CLIENT_URL);
          url.searchParams.set("game", "hex");
          url.searchParams.set("gameid", ownedGameID);
          socket.emit("joined", url.toString());
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
    socket.disconnect();
  }
});

const darkHexGames: Map<string, DarkHexGame> = new Map();

io.of("darkhex").on("connection", async (socket) => {
  // console.log("socket connected!");

  let ownedGameID: string | null = null;
  let thisGame: DarkHexGame | null = null;
  let thisPlayer: HexPlayer | null = null;

  socket.once("disconnect", (reason) => {
    // console.log(`a user disconnected: ${reason}`);
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
          ownedGameID = crypto.randomBytes(12).toString("base64url");
          darkHexGames.set(ownedGameID, thisGame);
          const url = new URL(CLIENT_URL);
          url.searchParams.set("game", "darkhex");
          url.searchParams.set("gameid", ownedGameID);
          socket.emit("joined", url.toString());
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

httpServer.listen(PORT);
