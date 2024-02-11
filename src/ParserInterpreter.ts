/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

/* eslint-disable no-underscore-dangle */

import { ATNState } from "./atn/ATNState.js";
import { BitSet } from "./misc/BitSet.js";
import { FailedPredicateException } from "./FailedPredicateException.js";
import { InputMismatchException } from "./InputMismatchException.js";
import { InterpreterRuleContext } from "./InterpreterRuleContext.js";
import { LoopEndState } from "./atn/LoopEndState.js";
import { Parser } from "./Parser.js";
import { ParserATNSimulator } from "./atn/ParserATNSimulator.js";
import { RecognitionException } from "./RecognitionException.js";
import { StarLoopEntryState } from "./atn/StarLoopEntryState.js";
import { Token } from "./Token.js";
import { ATNStateType } from "./atn/ATNStateType.js";
import { TransitionType } from "./atn/TransitionType.js";
import { DFA } from "./dfa/DFA.js";
import { PredictionContextCache } from "./atn/PredictionContextCache.js";
import { ATN } from "./atn/ATN.js";
import { Vocabulary } from "./Vocabulary.js";
import { TokenStream } from "./TokenStream.js";
import { ParserRuleContext } from "./ParserRuleContext.js";
import { RuleStartState } from "./atn/RuleStartState.js";
import { RuleTransition } from "./atn/RuleTransition.js";
import { PredicateTransition } from "./atn/PredicateTransition.js";
import { ActionTransition } from "./atn/ActionTransition.js";
import { PrecedencePredicateTransition } from "./atn/PrecedencePredicateTransition.js";
import { DecisionState } from "./atn/DecisionState.js";
import { TokenSource } from "./TokenSource.js";
import { CharStream } from "./CharStream.js";

export class ParserInterpreter extends Parser {
    public rootContext: InterpreterRuleContext;

    #overrideDecision = -1;
    #overrideDecisionInputIndex = -1;
    #overrideDecisionAlt = -1;
    #overrideDecisionReached = false;

    #overrideDecisionRoot: InterpreterRuleContext | null = null;
    #parentContextStack: Array<[ParserRuleContext | null, number]> = [];

    #grammarFileName: string;
    #atn: ATN;
    #ruleNames: string[];
    #vocabulary: Vocabulary;
    #decisionToDFA: DFA[];
    #sharedContextCache = new PredictionContextCache();

    #pushRecursionContextStates;

