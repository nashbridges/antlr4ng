/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

/* eslint-disable no-underscore-dangle */

import { Token } from "../Token.js";
import { ATNConfig } from "./ATNConfig.js";
import { IntervalSet } from "../misc/IntervalSet.js";
import { RuleStopState } from "./RuleStopState.js";
import { RuleTransition } from "./RuleTransition.js";
import { NotSetTransition } from "./NotSetTransition.js";
import { WildcardTransition } from "./WildcardTransition.js";
import { AbstractPredicateTransition } from "./AbstractPredicateTransition.js";
import { predictionContextFromRuleContext } from "./PredictionContextUtils.js";
import { PredictionContext } from "./PredictionContext.js";
import { SingletonPredictionContext } from "./SingletonPredictionContext.js";
import { BitSet } from "../misc/BitSet.js";
import { HashSet } from "../misc/HashSet.js";
import { ATNState } from "./ATNState.js";
import { ATN } from "./ATN.js";
import { RuleContext } from "../RuleContext.js";

export class LL1Analyzer {
    /**
     * Special value added to the lookahead sets to indicate that we hit
     *  a predicate during analysis if {@code seeThruPreds==false}.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static readonly HIT_PRED = Token.INVALID_TYPE;

    public readonly atn: ATN;

    public constructor(atn: ATN) {
        this.atn = atn;
    }

    /**
     * Calculates the SLL(1) expected lookahead set for each outgoing transition
     * of an {@link ATNState}. The returned array has one element for each
     * outgoing transition in {@code s}. If the closure from transition
     * <em>i</em> leads to a semantic predicate before matching a symbol, the
     * element at index <em>i</em> of the result will be {@code null}.
     *
     * @param s the ATN state
     * @returns the expected symbols for each outgoing transition of {@code s}.
     */
    public getDecisionLookahead(s: ATNState | null): Array<IntervalSet | null> | null {
        if (s === null) {
            return null;
        }

        const count = s.transitions.length;
        const look = new Array<IntervalSet | null>(count);
        look.fill(null);
        for (let alt = 0; alt < count; alt++) {
            look[alt] = new IntervalSet();
            const lookBusy = new HashSet<ATNConfig>();
            const seeThruPreds = false; // fail to get lookahead upon pred
            this._LOOK(s.transitions[alt].target, null, PredictionContext.EMPTY,
                look[alt]!, lookBusy, new BitSet(), seeThruPreds, false);
            // Wipe out lookahead for this alternative if we found nothing
            // or we had a predicate when we !seeThruPreds
            if (look[alt]!.length === 0 || look[alt]!.contains(LL1Analyzer.HIT_PRED)) {
                look[alt] = null;
            }
        }

        return look;
    }

