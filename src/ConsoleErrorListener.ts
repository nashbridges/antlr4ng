/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

import { BaseErrorListener } from "./BaseErrorListener.js";
import { RecognitionException } from "./RecognitionException.js";
import { Recognizer } from "./Recognizer.js";
import { ATNSimulator } from "./atn/ATNSimulator.js";

/**
 * {@inheritDoc}
 *
 * This implementation prints messages to {@link System//err} containing the
 * values of `line`, `charPositionInLine`, and `msg` using
 * the following format.
 *
 * ```
 * line *line*:*charPositionInLine* *msg*
 * ```
 *
 */
export class ConsoleErrorListener extends BaseErrorListener {
    /**
     * Provides a default instance of {@link ConsoleErrorListener}.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static readonly INSTANCE = new ConsoleErrorListener();

    public override syntaxError<T extends ATNSimulator>(recognizer: Recognizer<T> | null,
        offendingSymbol: unknown,
        line: number,
        charPositionInLine: number,
        msg: string | null,
        _e: RecognitionException | null): void {
        console.error("line " + line + ":" + charPositionInLine + " " + msg);
    }
}
