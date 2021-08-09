import type { HexAI } from "src/hex/ai/BaseAI";
import { CellState, HexBoard, HexPlayerColor, switchPlayer } from "src/hex/HexBoard";

export class Node {
  lastMove: number;
  lastPlayer: HexPlayerColor;
  state: Uint8Array; // with miai connectivity
  reply: Int16Array; // miai reply board
  children: Node[] = [];

  numSims = 0;
  numWins = 0; // wins for the last player
  ucbVal = 0.5;

  constructor(lastPlayer: HexPlayerColor, lastMove: number, state: Uint8Array, reply: Int16Array) {
    this.lastPlayer = lastPlayer;
    this.lastMove = lastMove;
    this.state = state;
    this.reply = reply;
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
    return child.numWins / child.numSims + 1.0 * Math.sqrt(Math.sqrt(this.numSims) / child.numSims);
  }
}

export class MiaiAI implements HexAI {
  hexBoard: HexBoard;
  upperNode?: Node;
  rootNode?: Node;
  mustReply: number[];
  miaiConnectivity: Uint8Array;

  constructor(hexBoard: HexBoard) {
    this.hexBoard = hexBoard;
    this.mustReply = Array(hexBoard.size).fill(0);
    this.miaiConnectivity = new Uint8Array(hexBoard.size).fill(CellState.Empty);
  }

  getHexMove(state: Uint8Array, player: HexPlayerColor) {
    this.upperNode = new Node(player, -1, state.slice(), new Int16Array(this.hexBoard.size).fill(-1));
    this.rootNode = new Node(switchPlayer(player), -1, state.slice(), new Int16Array(this.hexBoard.size).fill(-1));

    for (const [index, cell] of this.rootNode.state.entries()) {
      let player;
      switch (cell) {
        case CellState.Black:
        case CellState.BlackNorth:
        case CellState.BlackSouth:
        case CellState.BlackWin:
          player = HexPlayerColor.Black;
          break;
        case CellState.White:
        case CellState.WhiteEast:
        case CellState.WhiteWest:
        case CellState.WhiteWin:
          player = HexPlayerColor.White;
          break;
        default:
          player = undefined;
          break;
      }

      if (player !== undefined) {
        if (player === this.rootNode.lastPlayer) {
          this.hexBoard.miaiConnectivityMove(this.rootNode.state, this.rootNode.reply, player, index);
        } else {
          this.hexBoard.miaiConnectivityMove(this.upperNode.state, this.upperNode.reply, player, index);
        }
      }
    }

    for (let i = 0; i < 2000; i++) {
      const breadcrumbs = this.select(this.rootNode);
      this.evaluateLeaf(breadcrumbs);
    }

    let bestMove: number | undefined = undefined;
    let bestVal = -Infinity;

    for (const child of this.rootNode.children) {
      let val = child.numWins / child.numSims;
      if (val > bestVal) {
        bestVal = val;
        bestMove = child.lastMove;
      }
    }

    if (bestMove === undefined) {
      bestMove = this.rootNode.children[0].lastMove;
    }

    return bestMove;
  }

  select(root: Node): Node[] {
    let currentNode: Node = root;
    let breadcrumbs: Node[] = [currentNode];
    while (!currentNode.isLeaf()) {
      let bestEval = -Infinity;
      let bestChild: Node;
      for (const child of currentNode.children) {
        // let val = currentNode.ucb_eval(child);
        let val = child.ucbVal;
        if (val > bestEval) {
          bestEval = val;
          bestChild = child;
        }
      }
      if (bestChild! === undefined) {
        bestChild = currentNode.children[0];
      }
      currentNode = bestChild!;
      breadcrumbs.push(currentNode);
    }
    return breadcrumbs;
  }

  // expand and simulate each child
  evaluateLeaf(breadcrumbs: Node[]) {
    let node = breadcrumbs[breadcrumbs.length - 1];
    let nodeSims = 0;
    let nodeWins = 0;

    if (node.numWins === Infinity) {
      nodeSims += 5;
      nodeWins += 5;
      // throw "revisited winning node";
    } else {
      let possibleMoves: number[] = [];

      for (let i = 0; i < this.hexBoard.size; i++) {
        if (node.state[i] === CellState.Empty) {
          possibleMoves.push(i);
        }
      }

      let parent: Node | undefined;

      if (breadcrumbs.length >= 2) {
        parent = breadcrumbs[breadcrumbs.length - 2];

        let replyMove = parent.reply[node.lastMove];
        if (replyMove !== -1) {
          possibleMoves = [replyMove];
        }
      } else {
        parent = this.upperNode!;
      }

      let reply = parent.reply.slice();
      for (const [i, e] of node.state.entries()) {
        if (reply[i] !== -1 && e !== CellState.Empty) {
          reply[reply[i]] = -1;
          reply[i] = 0;
        }
      }

      for (const pos of possibleMoves) {
        let newState = node.state.slice();
        let newPlayer = switchPlayer(node.lastPlayer);
        let newReply = reply.slice();
        let win = this.hexBoard.miaiConnectivityMove(newState, newReply, newPlayer, pos);
        let newNode = new Node(newPlayer, pos, newState, newReply);

        node.children.push(newNode);

        if (win) {
          newNode.updateStats(Infinity);
          nodeSims += 1;
          nodeWins -= Infinity;
          break;
        } else {
          for (let s = 0; s < 3; s++) {
            let winner = this.rollout(newNode.state.slice(), newPlayer)!;
            if (winner === newPlayer) {
              newNode.updateStats(1);
              nodeSims += 1;
              nodeWins -= 1;
            } else {
              newNode.updateStats(-1);
              nodeSims += 1;
              nodeWins += 1;
            }
          }
        }
      }
    }

    node.updateStats(nodeWins, nodeSims);
    for (const child of node.children) {
      child.ucbVal = node.ucb_eval(child);
    }

    if (nodeWins === -Infinity) {
      nodeSims = 5;
      nodeWins = -5;
    }

    let direction = -1;
    let prevNode = node;
    for (const node of breadcrumbs.reverse().slice(1)) {
      node.updateStats(nodeWins * direction, nodeSims);
      prevNode.ucbVal = node.ucb_eval(prevNode);
      prevNode = node;
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