    /**
     * Compute set of tokens that can follow {@code s} in the ATN in the
     * specified {@code ctx}.
     *
     * <p>If {@code ctx} is {@code null} and the end of the rule containing
     * {@code s} is reached, {@link Token//EPSILON} is added to the result set.
     * If {@code ctx} is not {@code null} and the end of the outermost rule is
     * reached, {@link Token//EOF} is added to the result set.</p>
     *
     * @param s the ATN state
     * @param stopState the ATN state to stop at. This can be a
     * {@link BlockEndState} to detect epsilon paths through a closure.
     * @param ctx the complete parser context, or {@code null} if the context
     * should be ignored
     *
     * @returns The set of tokens that can follow {@code s} in the ATN in the
     * specified {@code ctx}.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public LOOK(s: ATNState, stopState: ATNState | null, ctx: RuleContext | null): IntervalSet {
        const r = new IntervalSet();
        const seeThruPreds = true; // ignore preds; get all lookahead
        ctx = ctx || null;
        const lookContext = ctx !== null ? predictionContextFromRuleContext(s.atn!, ctx) : null;
        this._LOOK(s, stopState, lookContext, r, new HashSet(), new BitSet(), seeThruPreds, true);

        return r;
    }

    /**
     * Compute set of tokens that can follow {@code s} in the ATN in the
     * specified {@code ctx}.
     *
     * <p>If {@code ctx} is {@code null} and {@code stopState} or the end of the
     * rule containing {@code s} is reached, {@link Token//EPSILON} is added to
     * the result set. If {@code ctx} is not {@code null} and {@code addEOF} is
     * `true` and {@code stopState} or the end of the outermost rule is
     * reached, {@link Token//EOF} is added to the result set.</p>
     *
     * @param s the ATN state.
     * @param stopState the ATN state to stop at. This can be a
     * {@link BlockEndState} to detect epsilon paths through a closure.
     * @param ctx The outer context, or {@code null} if the outer context should
     * not be used.
     * @param look The result lookahead set.
     * @param lookBusy A set used for preventing epsilon closures in the ATN
     * from causing a stack overflow. Outside code should pass
     * {@code new CustomizedSet<ATNConfig>} for this argument.
     * @param calledRuleStack A set used for preventing left recursion in the
     * ATN from causing a stack overflow. Outside code should pass
     * {@code new BitSet()} for this argument.
     * @param seeThruPreds `true` to true semantic predicates as
     * implicitly `true` and "see through them", otherwise `false`
     * to treat semantic predicates as opaque and add {@link HIT_PRED} to the
     * result if one is encountered.
     * @param addEOF Add {@link Token//EOF} to the result if the end of the
     * outermost context is reached. This parameter has no effect if {@code ctx}
     * is {@code null}.
     */
    public _LOOK(s: ATNState, stopState: ATNState | null, ctx: PredictionContext | null, look: IntervalSet,
        lookBusy: HashSet<ATNConfig>, calledRuleStack: BitSet, seeThruPreds: boolean, addEOF: boolean): void {
        const c = new ATNConfig({ state: s, alt: 0, context: ctx }, null);
        if (lookBusy.has(c)) {
            return;
        }
        lookBusy.add(c);
        if (s === stopState) {
            if (ctx === null) {
                look.addOne(Token.EPSILON);

                return;
            } else if (ctx.isEmpty() && addEOF) {
                look.addOne(Token.EOF);

                return;
            }
        }
        if (s instanceof RuleStopState) {
            if (ctx === null) {
                look.addOne(Token.EPSILON);

                return;
            } else if (ctx.isEmpty() && addEOF) {
                look.addOne(Token.EOF);

                return;
            }
            if (ctx !== PredictionContext.EMPTY) {
                const removed = calledRuleStack.get(s.ruleIndex);
                try {
                    calledRuleStack.clear(s.ruleIndex);
                    // run thru all possible stack tops in ctx
                    for (let i = 0; i < ctx.length; i++) {
                        const returnState = this.atn.states[ctx.getReturnState(i)]!;
                        this._LOOK(returnState, stopState, ctx.getParent(i), look, lookBusy, calledRuleStack,
                            seeThruPreds, addEOF);
                    }
                } finally {
                    if (removed) {
                        calledRuleStack.set(s.ruleIndex);
                    }
                }

                return;
            }
        }

        for (const t of s.transitions) {
            if (t instanceof RuleTransition) {
                if (calledRuleStack.get(t.target.ruleIndex)) {
                    continue;
                }
                const newContext = SingletonPredictionContext.create(ctx, t.followState.stateNumber);
                try {
                    calledRuleStack.set(t.target.ruleIndex);
                    this._LOOK(t.target, stopState, newContext, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
                } finally {
                    calledRuleStack.clear(t.target.ruleIndex);
                }
            } else if (t instanceof AbstractPredicateTransition) {
                if (seeThruPreds) {
                    this._LOOK(t.target, stopState, ctx, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
                } else {
                    look.addOne(LL1Analyzer.HIT_PRED);
                }
            } else if (t.isEpsilon) {
                this._LOOK(t.target, stopState, ctx, look, lookBusy, calledRuleStack, seeThruPreds, addEOF);
            } else if (t.constructor === WildcardTransition) {
                look.addRange(Token.MIN_USER_TOKEN_TYPE, this.atn.maxTokenType);
            } else {
                let set = t.label;
                if (set !== null) {
                    if (t instanceof NotSetTransition) {
                        set = set.complement(Token.MIN_USER_TOKEN_TYPE, this.atn.maxTokenType);
                    }
                    look.addSet(set);
                }
            }
        }
    }
}
