import type { HexAI } from "src/hex/ai/BaseAI";
import { CellState, HexBoard, HexPlayerColor, switchPlayer } from "src/hex/HexBoard";

const UCB_EXPLORE = 1.0;

export class Node {
  lastMove: number;
  lastPlayer: HexPlayerColor;
  state: Uint8Array;
  children: Node[] = [];

  numSims = 0;
  // wins for the other player
  numWins = 0;
  win = false;

  constructor(lastPlayer: HexPlayerColor, lastMove: number, state: Uint8Array, win?: boolean) {
    this.lastPlayer = lastPlayer;
    this.lastMove = lastMove;
    this.state = state;
    this.win = win || false;
  }

  isLeaf() {
    return this.children.length === 0;
  }

  updateStats(value: number, sims = 1) {
    this.numSims += sims;
    this.numWins += value;
  }

  ucb_eval(child: Node) {
    // if (child.numSims == 0) {
    //   return Infinity;
    // }
    return child.numWins / child.numSims + UCB_EXPLORE * Math.sqrt(Math.log(this.numSims) / child.numSims);
  }
}

export class MiaiAI implements HexAI {
  hexBoard: HexBoard;
  rootNode?: Node;
  mustReply: number[];
  miaiConnectivity: Uint8Array;

  constructor(hexBoard: HexBoard) {
    this.hexBoard = hexBoard;
    this.mustReply = Array(hexBoard.size).fill(0);
    this.miaiConnectivity = new Uint8Array(hexBoard.size).fill(CellState.Empty);
  }

  getHexMove(state: Uint8Array, player: HexPlayerColor) {
    this.rootNode = new Node(switchPlayer(player), -1, state.slice());

    for (let i = 0; i < 10000; i++) {
      const [currentNode, breadcrumbs] = this.select(this.rootNode);
      const [nodeSims, nodeWins] = this.evaluateLeaf(currentNode);
      this.backpropagate(breadcrumbs, nodeSims, nodeWins);
    }

    let bestMove = 0;
    let bestVal = -Infinity;

    for (const child of this.rootNode.children) {
      let val = child.numWins / child.numSims;
      if (val > bestVal) {
        bestVal = val;
        bestMove = child.lastMove;
      }
    }

    return bestMove;
  }

  select(root: Node): [Node, Node[]] {
    let currentNode: Node = root;
    let breadcrumbs: Node[] = [currentNode];
    while (!currentNode.isLeaf()) {
      let bestEval = -Infinity;
      let bestChild: Node;
      for (const child of currentNode.children) {
        let val = currentNode.ucb_eval(child);
        if (val > bestEval) {
          bestEval = val;
          bestChild = child;
        }
      }
      if (bestChild! === undefined) {
        console.log("hello");
      }
      currentNode = bestChild!;
      breadcrumbs.push(currentNode);
    }
    return [currentNode, breadcrumbs];
  }

  // expand and simulate each child
  evaluateLeaf(node: Node) {
    let nodeSims = 0;
    let nodeWins = 0;

    if (node.win) {
      nodeSims += 10;
      nodeWins += 10;
    } else {
      for (let i = 0; i < this.hexBoard.size; i++) {
        if (node.state[i] === CellState.Empty) {
          let newState = node.state.slice();
          let newPlayer = switchPlayer(node.lastPlayer);
          let win = this.hexBoard.move(newState, newPlayer, i);
          let newNode = new Node(newPlayer, i, newState, win);

          if (win) {
            newNode.updateStats(1);
            nodeSims += 1;
            nodeWins -= 1;
          } else {
            for (let s = 0; s < 3; s++) {
              let winner = this.rollout(newNode.state.slice(), newPlayer)!;
              if (winner !== newPlayer) {
                newNode.updateStats(-1);
                nodeSims += 1;
                nodeWins += 1;
              } else {
                newNode.updateStats(1);
                nodeSims += 1;
                nodeWins -= 1;
              }
            }
          }
          node.children.push(newNode);
        }
      }
    }

    return [nodeSims, nodeWins];
  }

  backpropagate(breadcrumbs: Node[], nodeSims: number, nodeWins: number) {
    let direction = 1;
    for (const node of breadcrumbs.reverse()) {
      node.updateStats(nodeWins * direction, nodeSims);
      direction *= -1;
    }
  }

  rollout(state: Uint8Array, player: HexPlayerColor) {
    const emptyCells = [];
    for (let i = 0; i < this.hexBoard.size; i++) {
      if (state[i] === CellState.Empty) {
        emptyCells.push(i);
      }
    }
    shuffle(emptyCells);

    for (const pos of emptyCells) {
      player = switchPlayer(player);
      if (this.hexBoard.move(state, player, pos)) {
        return player;
      }
    }
  }
}

const shuffle = (array: any[]) => {
  for (let currentIndex = array.length; currentIndex !== 0; ) {
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
};
