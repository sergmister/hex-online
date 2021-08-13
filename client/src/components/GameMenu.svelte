<script lang="ts">
  import { afterUpdate, beforeUpdate, createEventDispatcher } from "svelte";

  import { HexPlayerColor } from "src/hex/HexBoard";
  import { HexGame } from "src/hex/Hex";
  import type { DarkHexGame } from "src/hex/DarkHex";

  import { mcts_visualization } from "src/components/HexOnline.svelte";

  const dispatch = createEventDispatcher();

  export let currentGame: HexGame | DarkHexGame | undefined;

  let title: string;
  $: {
    if (currentGame) {
      if (currentGame.win !== undefined) {
        title = (currentGame.win === HexPlayerColor.White ? "Blue" : "Red") + " wins";
      } else if (currentGame.quited) {
        title = "Game ended";
      } else if (!currentGame.started) {
        title = "Waiting for game to start";
      } else if (currentGame.currentPlayer !== undefined) {
        title = (currentGame.currentPlayer === HexPlayerColor.White ? "Blue" : "Red") + "'s turn";
      }
    } else {
      title = "No game";
    }
  }

  $: {
    if (
      !(currentGame instanceof HexGame) ||
      (!(currentGame.options.playerTypes[0] === "mcts") && !(currentGame.options.playerTypes[1] === "mcts"))
    ) {
      mcts_visualization.set(false);
    }
  }

  let messageText: string;

  const onSwapClick = () => {
    dispatch("swap");
  };

  const sendMessage = () => {
    dispatch("sendMessage", messageText);
    messageText = "";
  };

  const handleMessageInputKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  };

  let chatMessagesDiv: HTMLDivElement;
  let autoscroll = false;

  // checks if messages are scrolled to the bottom
  beforeUpdate(() => {
    autoscroll =
      chatMessagesDiv && chatMessagesDiv.offsetHeight + chatMessagesDiv.scrollTop > chatMessagesDiv.scrollHeight - 10;
  });

  // auto scrolls if messages are scrolled to the bottom
  afterUpdate(() => {
    if (autoscroll) chatMessagesDiv.scrollTo(0, chatMessagesDiv.scrollHeight);
  });
</script>

