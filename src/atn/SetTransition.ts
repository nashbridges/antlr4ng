/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

// A transition containing a set of values.
import { IntervalSet } from "../misc/IntervalSet.js";
import { Token } from "../Token.js";
import { ATNState } from "./ATNState.js";
import { Transition } from "./Transition.js";
import { TransitionType } from "./TransitionType.js";

export class SetTransition extends Transition {
    public set: IntervalSet;

    public constructor(target: ATNState, set: IntervalSet) {
        super(target);
        if (set !== undefined && set !== null) {
            this.set = set;
        } else {
            this.set = new IntervalSet();
            this.set.addOne(Token.INVALID_TYPE);
        }
    }

    public get serializationType(): number {
        return TransitionType.SET;
    }

    public override matches(symbol: number, _minVocabSymbol: number, _maxVocabSymbol: number): boolean {
        return this.set.contains(symbol);
    }

    public override toString(): string {
        return this.set.toString();
    }
}
