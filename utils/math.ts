
import { Point } from '../types';

export const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const randomInt = (min: number, max: number) => Math.floor(randomRange(min, max));
