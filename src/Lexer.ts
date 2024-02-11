/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

/* eslint-disable jsdoc/require-returns, jsdoc/require-param */

import { Token } from "./Token.js";
import { Recognizer } from "./Recognizer.js";
import { CommonTokenFactory } from "./CommonTokenFactory.js";
import { RecognitionException } from "./RecognitionException.js";
import { LexerNoViableAltException } from "./LexerNoViableAltException.js";
import { LexerATNSimulator } from "./atn/LexerATNSimulator.js";
import { CharStream } from "./CharStream.js";
import { TokenFactory } from "./TokenFactory.js";
import { TokenSource } from "./TokenSource.js";

/**
 * A lexer is recognizer that draws input symbols from a character stream.
 * lexer grammars result in a subclass of this object. A Lexer object
 * uses simplified match() and error recovery mechanisms in the interest of speed.
 */
export abstract class Lexer extends Recognizer<LexerATNSimulator> implements TokenSource {
    public static DEFAULT_MODE = 0;
    public static MORE = -2;
    public static SKIP = -3;

    public static DEFAULT_TOKEN_CHANNEL = Token.DEFAULT_CHANNEL;
    public static HIDDEN = Token.HIDDEN_CHANNEL;
    public static MIN_CHAR_VALUE = 0x0000;
    public static MAX_CHAR_VALUE = 0x10FFFF;

    /**
     * What character index in the stream did the current token start at?
     *  Needed, for example, to get the text for current token.  Set at
     *  the start of nextToken.
     */
    public tokenStartCharIndex = -1;

    /** The channel number for the current token */
    public channel = 0;

    /** The token type for the current token */
    public type = 0;

    /** The start column of the current token (the one that was last read by `nextToken`). */
    protected currentTokenColumn = 0;

    /**
     * The line on which the first character of the current token (the one that was last read by `nextToken`) resides.
     */
    protected currentTokenStartLine = 0;

    #input: CharStream;

    /**
     * The goal of all lexer rules/methods is to create a token object.
     *  This is an instance variable as multiple rules may collaborate to
     *  create a single token.  nextToken will return this object after
     *  matching lexer rule(s).  If you subclass to allow multiple token
     *  emissions, then set this to the last token to be matched or
     *  something non-null so that the auto token emit mechanism will not
     *  emit another token.
     */
    #token: Token | null = null;

    /**
     * Once we see EOF on char stream, next token will be EOF.
     *  If you have DONE : EOF ; then you see DONE EOF.
     */
    #hitEOF = false;

    #modeStack: number[] = [];
    #mode: number = Lexer.DEFAULT_MODE;

    /**
     * The text to be used for the next token. If this is not null, then the text
     * for the next token is fixed and is not subject to change in the normal
     * workflow of the lexer.
     */
    #text: string | null = null;

    #factory: TokenFactory<Token>;

    public constructor(input: CharStream) {
        super();
        this.#input = input;
        this.#factory = CommonTokenFactory.DEFAULT;
    }

    public reset(seekBack = true): void {
        // wack Lexer state variables
        if (seekBack) {
            this.#input.seek(0); // rewind the input
        }
        this.#token = null;
        this.type = Token.INVALID_TYPE;
        this.channel = Token.DEFAULT_CHANNEL;
        this.tokenStartCharIndex = -1;
        this.currentTokenColumn = -1;
        this.currentTokenStartLine = -1;
        this.#text = null;

        this.#hitEOF = false;
        this.#mode = Lexer.DEFAULT_MODE;
        this.#modeStack = [];

        this.interpreter.reset();
    }

