#!/usr/bin/env swift
import Foundation
import SwiftUI

let size: CGFloat = 400
let radius: CGFloat = 100 // 25% — issue geometry

let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
let path = shape.path(in: CGRect(x: 0, y: 0, width: size, height: size))

var d = ""
path.cgPath.applyWithBlock { elementPtr in
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

let svg = """
<svg xmlns="http://www.w3.org/2000/svg" width="\(Int(size))" height="\(Int(size))" viewBox="0 0 \(size) \(size)">
  <path fill="#007AFF" d="\(d.trimmingCharacters(in: .whitespaces))"/>
</svg>
"""
let out = "/tmp/lisse-issue-103/swiftui-continuous-400-100.svg"
try! svg.write(to: URL(fileURLWithPath: out), atomically: true, encoding: .utf8)
print("Wrote \(out)")
print("SwiftUI RoundedRectangle(style: .continuous) — Apple exposes NO smoothing parameter.")
print("d length: \(d.count)")
print("preview: \(String(d.prefix(400)))")
