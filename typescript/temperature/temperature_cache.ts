/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This file is automatically generated. Do not modify it.

import {Hct} from '../hct/hct';
import * as colorUtils from '../utils/color_utils';
import * as mathUtils from '../utils/math_utils';

/**
 * Design utilities using color temperature theory.
 *
 * Analogous colors, complementary color, and cache to efficiently, lazily,
 * generate data for calculations when needed.
 */
export class TemperatureCache {
  constructor(public input: Hct) {}

  hctsByTempCache: Hct[] = [];
  hctsByHueCache: Hct[] = [];
  tempsByHctCache = new Map<Hct, number>();
  inputRelativeTemperatureCache: number = -1.0;
  complementCache: Hct|null = null;

  get hctsByTemp(): Hct[] {
    if (this.hctsByTempCache.length > 0) {
      return this.hctsByTempCache;
    }

    const hcts = this.hctsByHue.concat([this.input]);
    const temperaturesByHct = this.tempsByHct;
    hcts.sort((a, b) => temperaturesByHct.get(a)! - temperaturesByHct.get(b)!);
    this.hctsByTempCache = hcts;
    return hcts;
  }

  get warmest(): Hct {
    return this.hctsByTemp[this.hctsByTemp.length - 1];
  }

  get coldest(): Hct {
    return this.hctsByTemp[0];
  }

  /**
   * A set of colors with differing hues, equidistant in temperature.
   *
   * In art, this is usually described as a set of 5 colors on a color wheel
   * divided into 12 sections. This method allows provision of either of those
   * values.
   *
   * Behavior is undefined when [count] or [divisions] is 0.
   * When divisions < count, colors repeat.
   *
   * [count] The number of colors to return, includes the input color.
   * [divisions] The number of divisions on the color wheel.
   */
  analogous(count = 5, divisions = 12): Hct[] {
    const startHue = Math.round(this.input.hue);
    const startHct = this.hctsByHue[startHue];
    let lastTemp = this.relativeTemperature(startHct);
    const allColors = [startHct];

    let absoluteTotalTempDelta = 0.0;
    for (let i = 0; i < 360; i++) {
      const hue = mathUtils.sanitizeDegreesInt(startHue + i);
      const hct = this.hctsByHue[hue];
      const temp = this.relativeTemperature(hct);
      const tempDelta = Math.abs(temp - lastTemp);
      lastTemp = temp;
      absoluteTotalTempDelta += tempDelta;
    }
    let hueAddend = 1;
    const tempStep = absoluteTotalTempDelta / divisions;
    let totalTempDelta = 0.0;
    lastTemp = this.relativeTemperature(startHct);
    while (allColors.length < divisions) {
      const hue = mathUtils.sanitizeDegreesInt(startHue + hueAddend);
      const hct = this.hctsByHue[hue];
      const temp = this.relativeTemperature(hct);
      const tempDelta = Math.abs(temp - lastTemp);
      totalTempDelta += tempDelta;

      const desiredTotalTempDeltaForIndex = allColors.length * tempStep;
      let indexSatisfied = totalTempDelta >= desiredTotalTempDeltaForIndex;
      let indexAddend = 1;
      // Keep adding this hue to the answers until its temperature is
      // insufficient. This ensures consistent behavior when there aren't
      // [divisions] discrete steps between 0 and 360 in hue with [tempStep]
      // delta in temperature between them.
      //
      // For example, white and black have no analogues: there are no other
      // colors at T100/T0. Therefore, they should just be added to the array
      // as answers.
      while (indexSatisfied && allColors.length < divisions) {
        allColors.push(hct);
        const desiredTotalTempDeltaForIndex =
            ((allColors.length + indexAddend) * tempStep);
        indexSatisfied = totalTempDelta >= desiredTotalTempDeltaForIndex;
        indexAddend++;
      }
      lastTemp = temp;
      hueAddend++;
      if (hueAddend > 360) {
        while (allColors.length < divisions) {
          allColors.push(hct);
        }
        break;
      }
    }

    const answers = [this.input];

    // First, generate analogues from rotating counter-clockwise.
    const increaseHueCount = Math.floor((count - 1) / 2.0);
    for (let i = 1; i < (increaseHueCount + 1); i++) {
      let index = 0 - i;
      while (index < 0) {
        index = allColors.length + index;
      }
      if (index >= allColors.length) {
        index = index % allColors.length;
      }
      answers.splice(0, 0, allColors[index]);
    }

    // Second, generate analogues from rotating clockwise.
    const decreaseHueCount = count - increaseHueCount - 1;
    for (let i = 1; i < (decreaseHueCount + 1); i++) {
      let index = i;
      while (index < 0) {
        index = allColors.length + index;
      }
      if (index >= allColors.length) {
        index = index % allColors.length;
      }
      answers.push(allColors[index]);
    }

    return answers;
  }

