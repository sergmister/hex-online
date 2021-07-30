use rand::prelude::SliceRandom;
use rand::rngs::SmallRng;
use rand::SeedableRng;

use wasm_bindgen::prelude::*;

use crate::hex::{switch_player, CellState, HexBoard, HexPlayerColor};

const UCB_EXPLORE: f32 = 1.0;

struct Node {
    last_player: HexPlayerColor,
    last_move: usize,
    state: Vec<CellState>,
    children: Vec<Self>,

    num_sims: i32,
    num_wins: i32,
    win: bool,
}

impl Node {
    fn new(
        last_player: HexPlayerColor,
        last_move: usize,
        state: Vec<CellState>,
        win: bool,
    ) -> Self {
        Self {
            last_player,
            last_move,
            state,
            children: Vec::new(),
            num_sims: 0,
            num_wins: 0,
            win,
        }
    }

    fn is_leaf(&self) -> bool {
        self.children.len() == 0
    }

    fn update_stats(&mut self, sims: i32, value: i32) {
        self.num_sims += sims;
        self.num_wins += value;
    }

    fn ucb_eval(&self, child: &Node) -> f32 {
        (child.num_wins as f32) / (child.num_sims as f32)
            + UCB_EXPLORE * ((self.num_sims as f32).ln() / (child.num_sims as f32)).sqrt()
    }
}

#[wasm_bindgen]
pub struct MCTSAI {
    board: HexBoard,
    rng: SmallRng,
}

#[wasm_bindgen]
impl MCTSAI {
    pub fn new(board: HexBoard) -> Self {
        Self {
            board,
            rng: SmallRng::from_entropy(),
        }
    }

    pub fn get_hex_move(&mut self, state: Vec<u8>, player: HexPlayerColor) -> usize {
        let (ptr, len, cap) = state.into_raw_parts();
        let state: Vec<CellState> = unsafe { Vec::from_raw_parts(ptr as *mut CellState, len, cap) };

        let mut root = Node::new(player, usize::MAX, state, false);

        for _ in 0..100 {
            self.iteration(&mut root);
        }

        let mut best_move = 0;
        let mut best_val = f32::NEG_INFINITY;
        for child in root.children {
            let val = (child.num_wins as f32) / (child.num_sims as f32);
            if val > best_val {
                best_val = val;
                best_move = child.last_move;
            }
        }

        best_move
    }
}

impl MCTSAI {
    fn iteration(&mut self, node: &mut Node) -> (i32, i32) {
        let mut value = (0, 0);

        if !node.is_leaf() {
            let mut best_index = 0;
            let mut best_val = node.ucb_eval(&node.children[0]);

            for i in 1..node.children.len() {
                let val = node.ucb_eval(&node.children[1]);
                if val > best_val {
                    best_val = val;
                    best_index = i;
                }
            }

            value = self.iteration(&mut node.children[best_index]);
        } else {
            if node.win {
                value.0 += 10;
                value.1 += 10;
            } else {
                for i in 0..self.board.size {
                    if node.state[i] == CellState::Empty {
                        let mut new_state = node.state.clone();
                        let new_player = switch_player(node.last_player);
                        let win = self.board.update_move(&mut new_state, new_player, i);
                        let mut new_node = Node::new(new_player, i, new_state, win);

                        if win {
                            // infinity ??
                            new_node.update_stats(1, 1);
                            value.0 += 1;
                            value.1 -= 1;
                        } else {
                            for _ in 0..3 {
                                let winner =
                                    self.rollout(new_node.state.clone(), new_node.last_player);
                                if winner == new_node.last_player {
                                    new_node.update_stats(1, -1);
                                    value.0 += 1;
                                    value.1 += 1;
                                } else {
                                    new_node.update_stats(1, 1);
                                    value.0 += 1;
                                    value.1 -= 1;
                                }
                            }
                        }
                        node.children.push(new_node);
                    }
                }
            }
        }

        node.update_stats(value.0, value.1);

        value
    }
    // fn select<'a>(&mut self, breadcrumbs: &mut Vec<*mut Node>, root: &'a mut Node) -> &'a mut Node {
    //     let mut current_node: &mut Node = root;

    //     while !current_node.is_leaf() {
    //         let mut best_index = 0;
    //         let mut best_val = current_node.ucb_eval(&current_node.children[best_index]);

    //         for (i, child) in current_node.children.iter().enumerate().skip(1) {
    //             let val = current_node.ucb_eval(child);
    //             if val > best_val {
    //                 best_val = val;
    //                 best_index = i;
    //             }
    //         }
    //         current_node = &mut current_node.children[best_index];
    //         breadcrumbs.push(&mut current_node.children[best_index]);
    //     }

    //     current_node
    // }

    // fn select(&mut self, breadcrumbs: &mut Vec<*mut Node>) {
    //     let mut current_node = unsafe { &mut **breadcrumbs.get_unchecked(breadcrumbs.len() - 1) };

    //     while !current_node.is_leaf() {
    //         let mut best_child: *mut Node =
    //             unsafe { &mut *current_node.children.get_unchecked_mut(0) };
    //         let mut best_val = current_node.ucb_eval(unsafe { &*best_child });

    //         for child in current_node.children.iter_mut().skip(1) {
    //             let val = current_node.ucb_eval(child);
    //             if val > best_val {
    //                 best_val = val;
    //                 best_child = &mut *child;
    //             }
    //         }

    //         // current_node = best_child;
    //         // breadcrumbs.push(current_node);
    //     }
    // }

    // fn evaluate_leaf(&mut self, breadcrumbs: &mut Vec<*mut Node>) {
    //     let node = unsafe { &**breadcrumbs.get_unchecked(breadcrumbs.len() - 1) };

    //     let mut nodeSims = 0;
    //     let mut nodeWins = 0;

    //     if node.win {
    //         nodeSims += 10;
    //         nodeWins += 10;
    //     } else {
    //         for i in 0..self.board.size {
    //             if node.state[i] == CellState::Empty {
    //                 let mut new_state = node.state.clone();
    //                 let new_player = switch_player(node.last_player);
    //                 let win = self.board.update_move(&mut new_state, new_player, i);
    //                 let mut new_node = Node::new(new_player, i, new_state, win);

    //                 if win {
    //                     // infinity ??
    //                     new_node.update_stats(1, 1);
    //                     nodeSims += 1;
    //                     nodeWins -= 1;
    //                 } else {
    //                     for _ in 0..3 {
    //                         let winner = self.rollout(new_node.state.clone(), new_node.last_player);
    //                         if winner == new_node.last_player {
    //                             new_node.update_stats(1, -1);
    //                             nodeSims += 1;
    //                             nodeWins += 1;
    //                         } else {
    //                             new_node.update_stats(1, 1);
    //                             nodeSims += 1;
    //                             nodeWins -= 1;
    //                         }
    //                     }
    //                 }
    //                 node.children.push(new_node);
    //             }
    //         }
    //     }
    // }

    fn rollout(&mut self, mut state: Vec<CellState>, player: HexPlayerColor) -> HexPlayerColor {
        let mut empty_cells = Vec::new();
        for (i, &cell) in state.iter().enumerate() {
            if cell == CellState::Empty {
                empty_cells.push(i);
            }
        }
        empty_cells.shuffle(&mut self.rng);

        for pos in empty_cells {
            state[pos] = if player == HexPlayerColor::Black {
                CellState::Black
            } else {
                CellState::White
            };
        }

        self.board.check_winner(&mut state)
    }
}
