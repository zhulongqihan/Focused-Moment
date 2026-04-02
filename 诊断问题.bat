@echo off
chcp 65001 >nul
echo ========================================
echo   Focused Moment 诊断工具
echo ========================================
echo.

echo 检查 1: build 目录
if exist "build\index.html" (
    echo ✓ build 目录存在
    echo ✓ index.html 存在
) else (
    echo ✗ build 目录或 index.html 不存在
    echo   请运行: npm run build
)
echo.

echo 检查 2: exe 文件
if exist "src-tauri\target\release\focused-moment.exe" (
    echo ✓ focused-moment.exe 存在
    for %%I in ("src-tauri\target\release\focused-moment.exe") do echo   大小: %%~zI 字节
    for %%I in ("src-tauri\target\release\focused-moment.exe") do echo   修改时间: %%~tI
) else (
    echo ✗ focused-moment.exe 不存在
)
echo.

if exist "src-tauri\target\release\tauri-app.exe" (
    echo ⚠ 发现旧的 tauri-app.exe
    echo   建议删除此文件
)
echo.

echo 检查 3: Tauri 配置
findstr /C:"frontendDist" src-tauri\tauri.conf.json
echo.

echo 检查 4: 根目录 exe
if exist "Focused-Moment.exe" (
    echo ✓ Focused-Moment.exe 存在
    for %%I in ("Focused-Moment.exe") do echo   大小: %%~zI 字节
    for %%I in ("Focused-Moment.exe") do echo   修改时间: %%~tI
) else (
    echo ✗ Focused-Moment.exe 不存在
)
echo.

echo ========================================
echo 建议操作：
echo.
echo 1. 关闭所有正在运行的 Focused Moment 实例
echo 2. 删除 src-tauri\target\release\tauri-app.exe（如果存在）
echo 3. 运行: npm run build
echo 4. 运行: cargo build --release --manifest-path src-tauri/Cargo.toml
echo 5. 复制新的 exe 到根目录
echo ========================================
echo.
pause
