/*
 * Copyright (c) The ANTLR Project. All rights reserved.
 * Use of this file is governed by the BSD 3-clause license that
 * can be found in the LICENSE.txt file in the project root.
 */

/**
 * This class provides access to the current version of the ANTLR 4 runtime
 * library as compile-time and runtime constants, along with methods for
 * checking for matching version numbers and notifying listeners in the case
 * where a version mismatch is detected.
 *
 * The runtime version information is provided by {@link #VERSION} and
 * {@link #getRuntimeVersion()}. Detailed information about these values is
 * provided in the documentation for each member.
 *
 * The runtime version check is implemented by {@link #checkVersion}. Detailed
 * information about incorporating this call into user code, as well as its use
 * in generated code, is provided in the documentation for the method.
 *
 * Version strings x.y and x.y.z are considered "compatible" and no error
 * would be generated. Likewise, version strings x.y-SNAPSHOT and x.y.z are
 * considered "compatible" because the major and minor components x.y
 * are the same in each.
 *
 * To trap any error messages issued by this code, use System.setErr()
 * in your main() startup code.
 */
export class RuntimeMetaData {
    /**
     * A compile-time constant containing the current version of the ANTLR 4
     * runtime library.
     *
     * This compile-time constant value allows generated parsers and other
     * libraries to include a literal reference to the version of the ANTLR 4
     * runtime library the code was compiled against. At each release, we
     * change this value.
     *
     * Version numbers are assumed to have the form
     *
     * major.minor.patch.revision-suffix,
     *
     * with the individual components defined as follows.
     *
     * - major is a required non-negative integer, and is equal to `4` for ANTLR 4.
     * - minor is a required non-negative integer.
     * - patch is an optional non-negative integer. When patch is omitted, the `.` (dot) appearing before it is
     *   also omitted.
     * - revision is an optional non-negative integer, and may only be included when patch is also included.
     *   When revision is omitted, the `.` (dot) appearing before it is also omitted.
     * - suffix is an optional string. When suffix is omitted, the `-` (hyphen-minus) appearing before it is also
     *   omitted.
     */
    public static readonly VERSION = "4.13.1";

    /**
     * Gets the currently executing version of the ANTLR 4 runtime library.
     *
     * This method provides runtime access to the {@link #VERSION} field, as
     * opposed to directly referencing the field as a compile-time constant.
     *
     * @returns The currently executing version of the ANTLR 4 library
     */
    public static getRuntimeVersion(): string {
        return RuntimeMetaData.VERSION;
    }

    /**
     * This method provides the ability to detect mismatches between the version
     * of ANTLR 4 used to generate a parser, the version of the ANTLR runtime a
     * parser was compiled against, and the version of the ANTLR runtime which
     * is currently executing.
     *
     * The version check is designed to detect the following two specific
     * scenarios.
     *
     * - The ANTLR Tool version used for code generation does not match the
     * currently executing runtime version.
     * - The ANTLR Runtime version referenced at the time a parser was
     * compiled does not match the currently executing runtime version.
     *
     *
     * Starting with ANTLR 4.3, the code generator emits a call to this method
     * using two constants in each generated lexer and parser: a hard-coded
     * constant indicating the version of the tool used to generate the parser
     * and a reference to the compile-time constant {@link #VERSION}. At
     * runtime, this method is called during the initialization of the generated
     * parser to detect mismatched versions, and notify the registered listeners
     * prior to creating instances of the parser.
     *
     *
     * This method does not perform any detection or filtering of semantic
     * changes between tool and runtime versions. It simply checks for a
     * version match and emits an error to stderr if a difference
     * is detected.
     *
     *
     * Note that some breaking changes between releases could result in other
     * types of runtime exceptions, such as a {@link LinkageError}, prior to
     * calling this method. In these cases, the underlying version mismatch will
     * not be reported here. This method is primarily intended to
     * notify users of potential semantic changes between releases that do not
     * result in binary compatibility problems which would be detected by the
     * class loader. As with semantic changes, changes that break binary
     * compatibility between releases are mentioned in the release notes
     * accompanying the affected release.
     *
     *
     * **Additional note for target developers:** The version check
     * implemented by this class is designed to address specific compatibility
     * concerns that may arise during the execution of Java applications. Other
     * targets should consider the implementation of this method in the context
     * of that target's known execution environment, which may or may not
     * resemble the design provided for the Java target.
     *
     * @param generatingToolVersion The version of the tool used to generate a parser.
     * This value may be null when called from user code that was not generated
     * by, and does not reference, the ANTLR 4 Tool itself.
     * @param compileTimeVersion The version of the runtime the parser was
     * compiled against. This should always be passed using a direct reference
     * to {@link #VERSION}.
     */
    public static checkVersion(generatingToolVersion: string, compileTimeVersion: string): void {
        const runtimeVersion = RuntimeMetaData.VERSION;
        let runtimeConflictsWithGeneratingTool = false;
        let runtimeConflictsWithCompileTimeTool = false;

        runtimeConflictsWithGeneratingTool = runtimeVersion !== generatingToolVersion &&
            RuntimeMetaData.getMajorMinorVersion(runtimeVersion)
            !== RuntimeMetaData.getMajorMinorVersion(generatingToolVersion);

        runtimeConflictsWithCompileTimeTool = runtimeVersion !== compileTimeVersion &&
            RuntimeMetaData.getMajorMinorVersion(runtimeVersion)
            !== RuntimeMetaData.getMajorMinorVersion(compileTimeVersion);

        if (runtimeConflictsWithGeneratingTool) {
            console.error(`ANTLR Tool version ${generatingToolVersion} used for code generation does not match the ` +
                `current runtime version ${runtimeVersion}`);
        }

        if (runtimeConflictsWithCompileTimeTool) {
            console.error(`ANTLR Runtime version ${compileTimeVersion} used for parser compilation does not match ` +
                `the current runtime version ${runtimeVersion}`);
        }
    }

    /**
     * Gets the major and minor version numbers from a version string. For
     * details about the syntax of the input `version`.
     * E.g., from x.y.z return x.y.
     *
     * @param version The complete version string.
     * @returns A string of the form *major*.*minor* containing
     * only the major and minor components of the version string.
     */
    public static getMajorMinorVersion(version: string): string {
        const firstDot = version.indexOf(".");
        const secondDot = firstDot >= 0 ? version.indexOf(".", firstDot + 1) : -1;
        const firstDash = version.indexOf("-");
        let referenceLength = version.length;
        if (secondDot >= 0) {
            referenceLength = Math.min(referenceLength, secondDot);
        }

        if (firstDash >= 0) {
            referenceLength = Math.min(referenceLength, firstDash);
        }

        return version.substring(0, referenceLength);
    }
}
