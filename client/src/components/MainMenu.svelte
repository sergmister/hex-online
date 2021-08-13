<script lang="ts" context="module">
  export interface HexMenuOptions {
    dark: boolean;
    reverse: boolean;
    width: number;
    height: number;
    swapRule: boolean;
    playerTypes: (HexPlayerType | DarkHexPlayerType | ReverseHexPlayerType | DarkReverseHexPlayerType)[];
    serverAddress: string;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { HexPlayerType, ReverseHexPlayerType } from "src/hex/Hex";
  import { DarkHexPlayerType, DarkReverseHexPlayerType } from "src/hex/DarkHex";

  const dispatch = createEventDispatcher();

  enum HexGames {
    Hex = "hex",
    DarkHex = "dark hex",
    ReverseHex = "reverse hex",
    DarkReverseHex = "dark reverse hex",
  }

  let hexGame: HexGames = HexGames.Hex;

  let options: HexMenuOptions = {
    dark: false,
    reverse: false,
    width: 5,
    height: 5,
    swapRule: false,
    playerTypes: [HexPlayerType.Local, HexPlayerType.Local],
    serverAddress: "http://localhost:4322",
  };

  let playerTypeEnum:
    | typeof HexPlayerType
    | typeof DarkHexPlayerType
    | typeof ReverseHexPlayerType
    | typeof DarkReverseHexPlayerType = HexPlayerType;

  $: {
    if (options.width !== options.height || options.dark) {
      options.swapRule = false;
    }
  }

  $: {
    switchHexGame(hexGame);
  }

  const switchHexGame = (hexGame: HexGames) => {
    switch (hexGame) {
      case HexGames.Hex:
        playerTypeEnum = HexPlayerType;
        options.playerTypes = [HexPlayerType.Local, HexPlayerType.Local];
        options.dark = false;
        options.reverse = false;
        break;
      case HexGames.DarkHex:
        playerTypeEnum = DarkHexPlayerType;
        options.playerTypes = [DarkHexPlayerType.Local, DarkHexPlayerType.Local];
        options.dark = true;
        options.reverse = false;
        break;
      case HexGames.ReverseHex:
        playerTypeEnum = ReverseHexPlayerType;
        options.playerTypes = [ReverseHexPlayerType.Local, ReverseHexPlayerType.Local];
        options.dark = false;
        options.reverse = true;
        break;
      case HexGames.DarkReverseHex:
        playerTypeEnum = DarkReverseHexPlayerType;
        options.playerTypes = [DarkReverseHexPlayerType.Local, DarkReverseHexPlayerType.Local];
        options.dark = true;
        options.reverse = true;
        break;
    }
  };

  const onSubmit = () => {
    if (
      (options.playerTypes[0] !== "remote" && options.playerTypes[1] !== "remote") ||
      (options.playerTypes[0] === "local" && options.playerTypes[1] === "remote") ||
      (options.playerTypes[1] === "local" && options.playerTypes[0] === "remote")
    ) {
      dispatch("submit", options);
    } else {
      alert("You must have one local and one remote");
    }
  };
</script>

<div class="container">
  <h2>Hex Online</h2>
  <form on:submit|preventDefault={onSubmit}>
    <select bind:value={hexGame}>
      <option value="hex">Hex</option>
      <option value="dark hex" title="Players cannot see each others moves"> Dark Hex </option>
      <option value="reverse hex" title="First player to connect their sides loses"> Reverse Hex </option>
      <option value="dark reverse hex" title="Dark Hex + Reverse Hex"> Dark Reverse Hex </option>
    </select>

    <label>
      Width
      <input type="number" bind:value={options.width} min="2" max="32" />
    </label>

    <label>
      Height
      <input type="number" bind:value={options.height} min="2" max="32" />
    </label>

    <label>
      Swap rule
      <input
        type="checkbox"
        bind:checked={options.swapRule}
        disabled={options.width !== options.height || options.dark}
      />
    </label>

    <label
      >Player red
      <select bind:value={options.playerTypes[0]}>
        {#each Object.values(playerTypeEnum) as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </label>

    <label
      >Player blue
      <select bind:value={options.playerTypes[1]}>
        {#each Object.values(playerTypeEnum) as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </label>

    <label
      >Server address
      <input type="text" bind:value={options.serverAddress} />
    </label>

    <button type="submit">New game</button>
  </form>
</div>

<style lang="scss">
  .container {
    grid-column: 1;
    background-color: lightblue;

    h2 {
      text-align: center;
      font-size: 2.4em;
      margin: 0;
      padding-top: 1em;
      padding-bottom: 0.5em;
    }

    form {
      padding: 20px;

      * {
        margin-top: 2px;
      }
    }
  }
</style>
