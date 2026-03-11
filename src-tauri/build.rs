fn main() {
    // 链接 macOS 系统框架
    println!("cargo:rustc-link-lib=framework=CoreGraphics");
    println!("cargo:rustc-link-lib=framework=CoreFoundation");
    println!("cargo:rustc-link-lib=framework=ApplicationServices");

    tauri_build::build()
}
