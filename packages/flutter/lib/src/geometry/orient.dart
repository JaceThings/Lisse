/// Corner orientation in clockwise traversal. Each builder writes a
/// canonical (entry → exit) curve and is rotated to a corner via these
/// transforms, so the math is derived once.
enum Orient { tr, br, bl, tl }

/// Rotate a canonical (X = entry direction, Y = exit direction) delta into
/// the display dx for [orient]. Clockwise traversal:
///   TR — enter +x, exit +y   BR — enter +y, exit −x
///   BL — enter −x, exit −y    TL — enter −y, exit +x
double transformX(double x, double y, Orient orient) {
  switch (orient) {
    case Orient.tr:
      return x;
    case Orient.br:
      return -y;
    case Orient.bl:
      return -x;
    case Orient.tl:
      return y;
  }
}

double transformY(double x, double y, Orient orient) {
  switch (orient) {
    case Orient.tr:
      return y;
    case Orient.br:
      return x;
    case Orient.bl:
      return -y;
    case Orient.tl:
      return -x;
  }
}
