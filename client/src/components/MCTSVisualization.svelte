<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";

  import { CellState } from "src/hex/HexBoard";

  const SQRT3 = Math.sqrt(3);
  const SQRT3_2 = Math.sqrt(3) / 2;
  const HEXAGON_OFFSETS = [
    { x: 0, y: 1 / SQRT3 }, // top
    { x: 0.5, y: 0.5 / SQRT3 }, // top right
    { x: 0.5, y: -0.5 / SQRT3 }, // bottom right
    { x: 0, y: -1 / SQRT3 }, // bottom
    { x: -0.5, y: -0.5 / SQRT3 }, // bottem left
    { x: -0.5, y: 0.5 / SQRT3 }, // top left
  ];

  export let data = {};
  export let boardWidth = 0;
  export let boardHeight = 0;
  let boardSize;

  const mounted = new Promise((resolve) => {
    onMount(() => {
      resolve();
    });
  });

  $: {
    boardSize = boardWidth * boardHeight;
  }

  let canvasSize = 80; // size of each hex board
  let cellSize; // size of each hex cell
  let cells;

  $: {
    // update cells on dimension change
    cellSize = canvasSize / (boardWidth + boardHeight / 2);
    cells = Array(boardSize)
      .fill(0)
      .map(() => ({ canvasX: 0, canvasY: 0 }));
    calculateCellCenters();
  }

  let svg;

  $: {
    updateData(data);
  }

  const updateData = async (data) => {
    // wait until component is mounted
    await mounted;

    // see https://observablehq.com/@d3/collapsible-tree
    let dx = 80;
    let dy = 120 + Math.pow(boardSize, 0.6) * 20;

    let margin = { top: 80, bottom: 0, right: 0, left: 800 };

    // clear any old svg
    if (svg) {
      svg.selectChildren().remove();
      svg.remove();
    }

    const root = d3.hierarchy(data);

    if (root.height > 0) {
      svg = d3
        .select("#mcts_visualization_container")
        .append("svg")
        .attr("viewBox", [-margin.left, -margin.top, 1600, 1600])
        .style("font", "10px sans-serif")
        .style("user-select", "none");

      const defs = svg.append("defs");
      const cellHighlight = defs.append("radialGradient").attr("id", "cellHighlight");
      cellHighlight.append("stop").attr("offset", "68%").attr("stop-color", "yellow");
      cellHighlight.append("stop").attr("offset", "100%").attr("stop-color", "transparent");

      const diagonal = d3
        .linkVertical()
        .x((d) => d.x)
        .y((d) => d.y);

      root.x0 = dy / 2;
      root.y0 = 0;
      root.descendants().forEach((d, i) => {
        d.id = i;
        d._children = d.children;
        d.children = null;
      });

      // container for links
      const gLink = svg.append("g").attr("fill", "none");

      // container for nodes
      const gNode = svg.append("g").attr("cursor", "pointer").attr("pointer-events", "all");

      // enables zoom and pan controlls
      svg
        .call(
          d3.zoom().on("zoom", (e) => {
            gNode.attr("transform", e.transform);
            gLink.attr("transform", e.transform);
          }),
        )
        .on("dblclick.zoom", null);

      // updates a node when modified
      const update = (source) => {
        const duration = 250;
        const nodes = root.descendants().reverse();
        const links = root.links();

        // Compute the new tree layout.
        const tree = d3.tree().nodeSize([dx, dy])(root);

        const transition = svg.transition().duration(duration);

        // Update the nodes…
        const node = gNode.selectAll(".node").data(nodes, (d) => d.id);

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node
          .enter()
          .append("g")
          .attr("class", "node")
          .attr("transform", (d) => `translate(${source.x0}, ${source.y0})`)
          .attr("fill-opacity", 0)
          .attr("stroke-opacity", 0)
          .on("click", (event, d) => {
            if (event.shiftKey) {
              const dfs = (node) => {
                node.children = null;
                if (node._children) {
                  for (const child of node._children) {
                    dfs(child);
                  }
                }
              };
              dfs(d);
            } else {
              d.children = d.children ? null : d._children;
            }
            update(d);
          });

        // hover title
        nodeEnter.append("title").text((d) => `sims: ${d.data.numSims}\nwins: ${d.data.numWins}`);

        // draws hex board background
        nodeEnter
          .append("path")
          .attr("fill", (d) => (d._children ? "#AAA" : "#CFCFCF"))
          .attr("stroke", (d) => (d._children ? "#AAA" : "#CFCFCF"))
          .attr("stroke-width", 8)
          .attr("stroke-linejoin", "round")
          .attr("d", () => {
            const path = d3.path();
            const xoffset = boardWidth / 2;
            const yoffset = boardHeight / 2;
            path.moveTo(cellSize * -xoffset + (cellSize * -yoffset) / 2, SQRT3_2 * cellSize * -yoffset);
            path.lineTo(cellSize * +xoffset + (cellSize * -yoffset) / 2, SQRT3_2 * cellSize * -yoffset);
            path.lineTo(cellSize * +xoffset + (cellSize * +yoffset) / 2, SQRT3_2 * cellSize * yoffset);
            path.lineTo(cellSize * -xoffset + (cellSize * +yoffset) / 2, SQRT3_2 * cellSize * yoffset);
            path.closePath();
            return path;
          });

        // drags hex board edges
        nodeEnter
          .append("path")
          .style("fill", "none")
          .style("stroke", "black")
          .attr("stroke-width", 0.5)
          .attr("stroke-linejoin", "round")
          .attr("stroke-linecap", "round")
          .attr("d", () => {
            let path = d3.path();
            drawHexagonEdges(path);
            return path;
          });

        // highlights last played cell
        nodeEnter
          .filter((d) => d.data.lastMove >= 0)
          .append("circle")
          .attr("r", 0.5 * cellSize)
          .attr("transform", (d) => {
            const cell = cells[d.data.lastMove];
            return `translate(${cell.canvasX}, ${cell.canvasY})`;
          })
          .attr("fill", "url('#cellHighlight')")
          .style("mix-blend-mode", "color");

        // draws cells
        for (const [i, cell] of cells.entries()) {
          nodeEnter
            .filter((d) => d.data.state[i] !== CellState.Empty)
            .append("circle")
            .attr("r", 0.33 * cellSize)
            .attr("transform", (d) => `translate(${cell.canvasX}, ${cell.canvasY})`)
            .attr("fill", (d) => {
              switch (d.data.state[i]) {
                case CellState.Black:
                case CellState.BlackNorth:
                case CellState.BlackSouth:
                case CellState.BlackWin:
                  return "red";
                case CellState.White:
                case CellState.WhiteEast:
                case CellState.WhiteWest:
                case CellState.WhiteWin:
                  return "blue";
                default:
                  return "none";
              }
            });
        }

        // Transition nodes to their new position.
        const nodeUpdate = node
          .merge(nodeEnter)
          .transition(transition)
          .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
          .attr("fill-opacity", 1)
          .attr("stroke-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        const nodeExit = node
          .exit()
          .transition(transition)
          .remove()
          .attr("transform", (d) => `translate(${source.x}, ${source.y})`)
          .attr("fill-opacity", 0)
          .attr("stroke-opacity", 0);

        // Update the links…
        const link = gLink.selectAll("path").data(links, (d) => d.target.id);

        let bestVal = -Infinity;

        for (const child of source.data.children) {
          let val = child.numWins / child.numSims;
          if (val > bestVal) {
            bestVal = val;
          }
        }

        // Enter any new links at the parent's previous position.
        const linkEnter = link
          .enter()
          .append("path")
          .attr("d", (d) => {
            const o = { x: source.x0, y: source.y0 };
            return diagonal({ source: o, target: o });
          })
          .attr("stroke", (d) => {
            let val = d.target.data.numWins / d.target.data.numSims;
            if (val === bestVal) {
              return "yellow";
            }
            return d.target.data.lastPlayer === 0 ? "red" : "blue";
          })
          .attr("stroke-opacity", (d) => {
            let val = d.target.data.numWins / d.target.data.numSims;
            if (val === bestVal) {
              return 1;
            }
            return 0.6 + Math.log(d.target.data.numSims) / 16;
          })
          .attr("stroke-width", (d) => {
            return 0.6 + Math.log(d.target.data.numSims) ** 1.2 / 4;
          });

        // Transition links to their new position.
        link.merge(linkEnter).transition(transition).attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link
          .exit()
          .transition(transition)
          .remove()
          .attr("d", (d) => {
            const o = { x: source.x, y: source.y };
            return diagonal({ source: o, target: o });
          });

        // Stash the old positions for transition.
        root.eachBefore((d) => {
          d.x0 = d.x;
          d.y0 = d.y;
        });
      };

      update(root);
    }
  };

  const getIndex = (x, y) => {
    return y * boardWidth + x;
  };

  const calculateCellCenters = () => {
    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        const xoffset = x - (boardWidth - 1) / 2;
        const yoffset = y - (boardHeight - 1) / 2;
        const cell = cells[getIndex(x, y)];
        cell.canvasX = cellSize * xoffset + (cellSize * yoffset) / 2;
        cell.canvasY = SQRT3_2 * cellSize * yoffset;
      }
    }
  };

  const drawHexagonEdges = (path) => {
    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        const { canvasX: hx, canvasY: hy } = cells[getIndex(x, y)];

        path.moveTo(hx + cellSize * HEXAGON_OFFSETS[0].x, hy + cellSize * HEXAGON_OFFSETS[0].y);
        path.lineTo(hx + cellSize * HEXAGON_OFFSETS[1].x, hy + cellSize * HEXAGON_OFFSETS[1].y);

        path.moveTo(hx + cellSize * HEXAGON_OFFSETS[1].x, hy + cellSize * HEXAGON_OFFSETS[1].y);
        path.lineTo(hx + cellSize * HEXAGON_OFFSETS[2].x, hy + cellSize * HEXAGON_OFFSETS[2].y);

        path.moveTo(hx + cellSize * HEXAGON_OFFSETS[2].x, hy + cellSize * HEXAGON_OFFSETS[2].y);
        path.lineTo(hx + cellSize * HEXAGON_OFFSETS[3].x, hy + cellSize * HEXAGON_OFFSETS[3].y);

        path.moveTo(hx + cellSize * HEXAGON_OFFSETS[3].x, hy + cellSize * HEXAGON_OFFSETS[3].y);
        path.lineTo(hx + cellSize * HEXAGON_OFFSETS[4].x, hy + cellSize * HEXAGON_OFFSETS[4].y);

        path.moveTo(hx + cellSize * HEXAGON_OFFSETS[4].x, hy + cellSize * HEXAGON_OFFSETS[4].y);
        path.lineTo(hx + cellSize * HEXAGON_OFFSETS[5].x, hy + cellSize * HEXAGON_OFFSETS[5].y);

        path.moveTo(hx + cellSize * HEXAGON_OFFSETS[5].x, hy + cellSize * HEXAGON_OFFSETS[5].y);
        path.lineTo(hx + cellSize * HEXAGON_OFFSETS[0].x, hy + cellSize * HEXAGON_OFFSETS[0].y);
      }
    }
  };

  let dropdown = false;
