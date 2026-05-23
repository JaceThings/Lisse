import { buildSquircle } from '../packages/core/src/curves/index.ts';
import { generatePath } from '../packages/core/src/index.ts';

// Phase 2 will refactor generatePath to dispatch through buildSquircle.
// Right now we just verify that the new buildSquircle's TR segment
// matches what the existing draw.ts would have produced — so that the
// future dispatcher can wire things up without changing output.
const params = { cornerRadius: 40, smoothing: 0.6, exponent: 4, preserveSmoothing: true, roundingAndSmoothingBudget: 1e9 };

const sq = buildSquircle(params);

const skeleton = (W, H, p, segTR, segBR, segBL, segTL) => `
    M ${p} 0
    L ${W - p} 0
    ${segTR}
    L ${W} ${p}
    L ${W} ${H - p}
    ${segBR}
    L ${W - p} ${H}
    L ${p} ${H}
    ${segBL}
    L 0 ${H - p}
    L 0 ${p}
    ${segTL}
    Z
  `.replace(/[\t\s\n]+/g, " ").trim();

const newPath = skeleton(
  200, 200, sq.p,
  sq.pathSegment('TR'),
  sq.pathSegment('BR'),
  sq.pathSegment('BL'),
  sq.pathSegment('TL'),
);
const oldPath = generatePath(200, 200, { radius: 40, smoothing: 0.6 });

console.log('NEW:', newPath);
console.log('');
console.log('OLD:', oldPath);
console.log('');
console.log('MATCH:', newPath === oldPath ? 'YES' : 'NO');
if (newPath !== oldPath) {
  for (let i = 0; i < Math.max(newPath.length, oldPath.length); i++) {
    if (newPath[i] !== oldPath[i]) {
      console.log(`differs at i=${i}: NEW='${newPath.slice(Math.max(0,i-10), i+10)}' OLD='${oldPath.slice(Math.max(0,i-10), i+10)}'`);
      break;
    }
  }
}
