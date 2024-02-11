/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

/* eslint-disable @typescript-eslint/naming-convention, jsdoc/require-returns, jsdoc/require-param */

import { Recognizer } from "../Recognizer.js";
import { HashCode } from "../misc/HashCode.js";
import { ATNSimulator } from "./ATNSimulator.js";

// Most of the implementation is located in PredictionContextUtils.ts, to avoid circular dependencies.

export abstract class PredictionContext {
    /**
     * Represents `$` in an array in full context mode, when `$`
     * doesn't mean wildcard: `$ + x = [$,x]`. Here,
     * `$` = {@link EMPTY_RETURN_STATE}.
     */
    public static readonly EMPTY_RETURN_STATE = 0x7FFFFFFF;

    // TODO: Temporarily here. Should be moved to EmptyPredictionContext. It's initialized in that context class.
    public static EMPTY: PredictionContext;

    public static trace_atn_sim = false;

    private cachedHashCode: number;

    public constructor(cachedHashCode: number) {
        this.cachedHashCode = cachedHashCode;
    }

    public isEmpty(): boolean {
        return false;
    }

    public hasEmptyPath(): boolean {
        return this.getReturnState(this.length - 1) === PredictionContext.EMPTY_RETURN_STATE;
    }

    public hashCode(): number {
        return this.cachedHashCode;
    }

    public updateHashCode(hash: HashCode): void {
        hash.update(this.cachedHashCode);
    }

    public toString(_recog?: Recognizer<ATNSimulator>): string {
        return "";
    }

    public abstract getParent(index: number): PredictionContext | null;
    public abstract getReturnState(index: number): number;
    public abstract get length(): number;
    public abstract equals(obj: unknown): boolean;
}
