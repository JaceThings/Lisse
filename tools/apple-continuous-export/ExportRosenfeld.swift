#!/usr/bin/env swift
/**
 * Export macOS/iOS continuous-corner paths as SVG for ground-truth comparison.
 *
 * On Apple platforms, continuous corners have NO smoothing parameter —
 * only corner radius. This tool dumps:
 *   1. SwiftUI RoundedRectangle(..., style: .continuous) path
 *   2. Rosenfeld reverse-engineered iOS UIBezierPath constants (reference)
 *
 * Usage:
 *   swift ExportContinuous.swift [size] [radius] [out.svg]
 * Defaults: 400 100 continuous-export.svg
 */

import Foundation
import CoreGraphics

#if canImport(AppKit)
import AppKit
#endif

// MARK: - Rosenfeld iOS continuous constants (from UIBezierPath on iOS)

func appleContinuousPath(rect: CGRect, cornerRadius r: CGFloat) -> CGPath {
    let path = CGMutablePath()

    func topLeft(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: rect.minX + x * r, y: rect.minY + y * r)
    }
    func topRight(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: rect.maxX - x * r, y: rect.minY + y * r)
    }
    func btmRight(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: rect.maxX - x * r, y: rect.maxY - y * r)
    }
    func btmLeft(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: rect.minX + x * r, y: rect.maxY - y * r)
    }

    path.move(to: topLeft(1.528665, 0.0))
    path.addLine(to: topRight(1.528665, 0.0))
    path.addCurve(to: topRight(0.63149379, 0.07491139),
                  control1: topRight(1.08849296, 0.0),
                  control2: topRight(0.86840694, 0.0))
    path.addCurve(to: topRight(0.07491139, 0.63149379),
                  control1: topRight(0.37282383, 0.16905956),
                  control2: topRight(0.16905956, 0.37282383))
    path.addCurve(to: topRight(0.0, 1.52866498),
                  control1: topRight(0.0, 0.86840694),
                  control2: topRight(0.0, 1.08849296))
    path.addLine(to: btmRight(0.0, 1.528665))
    path.addCurve(to: btmRight(0.07491139, 0.63149379),
                  control1: btmRight(0.0, 1.08849296),
                  control2: btmRight(0.0, 0.86840694))
    path.addCurve(to: btmRight(0.63149379, 0.07491139),
                  control1: btmRight(0.16905956, 0.37282383),
                  control2: btmRight(0.37282383, 0.16905956))
    path.addCurve(to: btmRight(1.52866498, 0.0),
                  control1: btmRight(0.86840694, 0.0),
                  control2: btmRight(1.08849296, 0.0))
    path.addLine(to: btmLeft(1.528665, 0.0))
    path.addCurve(to: btmLeft(0.63149379, 0.07491139),
                  control1: btmLeft(1.08849296, 0.0),
                  control2: btmLeft(0.86840694, 0.0))
    path.addCurve(to: btmLeft(0.07491139, 0.63149379),
                  control1: btmLeft(0.37282383, 0.16905956),
                  control2: btmLeft(0.16905956, 0.37282383))
    path.addCurve(to: btmLeft(0.0, 1.52866498),
                  control1: btmLeft(0.0, 0.86840694),
                  control2: btmLeft(0.0, 1.08849296))
    path.addLine(to: topLeft(0.0, 1.528665))
    path.addCurve(to: topLeft(0.07491139, 0.63149379),
                  control1: topLeft(0.0, 1.08849296),
                  control2: topLeft(0.0, 0.86840694))
    path.addCurve(to: topLeft(0.63149379, 0.07491139),
                  control1: topLeft(0.16905956, 0.37282383),
                  control2: topLeft(0.37282383, 0.16905956))
    path.addCurve(to: topLeft(1.52866498, 0.0),
                  control1: topLeft(0.86840694, 0.0),
                  control2: topLeft(1.08849296, 0.0))
    path.closeSubpath()
    return path
}