<div class="container">
  <h2 class="title">{title}</h2>
  <div class="control-button-container">
    <button
      disabled={!currentGame || !!currentGame.socket}
      on:click={() => {
        currentGame?.step_back();
      }}
    >
      <svg viewBox="0 0 45.974 45.975" style="transform: scale(-1,1)">
        <path
          d="M9.629,44.68c-1.154,1.16-2.895,1.51-4.407,0.885c-1.513-0.623-2.5-2.1-2.5-3.735V4.043c0-1.637,0.987-3.112,2.5-3.736 c1.513-0.625,3.253-0.275,4.407,0.885l17.862,17.951c2.088,2.098,2.088,5.488,0,7.585L9.629,44.68z"
        />
        <path
          d="M38.252,45.975c-2.763,0-5-2.238-5-5V5c0-2.762,2.237-5,5-5c2.762,0,5,2.238,5,5v35.975 C43.252,43.736,41.013,45.975,38.252,45.975z"
        />
      </svg>
    </button>
    <button
      disabled={!currentGame || !!currentGame.socket}
      on:click={() => {
        if (currentGame) {
          if (currentGame.paused) {
            currentGame.play();
          } else {
            currentGame.pause();
          }
        }
      }}
    >
      {#if currentGame?.paused}
        <svg viewBox="0 0 460.114 460.114">
          <path
            d="M393.538,203.629L102.557,5.543c-9.793-6.666-22.468-7.372-32.94-1.832c-10.472,5.538-17.022,16.413-17.022,28.26v396.173 c0,11.846,6.55,22.721,17.022,28.26c10.471,5.539,23.147,4.834,32.94-1.832l290.981-198.087 c8.746-5.954,13.98-15.848,13.98-26.428C407.519,219.477,402.285,209.582,393.538,203.629z"
          />
        </svg>
      {:else}
        <svg viewBox="0 0 47.607 47.607">
          <path
            d="M17.991,40.976c0,3.662-2.969,6.631-6.631,6.631l0,0c-3.662,0-6.631-2.969-6.631-6.631V6.631C4.729,2.969,7.698,0,11.36,0 l0,0c3.662,0,6.631,2.969,6.631,6.631V40.976z"
          />
          <path
            d="M42.877,40.976c0,3.662-2.969,6.631-6.631,6.631l0,0c-3.662,0-6.631-2.969-6.631-6.631V6.631 C29.616,2.969,32.585,0,36.246,0l0,0c3.662,0,6.631,2.969,6.631,6.631V40.976z"
          />
        </svg>
      {/if}
    </button>
    <button
      disabled={!currentGame || !!currentGame.socket}
      on:click={() => {
        currentGame?.step_forward();
      }}
    >
      <svg width="45.974px" height="45.975px" viewBox="0 0 45.974 45.975">
        <path
          d="M9.629,44.68c-1.154,1.16-2.895,1.51-4.407,0.885c-1.513-0.623-2.5-2.1-2.5-3.735V4.043c0-1.637,0.987-3.112,2.5-3.736 c1.513-0.625,3.253-0.275,4.407,0.885l17.862,17.951c2.088,2.098,2.088,5.488,0,7.585L9.629,44.68z"
        />
        <path
          d="M38.252,45.975c-2.763,0-5-2.238-5-5V5c0-2.762,2.237-5,5-5c2.762,0,5,2.238,5,5v35.975 C43.252,43.736,41.013,45.975,38.252,45.975z"
        />
      </svg></button
    >
  </div>
  <div class="swap-button-container">
    <button
      on:click={onSwapClick}
      disabled={!(currentGame instanceof HexGame) ||
        !currentGame.options.swapRule ||
        currentGame.options.playerTypes[currentGame.currentPlayer] !== "local" ||
        currentGame.history.length !== 2}>Swap</button
    >
  </div>
  <div class="mcts-visualization-container">
    <label>
      MCTS Visualization
      <input
        type="checkbox"
        bind:checked={$mcts_visualization}
        disabled={!(currentGame instanceof HexGame) ||
          (!(currentGame.options.playerTypes[0] === "mcts") && !(currentGame.options.playerTypes[1] === "mcts"))}
      />
    </label>
  </div>
  <div class="chat-container">
    <div class="chat-messages" bind:this={chatMessagesDiv}>
      {#each currentGame?.messages || [] as { source, message }}
        {#if source === "link"}
          <div class="message message-game">Invite link: <a href={message} target="_blank">{message}</a></div>
        {:else if source === "game"}
          <div class="message message-game">{message}</div>
        {:else if (source === "blue" && currentGame?.options.playerTypes[1] === "local") || (source === "red" && currentGame?.options.playerTypes[0] === "local")}
          <div class="message message-local">{message}</div>
        {:else if (source === "blue" && currentGame?.options.playerTypes[1] === "remote") || (source === "red" && currentGame?.options.playerTypes[0] === "remote")}
          <div class="message message-remote">{message}</div>
        {:else}
          <div>{message}</div>
        {/if}
      {/each}
    </div>
    <div class="chat-box">
      <input type="text" bind:value={messageText} on:keydown={handleMessageInputKeydown} />
      <button on:click={sendMessage}>Send</button>
    </div>
  </div>
</div>

<style lang="scss">
  .container {
    grid-column: 3;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background-color: lightblue;
    padding: 0;
  }

  .title {
    text-align: center;
    font-size: 2.4em;
    margin: 0;
    padding-top: 1em;
    padding-bottom: 0.6em;
  }

  .control-button-container {
    display: flex;
    margin: 10px 20px;
    align-items: center;
    justify-content: space-evenly;

    button {
      width: 40px;
      height: 40px;

      svg {
        width: 100%;
        height: 100%;
      }
    }
  }

  .swap-button-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .mcts-visualization-container {
    margin-top: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .chat-container {
    margin-top: auto;
    flex: 0 0 400px;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background-color: white;
  }

  .chat-messages {
    flex: 1 0 120px;
    overflow-x: hidden;
    overflow-y: scroll;
    padding: 2px;
  }

  .message {
    margin: 5px;
    padding: 5px;
    border-radius: 6px;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .message-game {
    background-color: rgb(201, 161, 161);
  }

  .message-local {
    background-color: rgb(146, 174, 200);
  }

  .message-remote {
    background-color: rgb(175, 175, 175);
  }

  .chat-box {
    flex: 0 0 36px;
    width: 100%;
    display: flex;
    justify-content: flex-start;

    input {
      flex: 1 0 0;
      height: 100%;
      margin: 0;
      border-radius: 0px;
      border: 1px solid black;

      &:focus {
        outline: none;
      }
    }

    button {
      flex: 0 0 40px;
      height: 100%;
      margin: 0;
      border-radius: 0px;
      border: 1px solid black;
    }
  }
</style>
