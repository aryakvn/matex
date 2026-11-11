use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

// MCP server for AI agents: an HTTP endpoint on 127.0.0.1 that only carries requests. Each one is
// emitted to the webview as `mcp-request` [id, method, url, host, origin, body]; src/utils/mcp.js
// checks it and speaks the protocol, and its answer comes back through `mcp_respond`.
#[derive(Default)]
struct Mcp {
    server: Mutex<Option<Arc<tiny_http::Server>>>,
    waiting: Arc<Mutex<HashMap<u64, mpsc::Sender<(u16, String)>>>>,
}

#[tauri::command]
fn mcp_start(port: u16, app: AppHandle, mcp: State<'_, Mcp>) -> Result<(), String> {
    let mut running = mcp.server.lock().unwrap();
    if running.is_some() {
        return Ok(());
    }
    let server = Arc::new(tiny_http::Server::http(("127.0.0.1", port)).map_err(|e| e.to_string())?);
    *running = Some(server.clone());
    let waiting = mcp.waiting.clone();
    std::thread::spawn(move || {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        for mut request in server.incoming_requests() {
            let (app, waiting) = (app.clone(), waiting.clone());
            std::thread::spawn(move || {
                let header = |name: &str| {
                    request.headers().iter().find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name)).map(|h| h.value.as_str().to_owned())
                };
                let (host, origin) = (header("Host").unwrap_or_default(), header("Origin"));
                let (method, url) = (request.method().to_string(), request.url().to_owned());
                let mut body = String::new();
                let _ = request.as_reader().read_to_string(&mut body);

                let id = NEXT.fetch_add(1, Ordering::Relaxed);
                let (tx, rx) = mpsc::channel();
                waiting.lock().unwrap().insert(id, tx);
                let sent = app.emit("mcp-request", (id, method, url, host, origin, body));
                let (status, body) = match sent.map(|_| rx.recv_timeout(Duration::from_secs(60))) {
                    Ok(Ok(reply)) => reply,
                    _ => (503, String::new()), // the webview is gone or didn't answer
                };
                waiting.lock().unwrap().remove(&id);

                let json = !body.is_empty();
                let mut response = tiny_http::Response::from_string(body).with_status_code(status);
                if json {
                    response.add_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap());
                }
                let _ = request.respond(response);
            });
        }
    });
    Ok(())
}

#[tauri::command]
fn mcp_respond(id: u64, status: u16, body: String, mcp: State<'_, Mcp>) {
    if let Some(tx) = mcp.waiting.lock().unwrap().remove(&id) {
        let _ = tx.send((status, body));
    }
}

#[tauri::command]
fn mcp_stop(mcp: State<'_, Mcp>) {
    if let Some(server) = mcp.server.lock().unwrap().take() {
        server.unblock();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Mcp::default())
        .invoke_handler(tauri::generate_handler![mcp_start, mcp_respond, mcp_stop])
        .run(tauri::generate_context!())
        .expect("error while running MaTex");
}
