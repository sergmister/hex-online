<script lang="ts">
  import { onMount } from "svelte";
  import { io, Socket } from "socket.io-client";

  import { SERVER_URL } from "src/hex/communication";
  import type { HexPlayerColor } from "src/hex/HexBoard";
  import type { HexPlayerType, ReverseHexPlayerType } from "src/hex/Hex";
  import type { DarkHexPlayerType, DarkReverseHexPlayerType } from "src/hex/DarkHex";
  import { HexState, switchPlayer } from "src/hex/HexBoard";
  import { HexGame } from "src/hex/Hex";
  import { DarkHexGame } from "src/hex/DarkHex";

  import type { HexMenuOptions } from "src/components/MainMenu.svelte";
  import MainMenu from "src/components/MainMenu.svelte";
  import HexBoard from "src/components/HexBoard.svelte";
  import GameMenu from "src/components/GameMenu.svelte";

  let currentGame: HexGame | DarkHexGame | undefined;
  let lastState: HexState | undefined;

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const game = params.get("game");
    const gameid = params.get("gameid");
    params.delete("game");
    params.delete("gameid");
    window.history.replaceState("", "", "?" + params.toString());

    if (game && gameid) {
      hexConnect(game, gameid);
    }
  });

  const hexConnect = (game: string, gameid: string) => {
    const socket = io(SERVER_URL + game, {
      query: { gameid: gameid },
      reconnection: false,
      path: "/socket.io",
    });

    socket.on("joined", (options: HexMenuOptions) => {
      if (game === "hex") {
        options.dark = false;
      } else if (game === "darkhex") {
        options.dark = true;
      }
      newGame(options, socket);
    });
  };

  const newGame = (options: HexMenuOptions, socket?: Socket) => {
    if (currentGame) {
      if (currentGame.win === undefined && !currentGame.quited) {
        if (!window.confirm("Do you want to stop the current the game?")) {
          return;
        }
      }
      currentGame.quit();
    }

    if (options.dark) {
      currentGame = new DarkHexGame(
        { ...options, playerTypes: options.playerTypes as (DarkHexPlayerType | DarkReverseHexPlayerType)[] },
        onHexGameUpdate,
        socket,
      );
    } else {
      currentGame = new HexGame(
        { ...options, playerTypes: options.playerTypes as (HexPlayerType | ReverseHexPlayerType)[] },
        onHexGameUpdate,
        socket,
      );
    }

    onHexGameUpdate(currentGame);
  };

  const onHexBoardClick = (event: CustomEvent<number>) => {
    currentGame?.local_move(event.detail);
  };

  const onHexGameUpdate = (hexGame: HexGame | DarkHexGame) => {
    currentGame = hexGame;
    if (hexGame instanceof HexGame) {
      lastState = hexGame.currentState;
    } else {
      if (hexGame.win !== undefined) {
        lastState = hexGame.currentState;
      } else {
        if (hexGame.options.playerTypes[hexGame.currentPlayer] === "local") {
          lastState = { board: hexGame.visibleBoards[hexGame.currentPlayer]! };
        } else if (hexGame.options.playerTypes[switchPlayer(hexGame.currentPlayer)] === "local") {
          lastState = { board: hexGame.visibleBoards[switchPlayer(hexGame.currentPlayer)]! };
        } else {
          lastState = hexGame.currentState;
        }
      }
    }
  };

  const sendMessage = (event: CustomEvent<string>) => {
    if (currentGame) {
      currentGame.sendMessage(event.detail);
    }
  };
</script>

<div class="gameui">
  <MainMenu
    on:submit={(event) => {
      newGame(event.detail);
    }}
  />
  <HexBoard
    boardWidth={currentGame?.board.width || 0}
    boardHeight={currentGame?.board.height || 0}
    hexState={lastState || new HexState(0)}
    on:cellClick={onHexBoardClick}
  />
  <GameMenu
    {currentGame}
    on:swap={() => {
      if (currentGame instanceof HexGame) {
        currentGame.local_swap();
      }
    }}
    on:sendMessage={sendMessage}
  />
</div>

<style lang="scss">
  .gameui {
    display: flex;
    height: 100vh;
    justify-content: flex-start;
    align-items: center;
    overflow: auto;

    &::before,
    &::after {
      content: "";
      margin: auto;
    }
  }
</style>
