//! Embeds the app icon, version info and application manifest (DPI awareness,
//! Common Controls v6, supported OS) into RemoteMouse.exe on Windows targets.
fn main() {
    println!("cargo:rerun-if-changed=resources/app.rc");
    println!("cargo:rerun-if-changed=resources/app.manifest");
    println!("cargo:rerun-if-changed=resources/RemoteMouse.ico");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        embed_resource::compile("resources/app.rc", embed_resource::NONE)
            .manifest_required()
            .expect("falha ao compilar resources/app.rc (instale o Windows SDK ou mingw windres)");
    }
}