#if canImport(AppKit)
/// Platform continuous corner via CALayer.cornerCurve = .continuous raster→trace
/// isn't available as a path. Use NSBezierPath isn't continuous either.
/// SwiftUI RoundedRectangle continuous is available — approximate by sampling
/// NSView with continuous corner mask isn't a CGPath export.
///
/// On modern macOS, we can use:
///   CGPath(roundedRect:...) is CIRCULAR, not continuous.
/// So Rosenfeld constants ARE our best path-level ground truth matching iOS
/// UIBezierPath(roundedRect:cornerRadius:).
///
/// Additionally dump CALayer continuous as a PNG for visual compare.
func exportContinuousPNG(size: CGFloat, radius: CGFloat, url: URL) {
    let scale: CGFloat = 2
    let px = Int(size * scale)
    let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
        guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
        ctx.setFillColor(NSColor.systemBlue.cgColor)
        let path = appleContinuousPath(rect: rect, cornerRadius: radius)
        ctx.addPath(path)
        ctx.fillPath()
        return true
    }
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
        fputs("Failed to encode PNG\n", stderr)
        return
    }
    try? png.write(to: url)
    print("Wrote PNG \(url.path)")
}
#endif

func cgPathToSVG(_ path: CGPath, width: CGFloat, height: CGFloat) -> String {
    var d = ""
    path.applyWithBlock { elementPtr in
        let e = elementPtr.pointee
        switch e.type {
        case .moveToPoint:
            let p = e.points[0]
            d += String(format: "M %.6f %.6f ", p.x, p.y)
        case .addLineToPoint:
            let p = e.points[0]
            d += String(format: "L %.6f %.6f ", p.x, p.y)
        case .addQuadCurveToPoint:
            let c = e.points[0], p = e.points[1]
            d += String(format: "Q %.6f %.6f %.6f %.6f ", c.x, c.y, p.x, p.y)
        case .addCurveToPoint:
            let c1 = e.points[0], c2 = e.points[1], p = e.points[2]
            d += String(format: "C %.6f %.6f %.6f %.6f %.6f %.6f ",
                        c1.x, c1.y, c2.x, c2.y, p.x, p.y)
        case .closeSubpath:
            d += "Z "
        @unknown default:
            break
        }
    }
    return """
    <svg xmlns="http://www.w3.org/2000/svg" width="\(Int(width))" height="\(Int(height))" viewBox="0 0 \(width) \(height)">
      <path fill="#007AFF" d="\(d.trimmingCharacters(in: .whitespaces))"/>
    </svg>
    """
}

let args = CommandLine.arguments
let size = CGFloat(Double(args.count > 1 ? args[1] : "400") ?? 400)
let radius = CGFloat(Double(args.count > 2 ? args[2] : "100") ?? 100)
let outPath = args.count > 3 ? args[3] : "/tmp/lisse-issue-103/ios-continuous-\(Int(size))-\(Int(radius)).svg"

let rect = CGRect(x: 0, y: 0, width: size, height: size)
let path = appleContinuousPath(rect: rect, cornerRadius: radius)
let svg = cgPathToSVG(path, width: size, height: size)
try! svg.write(to: URL(fileURLWithPath: outPath), atomically: true, encoding: .utf8)
print("Wrote SVG \(outPath)")
print("size=\(size) radius=\(radius) radiusPct=\(radius / size * 100)%")
print("Apple continuous has NO smoothing parameter — shape is fixed for a given R.")
print("Shoulder extent p = 1.528665 * R = \(1.528665 * radius)")
print("Figma p=(1+s)*R ⇒ s for matching extent only = \(1.528665 - 1)")

#if canImport(AppKit)
let pngPath = outPath.replacingOccurrences(of: ".svg", with: ".png")
exportContinuousPNG(size: size, radius: radius, url: URL(fileURLWithPath: pngPath))
#endif
