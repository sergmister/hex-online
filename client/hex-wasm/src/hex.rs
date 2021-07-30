use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[repr(u8)]
#[derive(PartialEq, Eq, Clone, Copy)]
pub enum HexPlayerColor {
    Black,
    White,
}

#[repr(u8)]
#[derive(PartialEq, Eq, Clone, Copy)]
pub enum CellState {
    Empty,
    White,
    WhiteWest,
    WhiteEast,
    WhiteWin,
    Black,
    BlackNorth,
    BlackSouth,
    BlackWin,
}

#[derive(Clone, Copy)]
struct Neighbor {
    size: usize,
    neighbors: [usize; 6],
}

#[wasm_bindgen]
pub struct HexBoard {
    pub width: usize,
    pub height: usize,
    pub size: usize,
    neighbor_list: Vec<Neighbor>,
}

#[wasm_bindgen]
impl HexBoard {
    pub fn new(width: usize, height: usize) -> Self {
        let board = Self {
            width,
            height,
            size: width * height,
            neighbor_list: vec![
                Neighbor {
                    size: 0,
                    neighbors: [0; 6],
                };
                width * height
            ],
        };

        for x in 0..width {
            for y in 0..height {
                let mut cell = board.neighbor_list[board.get_index(x, y)];
                if x > 0 {
                    cell.neighbors[cell.size] = board.get_index(x - 1, y);
                    cell.size += 1;
                }
                if y > 0 {
                    cell.neighbors[cell.size] = board.get_index(x, y - 1);
                    cell.size += 1;
                }
                if x < (board.width - 1) {
                    cell.neighbors[cell.size] = board.get_index(x + 1, y);
                    cell.size += 1;
                }
                if y < (board.height - 1) {
                    cell.neighbors[cell.size] = board.get_index(x, y + 1);
                    cell.size += 1;
                }
                if x > 0 && y < (board.height - 1) {
                    cell.neighbors[cell.size] = board.get_index(x - 1, y + 1);
                    cell.size += 1;
                }
                if y > 0 && x < (board.width - 1) {
                    cell.neighbors[cell.size] = board.get_index(x + 1, y - 1);
                    cell.size += 1;
                }
            }
        }

        board
    }
}

impl HexBoard {
    fn get_index(&self, x: usize, y: usize) -> usize {
        return y * self.width + x;
    }

    fn dfs(
        &self,
        state: &mut Vec<CellState>,
        pos: usize,
        eq_cell_state: CellState,
        move_cell_state: CellState,
    ) {
        let neighbor = &self.neighbor_list[pos];
        for i in 0..neighbor.size {
            let neighbor = unsafe { *neighbor.neighbors.get_unchecked(i) };
            if state[neighbor] == eq_cell_state {
                state[neighbor] = move_cell_state;
                self.dfs(state, neighbor, eq_cell_state, move_cell_state);
            }
        }
    }

    pub fn update_move(
        &self,
        state: &mut Vec<CellState>,
        player: HexPlayerColor,
        pos: usize,
    ) -> bool {
        match player {
            HexPlayerColor::Black => {
                let mut north_connected = false;
                let mut south_connected = false;
                if pos < self.width {
                    // First row
                    north_connected = true;
                } else if pos >= (self.size - self.width) {
                    // Last row
                    south_connected = true;
                }
                let neighbor_cell = self.neighbor_list[pos];
                for i in 0..neighbor_cell.size {
                    if state[neighbor_cell.neighbors[i]] == CellState::BlackNorth {
                        north_connected = true;
                    } else if state[neighbor_cell.neighbors[i]] == CellState::BlackSouth {
                        south_connected = true;
                    }
                }
                if north_connected && south_connected {
                    state[pos] = CellState::BlackWin;
                    return true;
                } else if north_connected {
                    state[pos] = CellState::BlackNorth;
                    self.dfs(state, pos, CellState::Black, CellState::BlackNorth);
                } else if south_connected {
                    state[pos] = CellState::BlackSouth;
                    self.dfs(state, pos, CellState::Black, CellState::BlackSouth);
                } else {
                    state[pos] = CellState::Black;
                }
            }
            HexPlayerColor::White => {
                let mut west_connected = false;
                let mut east_connected = false;
                if pos % self.width == 0 {
                    // First column
                    west_connected = true;
                } else if pos % self.width == (self.width - 1) {
                    // Last column
                    east_connected = true;
                }
                let neighbor_cell = self.neighbor_list[pos];
                for i in 0..neighbor_cell.size {
                    if state[neighbor_cell.neighbors[i]] == CellState::WhiteWest {
                        west_connected = true;
                    } else if state[neighbor_cell.neighbors[i]] == CellState::WhiteEast {
                        east_connected = true;
                    }
                }
                if west_connected && east_connected {
                    state[pos] = CellState::WhiteWin;
                    return true;
                } else if west_connected {
                    state[pos] = CellState::WhiteWest;
                    self.dfs(state, pos, CellState::White, CellState::WhiteWest);
                } else if east_connected {
                    state[pos] = CellState::WhiteEast;
                    self.dfs(state, pos, CellState::White, CellState::WhiteEast);
                } else {
                    state[pos] = CellState::White;
                }
            }
        }

        false
    }

    // must be terminal state
    pub fn check_winner(&self, state: &mut Vec<CellState>) -> HexPlayerColor {
        fn dfs(board: &HexBoard, state: &mut Vec<CellState>, pos: usize) -> bool {
            let neighbor = &board.neighbor_list[pos];
            for i in 0..neighbor.size {
                let neighbor = unsafe { *neighbor.neighbors.get_unchecked(i) };
                let cell = unsafe { state.get_unchecked_mut(neighbor) };
                if *cell == CellState::Black {
                    *cell = CellState::BlackNorth;
                    if dfs(board, state, neighbor) {
                        return true;
                    }
                } else if *cell == CellState::BlackSouth {
                    return true;
                }
            }
            false
        }

        for cell in state[(self.size - self.width)..self.size].iter_mut() {
            if *cell == CellState::Black {
                *cell = CellState::BlackSouth;
            }
        }

        for cell in state[self.width..(self.size - self.width)].iter_mut() {
            if *cell == CellState::BlackNorth {
                *cell = CellState::Black;
            }
        }

        // unsafe {
        //     for pos in self.width..self.size {
        //         if *state.get_unchecked(pos) == CellState::BlackNorth {
        //             *state.get_unchecked(pos) == CellState::Black;
        //         }
        //     }
        // }

        for pos in 0..self.width {
            if state[pos] == CellState::Black {
                state[pos] = CellState::BlackNorth;
            }
        }

        for pos in 0..self.width {
            if dfs(&self, state, pos) {
                return HexPlayerColor::Black;
            }
        }

        HexPlayerColor::White
    }
}

pub fn switch_player(player: HexPlayerColor) -> HexPlayerColor {
    if player == HexPlayerColor::Black {
        HexPlayerColor::White
    } else {
        HexPlayerColor::Black
    }
}
