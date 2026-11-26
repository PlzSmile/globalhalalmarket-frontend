import { niceMax, shortDay, smoothPath, toPoints } from './charts';

describe('charts', () => {
  it('scales values into the box, a flat series on one line', () => {
    expect(toPoints([0, 5, 10], 0, 10)).toEqual([{ x: 0, y: 100 }, { x: 50, y: 50 }, { x: 100, y: 0 }]);
    expect(toPoints([3, 3], 3, 3).map((p) => p.y)).toEqual([80, 80]);
  });

  it('draws a smooth path that starts at the first point and never leaves the box', () => {
    const d = smoothPath(toPoints([0, 10, 0, 10], 0, 10));
    expect(d.startsWith('M0 100')).toBe(true);
    const numbers = d.replace(/[MC]/g, ' ').trim().split(/\s+/).map(Number);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(100);
  });

  it('rounds the axis top and writes short UK dates', () => {
    expect(niceMax(0)).toBe(4);
    expect(niceMax(34)).toBe(40);
    expect(niceMax(7)).toBe(8);
    expect(shortDay('2026-07-15')).toBe('15 Jul');
  });
});