    public constructor(grammarFileName: string, vocabulary: Vocabulary, ruleNames: string[], atn: ATN,
        input: TokenStream) {
        super(input);
        this.#grammarFileName = grammarFileName;
        this.#atn = atn;
        this.#ruleNames = ruleNames.slice(0);
        this.#vocabulary = vocabulary;

        // Cache the ATN states where pushNewRecursionContext() must be called in `visitState()`.
        this.#pushRecursionContextStates = new BitSet();
        for (const state of atn.states) {
            if (state instanceof StarLoopEntryState && state.precedenceRuleDecision) {
                this.#pushRecursionContextStates.set(state.stateNumber);
            }
        }

        this.#decisionToDFA = atn.decisionToState.map((ds, i) => {
            return new DFA(ds, i);
        });

        // get atn simulator that knows how to do predictions
        this.interpreter = new ParserATNSimulator(this, atn, this.#decisionToDFA, this.#sharedContextCache);
    }

    public override reset(): void {
        super.reset();

        this.#overrideDecisionReached = false;
        this.#overrideDecisionRoot = null;
    }

    public override get atn(): ATN {
        return this.#atn;
    }

    public get vocabulary(): Vocabulary {
        return this.#vocabulary;
    }

    public get ruleNames(): string[] {
        return this.#ruleNames;
    }

    public get grammarFileName(): string {
        return this.#grammarFileName;
    }

    public get atnState(): ATNState {
        return this.#atn.states[this.state]!;
    }

    public parse(startRuleIndex: number): ParserRuleContext {
        const startRuleStartState = this.#atn.ruleToStartState[startRuleIndex]!;

        this.rootContext = this.createInterpreterRuleContext(null, ATNState.INVALID_STATE_NUMBER, startRuleIndex);
        if (startRuleStartState.isPrecedenceRule) {
            this.enterRecursionRule(this.rootContext, startRuleStartState.stateNumber, startRuleIndex, 0);
        }
        else {
            this.enterRule(this.rootContext, startRuleStartState.stateNumber, startRuleIndex);
        }

        while (true) {
            const p = this.atnState;
            switch (p.stateType) {
                case ATNStateType.RULE_STOP:
                    // pop; return from rule
                    if (this.context?.isEmpty) {
                        if (startRuleStartState.isPrecedenceRule) {
                            const result = this.context;
                            const parentContext = this.#parentContextStack.pop()!;
                            this.unrollRecursionContexts(parentContext[0]);

                            return result;
                        }
                        else {
                            this.exitRule();

                            return this.rootContext;
                        }
                    }

                    this.visitRuleStopState(p);
                    break;

                default:
                    try {
                        this.visitState(p);
                    } catch (e) {
                        if (e instanceof RecognitionException) {
                            this.state = this.#atn.ruleToStopState[p.ruleIndex]!.stateNumber;
                            this.context!.exception = e;
                            this.errorHandler.reportError(this, e);
                            this.recover(e);
                        } else {
                            throw e;
                        }
                    }

                    break;
            }
        }
    }

    public addDecisionOverride(decision: number, tokenIndex: number, forcedAlt: number): void {
        this.#overrideDecision = decision;
        this.#overrideDecisionInputIndex = tokenIndex;
        this.#overrideDecisionAlt = forcedAlt;
    }

    public get overrideDecisionRoot(): InterpreterRuleContext | null {
        return this.#overrideDecisionRoot;
    }

    public override enterRecursionRule(localctx: ParserRuleContext, state: number, ruleIndex: number,
        precedence: number): void {
        this.#parentContextStack.push([this.context, localctx.invokingState]);
        super.enterRecursionRule(localctx, state, ruleIndex, precedence);
    }

    protected visitState(p: ATNState): void {
        let predictedAlt = 1;
        if (p instanceof DecisionState) {
            predictedAlt = this.visitDecisionState(p);
        }

        const transition = p.transitions[predictedAlt - 1];
        switch (transition.serializationType) {
            case TransitionType.EPSILON:
                if (this.#pushRecursionContextStates.get(p.stateNumber) &&
                    !(transition.target instanceof LoopEndState)) {
                    // We are at the start of a left recursive rule's (...)* loop
                    // and we're not taking the exit branch of loop.
                    const parentContext = this.#parentContextStack[this.#parentContextStack.length - 1];
                    const localctx =
                        this.createInterpreterRuleContext(parentContext[0], parentContext[1], this.context!.ruleIndex);
                    this.pushNewRecursionContext(localctx, this.#atn.ruleToStartState[p.ruleIndex]!.stateNumber,
                        this.context!.ruleIndex);
                }
                break;

            case TransitionType.ATOM:
                this.match(transition.label!.minElement);
                break;

            case TransitionType.RANGE:
            case TransitionType.SET:
            case TransitionType.NOT_SET:
                if (!transition.matches(this.inputStream!.LA(1), Token.MIN_USER_TOKEN_TYPE, 65535)) {
                    this.recoverInline();
                }
                this.matchWildcard();
                break;

            case TransitionType.WILDCARD:
                this.matchWildcard();
                break;

            case TransitionType.RULE:
                const ruleStartState = transition.target as RuleStartState;
                const ruleIndex = ruleStartState.ruleIndex;
                const newContext = this.createInterpreterRuleContext(this.context, p.stateNumber, ruleIndex);
                if (ruleStartState.isPrecedenceRule) {
                    this.enterRecursionRule(newContext, ruleStartState.stateNumber, ruleIndex,
                        (transition as RuleTransition).precedence);
                }
                else {
                    this.enterRule(newContext, transition.target.stateNumber, ruleIndex);
                }
                break;

            case TransitionType.PREDICATE:
                const predicateTransition = transition as PredicateTransition;
                if (!this.sempred(this.context, predicateTransition.ruleIndex, predicateTransition.predIndex)) {
                    throw new FailedPredicateException(this);
                }

                break;

            case TransitionType.ACTION:
                const actionTransition = transition as ActionTransition;
                this.action(this.context, actionTransition.ruleIndex, actionTransition.actionIndex);
                break;

            case TransitionType.PRECEDENCE:
                if (!this.precpred(this.context, (transition as PrecedencePredicateTransition).precedence)) {
                    const precedence = (transition as PrecedencePredicateTransition).precedence;
                    throw new FailedPredicateException(this, `precpred(_ctx, ${precedence})`);
                }
                break;

            default:
                throw new Error("UnsupportedOperationException: Unrecognized ATN transition type.");
        }

        this.state = transition.target.stateNumber;
    }

    protected visitDecisionState(p: DecisionState): number {
        let predictedAlt = 1;

        if (p.transitions.length > 1) {
            this.errorHandler.sync(this);
            const decision = p.decision;
            if (decision === this.#overrideDecision && this.inputStream!.index === this.#overrideDecisionInputIndex &&
                !this.#overrideDecisionReached) {
                predictedAlt = this.#overrideDecisionAlt;
                this.#overrideDecisionReached = true;
            } else {
                predictedAlt = this.interpreter.adaptivePredict(this.inputStream!, decision, this.context);
            }
        }

        return predictedAlt;
    }

    protected createInterpreterRuleContext(parent: ParserRuleContext | null, invokingStateNumber: number,
        ruleIndex: number): InterpreterRuleContext {
        return new InterpreterRuleContext(ruleIndex, parent, invokingStateNumber);
    }

    protected visitRuleStopState(p: ATNState): void {
        const ruleStartState = this.#atn.ruleToStartState[p.ruleIndex]!;
        if (ruleStartState.isPrecedenceRule) {
            const [parentContext, state] = this.#parentContextStack.pop()!;
            this.unrollRecursionContexts(parentContext);
            this.state = state;
        } else {
            this.exitRule();
        }

        const ruleTransition = this.#atn.states[this.state]!.transitions[0] as RuleTransition;
        this.state = ruleTransition.followState.stateNumber;
    }

    protected recover(e: RecognitionException): void {
        const i = this.inputStream!.index;
        this.errorHandler.recover(this, e);
        if (this.inputStream!.index === i) {
            // no input consumed, better add an error node
            const tok = e.offendingToken;
            if (!tok) {
                throw new Error("Expected exception to have an offending token");
            }

            const source = tok.tokenSource;
            const stream = source?.inputStream ?? null;
            const sourcePair: [TokenSource | null, CharStream | null] = [source, stream];

            if (e instanceof InputMismatchException) {
                const expectedTokens = e.getExpectedTokens();
                if (!expectedTokens) {
                    throw new Error("Expected the exception to provide expected tokens");
                }

                let expectedTokenType = Token.INVALID_TYPE;
                if (!expectedTokens.isNil) {
                    // get any element
                    expectedTokenType = expectedTokens.minElement;
                }

                const errToken = this.getTokenFactory().create(sourcePair, expectedTokenType, tok.text,
                    Token.DEFAULT_CHANNEL, -1, -1, tok.line, tok.column);
                this.context!.addErrorNode(this.createErrorNode(this.context!, errToken));
            } else { // NoViableAlt
                const errToken = this.getTokenFactory().create(sourcePair, Token.INVALID_TYPE, tok.text,
                    Token.DEFAULT_CHANNEL, -1, -1, tok.line, tok.column);
                this.context!.addErrorNode(this.createErrorNode(this.context!, errToken));
            }
        }
    }

    protected recoverInline(): Token {
        return this.errorHandler.recoverInline(this);
    }
}