  /**
   * A color that complements the input color aesthetically.
   *
   * In art, this is usually described as being across the color wheel.
   * History of this shows intent as a color that is just as cool-warm as the
   * input color is warm-cool.
   */
  get complement(): Hct {
    if (this.complementCache != null) {
      return this.complementCache;
    }

    const coldestHue = this.coldest.hue;
    const coldestTemp = this.tempsByHct.get(this.coldest)!;

    const warmestHue = this.warmest.hue;
    const warmestTemp = this.tempsByHct.get(this.warmest)!;
    const range = warmestTemp - coldestTemp;
    const startHueIsColdestToWarmest =
        TemperatureCache.isBetween(this.input.hue, coldestHue, warmestHue);
    const startHue = startHueIsColdestToWarmest ? warmestHue : coldestHue;
    const endHue = startHueIsColdestToWarmest ? coldestHue : warmestHue;
    const directionOfRotation = 1.0;
    let smallestError = 1000.0;
    let answer = this.hctsByHue[Math.round(this.input.hue)];

    const complementRelativeTemp = 1.0 - this.inputRelativeTemperature;
    // Find the color in the other section, closest to the inverse percentile
    // of the input color. This is the complement.
    for (let hueAddend = 0.0; hueAddend <= 360.0; hueAddend += 1.0) {
      const hue = mathUtils.sanitizeDegreesDouble(
          startHue + directionOfRotation * hueAddend);
      if (!TemperatureCache.isBetween(hue, startHue, endHue)) {
        continue;
      }
      const possibleAnswer = this.hctsByHue[Math.round(hue)];
      const relativeTemp =
          (this.tempsByHct.get(possibleAnswer)! - coldestTemp) / range;
      const error = Math.abs(complementRelativeTemp - relativeTemp);
      if (error < smallestError) {
        smallestError = error;
        answer = possibleAnswer;
      }
    }
    this.complementCache = answer;
    return this.complementCache;
  }

  /**
   * Temperature relative to all colors with the same chroma and tone.
   * Value on a scale from 0 to 1.
   */
  relativeTemperature(hct: Hct): number {
    const range =
        this.tempsByHct.get(this.warmest)! - this.tempsByHct.get(this.coldest)!;
    const differenceFromColdest =
        this.tempsByHct.get(hct)! - this.tempsByHct.get(this.coldest)!;
    // Handle when there's no difference in temperature between warmest and
    // coldest: for example, at T100, only one color is available, white.
    if (range === 0.0) {
      return 0.5;
    }
    return differenceFromColdest / range;
  }

  /** Relative temperature of the input color. See [relativeTemperature]. */
  get inputRelativeTemperature(): number {
    if (this.inputRelativeTemperatureCache >= 0.0) {
      return this.inputRelativeTemperatureCache;
    }

    this.inputRelativeTemperatureCache = this.relativeTemperature(this.input);
    return this.inputRelativeTemperatureCache;
  }

  /** A Map with keys of HCTs in [hctsByTemp], values of raw temperature. */
  get tempsByHct(): Map<Hct, number> {
    if (this.tempsByHctCache.size > 0) {
      return this.tempsByHctCache;
    }
    const allHcts = this.hctsByHue.concat([this.input]);
    const temperaturesByHct = new Map<Hct, number>();
    for (const e of allHcts) {
      temperaturesByHct.set(e, TemperatureCache.rawTemperature(e));
    }
    this.tempsByHctCache = temperaturesByHct;
    return temperaturesByHct;
  }

  /**
   * HCTs for all hues, with the same chroma/tone as the input.
   * Sorted ascending, hue 0 to 360.
   */
  get hctsByHue(): Hct[] {
    if (this.hctsByHueCache.length > 0) {
      return this.hctsByHueCache;
    }
    const hcts: Hct[] = [];
    for (let hue = 0.0; hue <= 360.0; hue += 1.0) {
      const colorAtHue = Hct.from(hue, this.input.chroma, this.input.tone);
      hcts.push(colorAtHue);
    }
    this.hctsByHueCache = hcts;
    return this.hctsByHueCache;
  }

  /** Determines if an angle is between two other angles, rotating clockwise. */
  static isBetween(angle: number, a: number, b: number): boolean {
    if (a < b) {
      return a <= angle && angle <= b;
    }
    return a <= angle || angle <= b;
  }

  /**
   * Value representing cool-warm factor of a color.
   * Values below 0 are considered cool, above, warm.
   *
   * Color science has researched emotion and harmony, which art uses to select
   * colors. Warm-cool is the foundation of analogous and complementary colors.
   * See:
   * - Li-Chen Ou's Chapter 19 in Handbook of Color Psychology (2015).
   * - Josef Albers' Interaction of Color chapters 19 and 21.
   *
   * Implementation of Ou, Woodcock and Wright's algorithm, which uses
   * L*a*b* / LCH color space.
   * Return value has these properties:
   * - Values below 0 are cool, above 0 are warm.
   * - Lower bound: -0.52 - (chroma ^ 1.07 / 20). L*a*b* chroma is infinite.
   *   Assuming max of 130 chroma, -9.66.
   * - Upper bound: -0.52 + (chroma ^ 1.07 / 20). L*a*b* chroma is infinite.
   *   Assuming max of 130 chroma, 8.61.
   */
  static rawTemperature(color: Hct): number {
    const lab = colorUtils.labFromArgb(color.toInt());
    const hue = mathUtils.sanitizeDegreesDouble(
        Math.atan2(lab[2], lab[1]) * 180.0 / Math.PI);
    const chroma = Math.sqrt((lab[1] * lab[1]) + (lab[2] * lab[2]));
    const temperature = -0.5 +
        0.02 * Math.pow(chroma, 1.07) *
            Math.cos(
                mathUtils.sanitizeDegreesDouble(hue - 50.0) * Math.PI / 180.0,
            );
    return temperature;
  }
}
