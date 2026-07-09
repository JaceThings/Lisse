import { useCallback, useState } from "react";
import { FigureCard } from "../FigureCard.tsx";
import { Preview } from "../Preview.tsx";
import { RadioPillGroup } from "../RadioPillGroup.tsx";
import { Section } from "../Section.tsx";
import { Slider } from "../Slider.tsx";
import { useStateSpring } from "../springs.ts";
import { ROW_DIVIDER } from "../styles.ts";
import { m } from "../../../paraglide/messages.js";

// The figure morphs between these three targets. The corner radius is fixed
// (CAPSULE_RADIUS) and each capsule's short side is exactly 2× that radius,
// so the ends resolve to true smoothed caps; the square stays a rounded
// square. Scaled from 300×120 / 200×200 / 120×300 to fit the canvas.
const CAPSULE_RADIUS = 42;
const SHAPES = {
  horizontal: { width: 210, height: 84 },
  square: { width: 140, height: 140 },
  vertical: { width: 84, height: 210 },
} as const;

type Shape = keyof typeof SHAPES;

const formatSmoothing = (v: number) => v.toFixed(2);

export function CapsuleSection() {
  const SHAPE_OPTIONS = [
    { value: "horizontal", label: m.section_capsule_shape_horizontal() },
    { value: "square", label: m.section_capsule_shape_square() },
    { value: "vertical", label: m.section_capsule_shape_vertical() },
  ] as const satisfies ReadonlyArray<{ value: Shape; label: string }>;

  // Animate the container between the shape targets; SmoothCorners
  // re-clips on every resize, so the path tracks the tween frame by frame.
  const [shape, setShape] = useState<Shape>("horizontal");
  const target = SHAPES[shape];
  const animatedWidth = useStateSpring(target.width, false);
  const animatedHeight = useStateSpring(target.height, false);

  const [morphSmoothing, setMorphSmoothing] = useState(0.6);
  const [morphFromDrag, setMorphFromDrag] = useState(false);
  const animatedMorphSmoothing = useStateSpring(morphSmoothing, morphFromDrag);

  const onMorphSmoothingChange = useCallback((v: number, fromDrag = false) => {
    setMorphFromDrag(fromDrag);
    setMorphSmoothing(v);
  }, []);

  return (
    <Section
      title={m.section_capsule_title()}
      description={m.section_capsule_desc()}
    >
      <FigureCard>
        <Preview
          corners={{ radius: CAPSULE_RADIUS, smoothing: animatedMorphSmoothing }}
          width={animatedWidth}
          height={animatedHeight}
        />
        <div className={`w-full ${ROW_DIVIDER}`}>
          <RadioPillGroup
            ariaLabel={m.section_capsule_shape_aria()}
            options={SHAPE_OPTIONS}
            value={shape}
            onChange={setShape}
          />
        </div>
        <div className={`flex w-full flex-col items-center justify-center p-4 ${ROW_DIVIDER}`}>
          <Slider
            label={m.section_capsule_smoothing_slider_label()}
            value={morphSmoothing}
            min={0}
            max={1}
            step={0.01}
            format={formatSmoothing}
            onChange={onMorphSmoothingChange}
          />
        </div>
      </FigureCard>
    </Section>
  );
}
