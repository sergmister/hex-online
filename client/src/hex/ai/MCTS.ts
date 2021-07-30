import type { HexAI } from "src/hex/ai/BaseAI";
import { CellState, HexBoard, HexPlayerColor, switchPlayer } from "src/hex/HexBoard";

const UCB_EXPLORE = 1.0;

export class Node {
  lastMove: number;
  state: Uint8Array;
  currentPlayer: HexPlayerColor;
  children: Node[] = [];
  numSims = 0;
  // wins for the other player
  numWins = 0;
  win = false;

  constructor(lastMove: number, state: Uint8Array, currentPlayer: HexPlayerColor, win?: boolean) {
    this.lastMove = lastMove;
    this.state = state;
    this.currentPlayer = currentPlayer;
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

export class MCTSAI implements HexAI {
  hexBoard: HexBoard;
  rootNode?: Node;

  constructor(hexBoard: HexBoard) {
    this.hexBoard = hexBoard;
  }

  getHexMove(state: Uint8Array, player: HexPlayerColor) {
    this.rootNode = new Node(-1, state.slice(), player);

    for (let i = 0; i < 1000; i++) {
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
          let win = this.hexBoard.move(newState, node.currentPlayer, i);
          let newNode = new Node(i, newState, switchPlayer(node.currentPlayer), win);

          if (win) {
            newNode.updateStats(1);
            nodeSims += 1;
            nodeWins -= 1;
          } else {
            for (let s = 0; s < 3; s++) {
              let winner = this.rollout(newNode.state, newNode.currentPlayer)!;
              if (winner === newNode.currentPlayer) {
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

  rollout(state: Uint8Array, currentPlayer: HexPlayerColor) {
    let newState = state.slice();

    const emptyCells = [];
    for (let i = 0; i < this.hexBoard.size; i++) {
      if (state[i] === CellState.Empty) {
        emptyCells.push(i);
      }
    }
    shuffle(emptyCells);

    for (const pos of emptyCells) {
      if (this.hexBoard.move(newState, currentPlayer, pos)) {
        return currentPlayer;
      }
      currentPlayer = switchPlayer(currentPlayer);
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