    // Return a token from this source; i.e., match a token on the char stream.
    public nextToken(): Token {
        if (this.#input === null) {
            throw new Error("nextToken requires a non-null input stream.");
        }

        /**
         * Mark start location in char stream so unbuffered streams are
         * guaranteed at least have text of current token
         */
        const tokenStartMarker = this.#input.mark();
        try {
            for (; ;) {
                if (this.#hitEOF) {
                    this.emitEOF();

                    return this.#token!;
                }
                this.#token = null;
                this.channel = Token.DEFAULT_CHANNEL;
                this.tokenStartCharIndex = this.#input.index;
                this.currentTokenColumn = this.interpreter.column;
                this.currentTokenStartLine = this.interpreter.line;
                this.#text = null;
                let continueOuter = false;
                for (; ;) {
                    this.type = Token.INVALID_TYPE;
                    let ttype = Lexer.SKIP;
                    try {
                        ttype = this.interpreter.match(this.#input, this.#mode);
                    } catch (e) {
                        if (e instanceof LexerNoViableAltException) {
                            this.notifyListeners(e); // report error
                            this.recover(e);
                        } else {
                            throw e;
                        }
                    }
                    if (this.#input.LA(1) === Token.EOF) {
                        this.#hitEOF = true;
                    }
                    if (this.type === Token.INVALID_TYPE) {
                        this.type = ttype;
                    }
                    if (this.type === Lexer.SKIP) {
                        continueOuter = true;
                        break;
                    }
                    if (this.type !== Lexer.MORE) {
                        break;
                    }
                }
                if (continueOuter) {
                    continue;
                }
                if (this.#token === null) {
                    this.emit();
                }

                return this.#token!;
            }
        } finally {
            // make sure we release marker after match or
            // unbuffered char stream will keep buffering
            this.#input.release(tokenStartMarker);
        }
    }

    /**
     * Instruct the lexer to skip creating a token for current lexer rule
     * and look for another token. nextToken() knows to keep looking when
     * a lexer rule finishes with token set to SKIP_TOKEN. Recall that
     * if token==null at end of any token rule, it creates one for you
     * and emits it.
     */
    public skip(): void {
        this.type = Lexer.SKIP;
    }

    public more(): void {
        this.type = Lexer.MORE;
    }

    public mode(m: number): void {
        this.#mode = m;
    }

    public pushMode(m: number): void {
        if (LexerATNSimulator.debug) {
            console.log("pushMode " + m);
        }
        this.#modeStack.push(this.#mode);
        this.mode(m);
    }

    public popMode(): number {
        if (this.#modeStack.length === 0) {
            throw new Error("Empty Stack");
        }
        if (LexerATNSimulator.debug) {
            console.log("popMode back to " + this.#modeStack.slice(0, -1));
        }
        this.mode(this.#modeStack.pop()!);

        return this.#mode;
    }

    /**
     * By default does not support multiple emits per nextToken invocation
     * for efficiency reasons. Subclass and override this method, nextToken,
     * and getToken (to push tokens into a list and pull from that list
     * rather than a single variable as this implementation does).
     */
    public emitToken(token: Token): void {
        this.#token = token;
    }

    /**
     * The standard method called to automatically emit a token at the
     * outermost lexical rule. The token object should point into the
     * char buffer start..stop. If there is a text override in 'text',
     * use that to set the token's text. Override this method to emit
     * custom Token objects or provide a new factory.
     */
    public emit(): Token {
        const t = this.#factory.create([this, this.#input], this.type, this.#text, this.channel,
            this.tokenStartCharIndex, this.getCharIndex() - 1, this.currentTokenStartLine, this.currentTokenColumn);
        this.emitToken(t);

        return t;
    }

    public emitEOF(): Token {
        const eof = this.#factory.create([this, this.#input], Token.EOF, null, Token.DEFAULT_CHANNEL, this.#input.index,
            this.#input.index - 1, this.line, this.column);
        this.emitToken(eof);

        return eof;
    }

    // What is the index of the current character of lookahead?///
    public getCharIndex(): number {
        return this.#input.index;
    }

    /**
     * Return a list of all Token objects in input char stream.
     * Forces load of all tokens. Does not include EOF token.
     */
    public getAllTokens(): Token[] {
        const tokens = [];
        let t = this.nextToken()!;
        while (t.type !== Token.EOF) {
            tokens.push(t);
            t = this.nextToken()!;
        }

        return tokens;
    }

    public notifyListeners(e: LexerNoViableAltException): void {
        const start = this.tokenStartCharIndex;
        const stop = this.#input.index;
        const text = this.#input.getText(start, stop);
        const msg = "token recognition error at: '" + this.getErrorDisplay(text) + "'";
        const listener = this.getErrorListenerDispatch();
        listener.syntaxError(this, null, this.currentTokenStartLine,
            this.currentTokenColumn, msg, e);
    }

    public getErrorDisplay(s: string): string {
        return s;
    }

    public getErrorDisplayForChar(c: string): string {
        if (c.charCodeAt(0) === Token.EOF) {
            return "<EOF>";
        } else if (c === "\n") {
            return "\\n";
        } else if (c === "\t") {
            return "\\t";
        } else if (c === "\r") {
            return "\\r";
        } else {
            return c;
        }
    }

    public getCharErrorDisplay(c: string): string {
        return "'" + this.getErrorDisplayForChar(c) + "'";
    }

    /**
     * Lexers can normally match any char in it's vocabulary after matching
     * a token, so do the easy thing and just kill a character and hope
     * it all works out. You can instead use the rule invocation stack
     * to do sophisticated error recovery if you are in a fragment rule.
     */
    public recover(re: LexerNoViableAltException | RecognitionException): void {
        if (this.#input.LA(1) !== Token.EOF) {
            if (re instanceof LexerNoViableAltException) {
                // skip a char and try again
                this.interpreter.consume(this.#input);
            } else {
                // TODO: Do we lose character or line position information?
                this.#input.consume();
            }
        }
    }

    public get inputStream(): CharStream {
        return this.#input;
    }

    public set inputStream(input: CharStream) {
        this.reset(false);
        this.#input = input;
    }

    public set tokenFactory(factory: TokenFactory<Token>) {
        this.#factory = factory;
    };

    public get tokenFactory(): TokenFactory<Token> {
        return this.#factory;
    };

    public get sourceName(): string {
        return this.#input.getSourceName();
    }

    public get line(): number {
        return this.interpreter.line;
    }

    public set line(line: number) {
        this.interpreter.line = line;
    }

    public get column(): number {
        return this.interpreter.column;
    }

    public set column(column: number) {
        this.interpreter.column = column;
    }

    public get text(): string {
        if (this.#text !== null) {
            return this.#text;
        } else {
            return this.interpreter.getText(this.#input);
        }
    }

    public set text(text: string | null) {
        this.#text = text;
    }
}
