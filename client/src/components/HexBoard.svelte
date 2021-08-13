<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { CellState } from "src/hex/HexBoard";
  import { onDestroy, onMount } from "svelte";

  const dispatch = createEventDispatcher();

  type HexBoardCell = {
    state: CellState;
    canvasX: number;
    canvasY: number;
  };

  // red = black
  // blue = white

  const SQRT3 = Math.sqrt(3);
  const SQRT3_2 = Math.sqrt(3) / 2;
  const HEXAGON_OFFSETS: { x: number; y: number }[] = [
    { x: 0, y: 1 / SQRT3 }, // top
    { x: 0.5, y: 0.5 / SQRT3 }, // top right
    { x: 0.5, y: -0.5 / SQRT3 }, // bottom right
    { x: 0, y: -1 / SQRT3 }, // bottom
    { x: -0.5, y: -0.5 / SQRT3 }, // bottem left
    { x: -0.5, y: 0.5 / SQRT3 }, // top left
  ];

  export let boardWidth: number;
  export let boardHeight: number;
  export let hexState: Uint8Array;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | undefined;

  let cellSize: number;
  let cells: HexBoardCell[];
  let backgroundColor = "lightgray";
  let resizeObserver: ResizeObserver;

  onMount(() => {
    ctx = canvas.getContext("2d")!;
    resizeObserver = new ResizeObserver(() => {
      update(boardWidth, boardHeight);
    });
    resizeObserver.observe(canvas);
  });

  onDestroy(() => {
    resizeObserver.disconnect();
  });

  $: {
    update(boardWidth, boardHeight);
  }

  $: {
    partialUpdate(hexState);
  }

  const update = (boardWidth: number, boardHeight: number) => {
    if (ctx) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      cells = Array(boardWidth * boardHeight)
        .fill(0)
        .map((u, i) => ({ state: hexState[i], canvasX: 0, canvasY: 0 }));
      cellSize = Math.min(canvas.width / (boardWidth + boardHeight / 2), canvas.height / (boardHeight * SQRT3_2 + 1));
      calculateCellCenters();
      redrawBoard(ctx);
    }
  };

  const partialUpdate = (hexState: Uint8Array) => {
    if (ctx) {
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].state !== hexState[i]) {
          updateCellState(ctx, i, hexState[i]);
        }
      }
    }
  };

  const getIndex = (x: number, y: number) => {
    return y * boardWidth + x;
  };

  const calculateCellCenters = () => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        const xoffset = x - (boardWidth - 1) / 2;
        const yoffset = y - (boardHeight - 1) / 2;
        const cell = cells[getIndex(x, y)];
        cell.canvasX = centerX + cellSize * xoffset + (cellSize * yoffset) / 2;
        cell.canvasY = centerY + SQRT3_2 * cellSize * yoffset;
      }
    }
  };

  const getClickedCell = (clickX: number, clickY: number): number | null => {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (Math.hypot(cell.canvasX - clickX, cell.canvasY - clickY) < cellSize / 2 - 1) {
        return i;
      }
    }
    return null;
  };

  const onCanvasClick = (event: MouseEvent) => {
    event.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pos = getClickedCell(x, y);
    if (pos !== null) {
      dispatch("cellClick", pos);
    }
  };

  const updateCellState = (ctx: CanvasRenderingContext2D, pos: number, state: CellState) => {
    const cell = cells[pos];
    cell.state = state;

    ctx.beginPath();
    ctx.arc(cell.canvasX, cell.canvasY, cellSize / 3 + 2, 0, 2 * Math.PI);
    ctx.fillStyle = backgroundColor;
    ctx.fill();

    drawCell(ctx, cell);
  };

  const drawCell = (ctx: CanvasRenderingContext2D, cell: HexBoardCell) => {
    let color: string;
    switch (cell.state) {
      case CellState.Black:
      case CellState.BlackNorth:
      case CellState.BlackSouth:
      case CellState.BlackWin:
        color = "red";
        break;
      case CellState.White:
      case CellState.WhiteEast:
      case CellState.WhiteWest:
      case CellState.WhiteWin:
        color = "blue";
        break;
      default:
        color = backgroundColor;
    }

    ctx.beginPath();
    ctx.arc(cell.canvasX, cell.canvasY, 0.33 * cellSize, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  };

  const drawHexagonEdges = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = "round";

    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        const { canvasX: hx, canvasY: hy } = cells[getIndex(x, y)];

        ctx.beginPath();
        ctx.moveTo(hx + cellSize * HEXAGON_OFFSETS[0].x, hy + cellSize * HEXAGON_OFFSETS[0].y);
        ctx.lineTo(hx + cellSize * HEXAGON_OFFSETS[1].x, hy + cellSize * HEXAGON_OFFSETS[1].y);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        if (y === boardHeight - 1) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 3;
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hx + cellSize * HEXAGON_OFFSETS[1].x, hy + cellSize * HEXAGON_OFFSETS[1].y);
        ctx.lineTo(hx + cellSize * HEXAGON_OFFSETS[2].x, hy + cellSize * HEXAGON_OFFSETS[2].y);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        if (x === boardWidth - 1) {
          ctx.strokeStyle = "blue";
          ctx.lineWidth = 3;
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hx + cellSize * HEXAGON_OFFSETS[2].x, hy + cellSize * HEXAGON_OFFSETS[2].y);
        ctx.lineTo(hx + cellSize * HEXAGON_OFFSETS[3].x, hy + cellSize * HEXAGON_OFFSETS[3].y);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        if (x === boardWidth - 1 && y > 0) {
          ctx.strokeStyle = "blue";
          ctx.lineWidth = 3;
        }
        if (y < 1) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 3;
        }

        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hx + cellSize * HEXAGON_OFFSETS[3].x, hy + cellSize * HEXAGON_OFFSETS[3].y);
        ctx.lineTo(hx + cellSize * HEXAGON_OFFSETS[4].x, hy + cellSize * HEXAGON_OFFSETS[4].y);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        if (y < 1) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 3;
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hx + cellSize * HEXAGON_OFFSETS[4].x, hy + cellSize * HEXAGON_OFFSETS[4].y);
        ctx.lineTo(hx + cellSize * HEXAGON_OFFSETS[5].x, hy + cellSize * HEXAGON_OFFSETS[5].y);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        if (x === 0) {
          ctx.strokeStyle = "blue";
          ctx.lineWidth = 3;
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hx + cellSize * HEXAGON_OFFSETS[5].x, hy + cellSize * HEXAGON_OFFSETS[5].y);
        ctx.lineTo(hx + cellSize * HEXAGON_OFFSETS[0].x, hy + cellSize * HEXAGON_OFFSETS[0].y);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        if (x === 0 && y < boardHeight - 1) {
          ctx.strokeStyle = "blue";
          ctx.lineWidth = 3;
        }
        if (y === boardHeight - 1) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 3;
        }
        ctx.stroke();
      }
    }
  };

  const redrawBoard = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawHexagonEdges(ctx);
    for (const cell of cells) {
      drawCell(ctx, cell);
    }
  };
</script>

<div class="container">
  <canvas bind:this={canvas} on:click|stopPropagation={onCanvasClick} />
</div>

<style lang="scss">
  .container {
    grid-column: 2;
    background-color: lightgreen;

    @media (max-width: 880px) {
      height: 80vw;
    }

    canvas {
      width: 100%;
      height: 100%;
      background-color: black;
    }
  }
</style>
