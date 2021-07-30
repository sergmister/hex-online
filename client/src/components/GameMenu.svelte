<script lang="ts">
  import { afterUpdate, beforeUpdate, createEventDispatcher } from "svelte";

  import { HexGame } from "src/hex/Hex";
  import type { DarkHexGame } from "src/hex/DarkHex";
  import { HexPlayerColor } from "src/hex/HexBoard";
  import { select_options } from "svelte/internal";

  export let currentGame: HexGame | DarkHexGame | undefined;

  const dispatch = createEventDispatcher();

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

  let text: string;

  const onSwapClick = () => {
    dispatch("swap");
  };

  const sendMessage = () => {
    dispatch("sendMessage", text);
    text = "";
  };

  const handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  };

  let chatMessagesDiv: HTMLDivElement;
  let autoscroll = false;

  beforeUpdate(() => {
    autoscroll =
      chatMessagesDiv && chatMessagesDiv.offsetHeight + chatMessagesDiv.scrollTop > chatMessagesDiv.scrollHeight - 10;
  });

  afterUpdate(() => {
    if (autoscroll) chatMessagesDiv.scrollTo(0, chatMessagesDiv.scrollHeight);
  });
</script>

<div class="container">
  <h2 class="title">{title}</h2>
  <div class="swap-button-container">
    <button
      on:click={onSwapClick}
      disabled={!(currentGame instanceof HexGame) ||
        !currentGame.options.swapRule ||
        currentGame.options.playerTypes[currentGame.currentPlayer] !== "local" ||
        currentGame.history.length !== 1}>Swap</button
    >
  </div>
  <div class="chat-container">
    <div class="chat-messages" bind:this={chatMessagesDiv}>
      {#each currentGame?.messages || [] as { source, message }}
        {#if source === "link"}
          <div class="message-game">Invite link: <a href={message} target="_blank">{message}</a></div>
        {:else if source === "game"}
          <div class="message-game">{message}</div>
        {:else if (source === "blue" && currentGame?.options.playerTypes[1] === "local") || (source === "red" && currentGame?.options.playerTypes[0] === "local")}
          <div class="message-local">{message}</div>
        {:else if (source === "blue" && currentGame?.options.playerTypes[1] === "remote") || (source === "red" && currentGame?.options.playerTypes[0] === "remote")}
          <div class="message-remote">{message}</div>
        {:else}
          <div>{message}</div>
        {/if}
      {/each}
    </div>
    <div class="chat-box">
      <input type="text" bind:value={text} on:keydown={handleInputKeydown} />
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
    /* align-items: center; */
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

  .swap-button-container {
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

  .message-game {
    margin: 5px;
    padding: 5px;
    border-radius: 6px;
    background-color: rgb(201, 161, 161);
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .message-local {
    margin: 5px;
    padding: 5px;
    border-radius: 6px;
    background-color: rgb(146, 174, 200);
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .message-remote {
    margin: 5px;
    padding: 5px;
    border-radius: 6px;
    background-color: rgb(175, 175, 175);
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .chat-box {
    flex: 0 0 36px;
    width: 100%;
    display: flex;
    justify-content: flex-start;

    input {
      flex: 1 0 0;
      height: 100%;
      border-radius: 0px;
      border: 1px solid black;

      &:focus {
        outline: none;
      }
    }

    button {
      flex: 0 0 40px;
      height: 100%;
      border-radius: 0px;
      border: 1px solid black;
    }
  }
</style>
