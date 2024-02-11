/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

import { DecisionState } from "./DecisionState.js";
import { ATNStateType } from "./ATNStateType.js";

/**
 * Decision state for `A+` and `(A|B)+`.  It has two transitions:
 * one to the loop back to start of the block and one to exit.
 */
export class PlusLoopbackState extends DecisionState {
    public override get stateType(): number {
        return ATNStateType.PLUS_LOOP_BACK;
    }

}