</script>

<div class="container" id="mcts_visualization_container">
  <svg viewBox="0 0 328 328" class="info_button" on:click={() => (dropdown = !dropdown)}>
    <path
      d="M164,0C73.425,0,0,73.425,0,164s73.425,164,164,164c90.574,0,164-73.425,164-164S254.574,0,164,0z M192.258,166.965
   c-1.595,19.083-7.367,37.419-10.235,56.287c-0.408,3.604-1.255,9.354,0.525,11.191c4.896,5.055,10.007,12.635,7.509,21.716
   c-2.303,8.368-10.912,15.118-19.748,15.118c-14.274,0-24.958-13.498-27.754-25.399c-1.987-8.458-1.872-16.961-0.734-25.499
   c2.281-17.133,7.011-33.788,9.625-50.839c-7.714-1.192-14.605-7.1-16.714-14.764c-3.015-10.962,3.635-21.609,14.162-24.943
   c11.198-3.545,26.408-3.078,34.701,6.775C193.797,148.735,192.682,161.885,192.258,166.965z M165.957,112.809
   c-15.489,0-28.043-12.554-28.043-28.043c0-15.488,12.555-28.042,28.043-28.042S194,69.277,194,84.766
   C194,100.255,181.445,112.809,165.957,112.809z"
    />
  </svg>
  {#if dropdown}
    <div class="dropdown">
      <pre>MCTS Visualization

Scroll to zoom
Drag to pan
Click on a cell to expand or close
Shift click to close all children
Hover on a cell for details
Yellow line indicates MCTS best path</pre>
    </div>
  {/if}
</div>

<style lang="scss">
  .container {
    position: relative;
    width: 100%;
    height: 100vh;
    background-color: rgb(230, 230, 230);
    overflow: hidden;

    @media (max-width: 880px) {
      height: 100vw;
    }
  }

  .info_button {
    position: absolute;
    top: 16px;
    left: 16px;
    width: 24px;
    height: 24px;
    opacity: 0.8;
  }

  .dropdown {
    position: absolute;
    z-index: 10;
    top: 48px;
    left: 16px;
    width: 320px;
    overflow: hidden;
    background-color: lightgray;
    border: 2px solid darkgray;
    border-radius: 6px;
    padding: 8px;
    font-size: 14px;
    white-space: pre-wrap;
  }
</style>
