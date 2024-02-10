/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

import { TokenStream } from "../TokenStream.js";
import { ATNConfigSet } from "./ATNConfigSet.js";
import { DecisionEventInfo } from "./DecisionEventInfo.js";

/**
 * This class represents profiling event information for a syntax error
 * identified during prediction. Syntax errors occur when the prediction
 * algorithm is unable to identify an alternative which would lead to a
 * successful parse.
 *
 * @see Parser#notifyErrorListeners(Token, String, RecognitionException)
 * @see ANTLRErrorListener#syntaxError
 */
export class ErrorInfo extends DecisionEventInfo {
    /**
     * Constructs a new instance of the {@link ErrorInfo} class with the
     * specified detailed syntax error information.
     *
     * @param decision The decision number
     * @param configs The final configuration set reached during prediction
     * prior to reaching the {@link ATNSimulator#ERROR} state
     * @param input The input token stream
     * @param startIndex The start index for the current prediction
     * @param stopIndex The index at which the syntax error was identified
     * @param fullCtx `true` if the syntax error was identified during LL
     * prediction; otherwise, `false` if the syntax error was identified
     * during SLL prediction
     */
    public constructor(
        decision: number,
        configs: ATNConfigSet,
        input: TokenStream,
        startIndex: number,
        stopIndex: number,
        fullCtx: boolean,
    ) {
        super(decision, configs, input, startIndex, stopIndex, fullCtx);
    }
}
