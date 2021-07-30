#![feature(vec_into_raw_parts)]
use log::Level;
use log::{debug, error, info, warn};
use wasm_bindgen::prelude::*;

pub mod hex;
pub mod mcts;

#[wasm_bindgen]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));

    #[cfg(feature = "console_log")]
    console_log::init_with_level(Level::Debug).unwrap();

    debug!("wasm initialized");
    info!("wasm initialized");
    warn!("wasm initialized");
    error!("wasm initialized");
}
