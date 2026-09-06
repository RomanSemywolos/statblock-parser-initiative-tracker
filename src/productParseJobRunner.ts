import { compileToEditableStatblock } from "./editableCompiler.js";
import { createLosslessSourceMap } from "./losslessSource.js";
import type { ModelProvider } from "./modelProvider.js";
import type { ParseJobResult } from "./parseJobs.js";
import { createParserReport } from "./renderer.js";
import { ParseJobExecutionError, type ParseJobRunner } from "./parseJobService.js";
import type { ParseJobRunnerDiagnostics } from "./parseDiagnostics.js";
import { analyzeStatblock } from "./pipeline.js";

export type ProductParseJobRunnerOptions = {
  provider: ModelProvider;
  parserVersion: string;
};

export function createProductParseJobRunner(options: ProductParseJobRunnerOptions): ParseJobRunner {
  return async (rawText: string, statblockId: string, parserMode = "auto") => {
    let analyzed;
    try {
      const sourceMap = createLosslessSourceMap(rawText);
      analyzed = await analyzeStatblock({
        rawSource: rawText,
        sourceMap,
        model: options.provider.model,
        callModel: (request) => options.provider.generateStructured(request),
        parserMode,
      });
    } catch (error) {
      const diagnostics: ParseJobRunnerDiagnostics = {
        parserVersion: options.parserVersion,
        model: options.provider.model,
        pipeline: null,
        product: null,
      };
      throw new ParseJobExecutionError("parser", error instanceof Error ? error.message : String(error), diagnostics);
    }

    try {
      const parserStructure =
        analyzed.parserRouting.selectedMode === "generic" ? "mixed" : analyzed.parserRouting.selectedMode;
      const editableDocument = compileToEditableStatblock(analyzed.document, {
        language: "en",
        parserStructure,
      });
      const result: ParseJobResult = {
        editableDocument,
        parserVersion: options.parserVersion,
        statblockId,
        parserStructure,
        parserMode,
        rawSource: rawText,
      };
      const diagnostics: ParseJobRunnerDiagnostics = {
        parserVersion: options.parserVersion,
        model: options.provider.model,
        pipeline: {
          timing: analyzed.timing,
          modelRequest: analyzed.modelRequest,
          rawModelContent: analyzed.rawModelContent,
          essentialVerification: analyzed.essentialVerification,
          bodyStructure: analyzed.bodyStructure ?? null,
          deterministicHints: analyzed.deterministicHints,
          parserRouting: analyzed.parserRouting,
          candidateDebug: analyzed.candidateDebug,
          losslessDocument: analyzed.document,
          parserReport: createParserReport(analyzed.document),
        },
        product: editableDocument,
      };
      return { ...result, diagnostics };
    } catch (error) {
      const diagnostics: ParseJobRunnerDiagnostics = {
        parserVersion: options.parserVersion,
        model: options.provider.model,
        pipeline: {
          timing: analyzed.timing,
          modelRequest: analyzed.modelRequest,
          rawModelContent: analyzed.rawModelContent,
          essentialVerification: analyzed.essentialVerification,
          bodyStructure: analyzed.bodyStructure ?? null,
          deterministicHints: analyzed.deterministicHints,
          parserRouting: analyzed.parserRouting,
          candidateDebug: analyzed.candidateDebug,
          losslessDocument: analyzed.document,
          parserReport: createParserReport(analyzed.document),
        },
        product: null,
      };
      throw new ParseJobExecutionError("compile", error instanceof Error ? error.message : String(error), diagnostics);
    }
  };
}
