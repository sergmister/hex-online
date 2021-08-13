<script lang="ts" context="module">
  import { writable } from "svelte/store";

  export const mcts_visualization = writable(false);
</script>

<script lang="ts">
  import { onMount } from "svelte";

  import { io, Socket } from "socket.io-client";

  import type { HexPlayerType, ReverseHexPlayerType } from "src/hex/Hex";
  import type { DarkHexPlayerType, DarkReverseHexPlayerType } from "src/hex/DarkHex";
  import { MCTSAI, Node } from "src/hex/ai/MCTS";
  import { switchPlayer } from "src/hex/HexBoard";
  import { HexGame } from "src/hex/Hex";
  import { DarkHexGame } from "src/hex/DarkHex";

  import type { HexMenuOptions } from "src/components/MainMenu.svelte";
  import MainMenu from "src/components/MainMenu.svelte";
  import HexBoard from "src/components/HexBoard.svelte";
  import GameMenu from "src/components/GameMenu.svelte";
  import MCTSVisualization from "src/components/MCTSVisualization.svelte";

  let currentGame: HexGame | DarkHexGame | undefined;
  let lastState: Uint8Array = new Uint8Array(0);

  let mcts_data: any = undefined;

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const game = params.get("game");
    const gameid = params.get("gameid");
    const serverAddress = params.get("serverAddress");
    params.delete("game");
    params.delete("gameid");
    params.delete("serverAddress");

    window.history.replaceState("", "", "?" + params.toString());

    if (game && gameid && serverAddress) {
      hexConnect(game, gameid, decodeURIComponent(serverAddress));
    }
  });

  const hexConnect = (game: string, gameid: string, serverAddress: string) => {
    const url = new URL(game, serverAddress);
    const socket = io(url.toString(), {
      query: { gameid: gameid },
      reconnection: false,
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
      let ai = hexGame.players[switchPlayer(hexGame.currentPlayer)]!.ai;
      if (ai instanceof MCTSAI) {
        mcts_data = ai.rootNode;
      } else {
        mcts_data = {};
      }
    } else {
      if (hexGame.win !== undefined) {
        lastState = hexGame.currentState!;
      } else {
        if (hexGame.options.playerTypes[hexGame.currentPlayer] === "local") {
          lastState = hexGame.visibleBoards[hexGame.currentPlayer]!;
        } else if (hexGame.options.playerTypes[switchPlayer(hexGame.currentPlayer)] === "local") {
          lastState = hexGame.visibleBoards[switchPlayer(hexGame.currentPlayer)]!;
        } else {
          lastState = hexGame.currentState!;
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
    boardWidth={currentGame?.hexBoard.width || 0}
    boardHeight={currentGame?.hexBoard.height || 0}
    hexState={lastState}
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

{#if $mcts_visualization}
  <MCTSVisualization
    data={mcts_data || {}}
    boardWidth={currentGame?.hexBoard.width || 5}
    boardHeight={currentGame?.hexBoard.height || 5}
  />
{/if}

<a
  href="https://github.com/sergmister/hex-online"
  target="_blank"
  class="github-corner"
  aria-label="View source on GitHub"
  ><svg
    width="80"
    height="80"
    viewBox="0 0 250 250"
    style="fill:#fff; color:#151513; position: absolute; top: 0; border: 0; right: 0;"
    aria-hidden="true"
    ><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" /><path
      d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
      fill="currentColor"
      style="transform-origin: 130px 106px;"
      class="octo-arm"
    /><path
      d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
      fill="currentColor"
      class="octo-body"
    />
  </svg>
</a>

<style lang="scss">
  .gameui {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) minmax(320px, 4fr) minmax(280px, 1fr);
    grid-template-rows: 100vh;
  }

  /* responsive design */
  @media (max-width: 880px) {
    .gameui {
      display: block;
    }
  }

  .github-corner:hover .octo-arm {
    animation: octocat-wave 560ms ease-in-out;
  }
  @keyframes octocat-wave {
    0%,
    100% {
      transform: rotate(0);
    }
    20%,
    60% {
      transform: rotate(-25deg);
    }
    40%,
    80% {
      transform: rotate(10deg);
    }
  }
  @media (max-width: 500px) {
    .github-corner:hover .octo-arm {
      animation: none;
    }
    .github-corner .octo-arm {
      animation: octocat-wave 560ms ease-in-out;
    }
  }
</style>
