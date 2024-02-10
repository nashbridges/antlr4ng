/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

/* eslint-disable jsdoc/require-returns */

import type { CharStream } from "../../CharStream.js";
import { Token } from "../../Token.js";
import type { TokenSource } from "../../TokenSource.js";

/**
 * A {@link Token} object representing an entire subtree matched by a parser
 * rule; e.g., {@code <expr>}. These tokens are created for {@link TagChunk}
 * chunks where the tag corresponds to a parser rule.
 */
export class RuleTagToken implements Token {
    /** The name of the label associated with the rule tag. */
    public readonly label?: string;

    /** The name of the parser rule associated with this rule tag. */
    public readonly ruleName: string;

    /**
     * The token type for the current token. This is the token type assigned to
     * the bypass alternative for the rule during ATN deserialization.
     */
    private readonly bypassTokenType: number;

    /**
     * Constructs a new instance of {@link RuleTagToken} with the specified rule
     * name and bypass token type and no label.
     *
     * @param ruleName The name of the parser rule this rule tag matches.
     * @param bypassTokenType The bypass token type assigned to the parser rule.
     *
     * @throws IllegalArgumentException if {@code ruleName} is {@code null}
     * or empty.
     */
    public constructor(ruleName: string, bypassTokenType: number);
    /**
     * Constructs a new instance of {@link RuleTagToken} with the specified rule
     * name, bypass token type, and label.
     *
     * @param ruleName The name of the parser rule this rule tag matches.
     * @param bypassTokenType The bypass token type assigned to the parser rule.
     * @param label The label associated with the rule tag, or {@code null} if
     * the rule tag is unlabeled.
     *
     * @throws IllegalArgumentException if {@code ruleName} is {@code null}
     * or empty.
     */
    public constructor(ruleName: string, bypassTokenType: number, label: string | null);
    public constructor(ruleName: string, bypassTokenType: number, label?: string | null) {
        this.ruleName = ruleName;
        this.bypassTokenType = bypassTokenType;
        this.label = label ?? undefined;
    }

    /**
     * <p>Rule tag tokens are always placed on the {@link #DEFAULT_CHANNEL}.</p>
     */
    public get channel(): number {
        return Token.DEFAULT_CHANNEL;
    }

    /**
     * <p>This method returns the rule tag formatted with {@code <} and {@code >}
     * delimiters.</p>
     */
    public get text(): string {
        if (this.label !== null) {
            return "<" + this.label + ":" + this.ruleName + ">";
        }

        return "<" + this.ruleName + ">";
    }

    /**
     * <p>Rule tag tokens have types assigned according to the rule bypass
     * transitions created during ATN deserialization.</p>
     */
    public get type(): number {
        return this.bypassTokenType;
    }

    /**
     * <p>The implementation for {@link RuleTagToken} always returns 0.</p>
     */
    public get line(): number {
        return 0;
    }

    /**
     * <p>The implementation for {@link RuleTagToken} always returns -1.</p>
     */
    public get column(): number {
        return -1;
    }

    /**
     * <p>The implementation for {@link RuleTagToken} always returns -1.</p>
     */
    public get tokenIndex(): number {
        return -1;
    }

    /**
     * <p>The implementation for {@link RuleTagToken} always returns -1.</p>
     */
    public get start(): number {
        return -1;
    }

    /**
     * <p>The implementation for {@link RuleTagToken} always returns -1.</p>
     */
    public get stop(): number {
        return -1;
    }

    /**
     * <p>The implementation for {@link RuleTagToken} always returns {@code null}.</p>
     */
    public get tokenSource(): TokenSource | null {
        return null;
    }

    /**
     * <p>The implementation for {@link RuleTagToken} always returns {@code null}.</p>
     */
    public get inputStream(): CharStream | null {
        return null;
    }

    /**
     * <p>The implementation for {@link RuleTagToken} returns a string of the form
     * {@code ruleName:bypassTokenType}.</p>
     */
    public toString(): string {
        return this.ruleName + ":" + this.bypassTokenType;
    }
}
