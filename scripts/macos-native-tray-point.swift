import CoreGraphics
import Foundation

struct WindowRecord {
    let ownerPID: Int32
    let ownerName: String
    let windowName: String
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

func number(_ value: Any?) -> Double? {
    if let value = value as? NSNumber {
        return value.doubleValue
    }
    if let value = value as? Double {
        return value
    }
    if let value = value as? Int {
        return Double(value)
    }
    return nil
}

func string(_ value: Any?) -> String {
    if let value = value as? String {
        return value
    }
    if let value = value as? NSString {
        return value as String
    }
    return ""
}

func integer(_ value: Double) -> String {
    String(format: "%.0f", value)
}

guard CommandLine.arguments.count == 2, let targetPID = Int32(CommandLine.arguments[1]) else {
    fputs("usage: macos-native-tray-point.swift <pid>\n", stderr)
    exit(2)
}

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let rawWindows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    fputs("CGWindowListCopyWindowInfo returned no window list\n", stderr)
    exit(1)
}

var windows: [WindowRecord] = []
for window in rawWindows {
    guard let pidNumber = window[kCGWindowOwnerPID as String] as? NSNumber,
          pidNumber.int32Value == targetPID,
          let rawBounds = window[kCGWindowBounds as String] as? NSDictionary,
          let x = number(rawBounds["X"]),
          let y = number(rawBounds["Y"]),
          let width = number(rawBounds["Width"]),
          let height = number(rawBounds["Height"]) else {
        continue
    }

    windows.append(WindowRecord(
        ownerPID: pidNumber.int32Value,
        ownerName: string(window[kCGWindowOwnerName as String]),
        windowName: string(window[kCGWindowName as String]),
        x: x,
        y: y,
        width: width,
        height: height
    ))
}

for window in windows {
    print("FOCUSED_MOMENT_CG_WINDOW=pid:\(window.ownerPID),owner:\(window.ownerName),name:\(window.windowName),x:\(window.x),y:\(window.y),width:\(window.width),height:\(window.height)")
}

let candidates = windows
    .filter { window in
        window.x >= 0 && window.y >= 0 && window.y <= 40 &&
            window.width >= 40 && window.width <= 260 &&
            window.height >= 15 && window.height <= 40 &&
            (window.ownerPID == targetPID ||
                window.ownerName.localizedCaseInsensitiveContains("Focused Moment") ||
                window.windowName.localizedCaseInsensitiveContains("Focused Moment"))
    }
    .sorted { lhs, rhs in
        (lhs.width * lhs.height) > (rhs.width * rhs.height)
    }

for candidate in candidates {
    print("FOCUSED_MOMENT_CG_CANDIDATE=pid:\(candidate.ownerPID),owner:\(candidate.ownerName),name:\(candidate.windowName),x:\(candidate.x),y:\(candidate.y),width:\(candidate.width),height:\(candidate.height)")
}

guard let tray = candidates.first else {
    fputs("No small top-bar window owned by the Focused Moment process was found\n", stderr)
    exit(1)
}

print("FOCUSED_MOMENT_TRAY_POINT=x:\(integer(tray.x)),y:\(integer(tray.y)),width:\(integer(tray.width)),height:\(integer(tray.height))")
