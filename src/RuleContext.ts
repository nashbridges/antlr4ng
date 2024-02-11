/*
* Copyright (c) The ANTLR Project. All rights reserved.
* Use of this file is governed by the BSD 3-clause license that
* can be found in the LICENSE.txt file in the project root.
*/

/* eslint-disable jsdoc/require-param, jsdoc/require-returns */

import { Parser } from "./Parser.js";
import { Interval } from "./misc/Interval.js";
import { ParseTree } from "./tree/ParseTree.js";
import { ParseTreeVisitor } from "./tree/ParseTreeVisitor.js";
import { Trees } from "./tree/Trees.js";
import { ATN } from "./atn/ATN.js";

export class RuleContext implements ParseTree {
    // TODO: move to ParserRuleContext.
    public children: ParseTree[] | null = null;

    /**
     * What state invoked the rule associated with this context?
     *  The "return address" is the followState of invokingState
     *  If parent is null, this should be -1 this context object represents
     *  the start rule.
     */
    public invokingState: number;

    #parent: RuleContext | null = null;

    /**
     * A rule context is a record of a single rule invocation. It knows
     * which context invoked it, if any. If there is no parent context, then
     * naturally the invoking state is not valid.  The parent link
     * provides a chain upwards from the current rule invocation to the root
     * of the invocation tree, forming a stack. We actually carry no
     * information about the rule associated with this context (except
     * when parsing). We keep only the state number of the invoking state from
     * the ATN submachine that invoked this. Contrast this with the s
     * pointer inside ParserRuleContext that tracks the current state
     * being "executed" for the current rule.
     *
     * The parent contexts are useful for computing lookahead sets and
     * getting error information.
     *
     * These objects are used during parsing and prediction.
     * For the special case of parsers, we use the subclass
     * ParserRuleContext.
     *
     * @see ParserRuleContext
     */
    public constructor(parent?: RuleContext | null, invokingState?: number) {
        this.parent = parent ?? null;
        this.invokingState = invokingState ?? -1;
    }

    public get parent(): RuleContext | null {
        return this.#parent;
    }

    public set parent(parent: RuleContext | null) {
        this.#parent = parent;
    }

    public depth(): number {
        let n = 0;

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let p: RuleContext | null = this;
        while (p !== null) {
            p = p.parent;
            n += 1;
        }

        return n;
    }

    /**
     * A context is empty if there is no invoking state; meaning nobody call
     * current context.
     */
    public isEmpty(): boolean {
        return this.invokingState === -1;
    }

    // satisfy the ParseTree / SyntaxTree interface
    public getSourceInterval(): Interval {
        return Interval.INVALID_INTERVAL;
    }

    public get ruleContext(): RuleContext {
        return this;
    }

    public get ruleIndex(): number {
        return -1;
    }

    public getPayload(): RuleContext {
        return this;
    }

    /**
     * Return the combined text of all child nodes. This method only considers
     * tokens which have been added to the parse tree.
     *
     * Since tokens on hidden channels (e.g. whitespace or comments) are not
     * added to the parse trees, they will not appear in the output of this
     * method.
     */
    public getText(): string {
        if (!this.children || this.getChildCount() === 0) {
            return "";
        } else {
            return this.children.map((child) => {
                return child.getText();
            }).join("");
        }
    }

    /**
     * For rule associated with this parse tree internal node, return
     * the outer alternative number used to match the input. Default
     * implementation does not compute nor store this alt num. Create
     * a subclass of ParserRuleContext with backing field and set
     * option contextSuperClass.
     * to set it.
     */
    public getAltNumber(): number {
        return ATN.INVALID_ALT_NUMBER;
    }

    /**
     * Set the outer alternative number for this context node. Default
     * implementation does nothing to avoid backing field overhead for
     * trees that don't need it.  Create
     * a subclass of ParserRuleContext with backing field and set
     * option contextSuperClass.
     */
    public setAltNumber(_altNumber: number): void {
    }

    public getChild(_i: number): ParseTree | null {
        return null;
    }

    public getChildCount(): number {
        return 0;
    }

    public accept<T>(visitor: ParseTreeVisitor<T>): T | null {
        return visitor.visitChildren(this);
    }

    /**
     * Print out a whole tree, not just a node, in LISP format
     * (root child1 .. childN). Print just a node if this is a leaf.
     */
    public toStringTree(recog: Parser): string;
    public toStringTree(ruleNames: string[], recog: Parser): string;
    public toStringTree(...args: unknown[]): string {
        if (args.length === 1) {
            return Trees.toStringTree(this, null, args[0] as Parser);
        }

        return Trees.toStringTree(this, args[0] as string[], args[1] as Parser);
    }

    public toString(ruleNames?: string[] | null, stop?: RuleContext | null): string {
        ruleNames = ruleNames ?? null;
        stop = stop ?? null;

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let p: RuleContext | null = this;
        let s = "[";
        while (p !== null && p !== stop) {
            if (ruleNames === null) {
                if (!p.isEmpty()) {
                    s += p.invokingState;
                }
            } else {
                const ri = p.ruleIndex;
                const ruleName = (ri >= 0 && ri < ruleNames.length) ? ruleNames[ri]
                    : "" + ri;
                s += ruleName;
            }
            if (p.parent !== null && (ruleNames !== null || !p.parent.isEmpty())) {
                s += " ";
            }
            p = p.parent;
        }
        s += "]";

        return s;
    }
}
